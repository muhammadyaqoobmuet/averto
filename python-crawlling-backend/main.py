from rich.theme import Theme
from crawl4ai.content_filter_strategy import PruningContentFilter
import os
import re
import asyncio
import tempfile
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CrawlerRunConfig,
    DefaultMarkdownGenerator,
    MarkdownGenerationResult,
)
from bs4 import BeautifulSoup

# create instance of fast api like app = express()
app = FastAPI(title="ChatEmbed Crawler Service")

# add middleware like app.use(cors()) for allowing all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# check for internal api key
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")
if not INTERNAL_API_KEY:
    raise RuntimeError("INTERNAL_API_KEY environment variable is not set")

# create request model like interface in ts
class CrawlRequest(BaseModel):
    url: str
    max_pages: int = Field(default=10, ge=1, le=200)
# feild is like in ts is equivalent to

class PageResult(BaseModel):
    url: str
    title: Optional[str] = None
    markdown: str


class CrawlMeta(BaseModel):
    discovered: int
    indexed: int
    skipped: List[str] = []
    failed: List[dict] = []


class CrawlResponse(BaseModel):
    pages: List[PageResult]
    meta: CrawlMeta


def _extract_title_from_markdown(markdown: str, fallback_url: str) -> str:
    fm = re.search(r"^title:\s*['\"]?(.+?)['\"]?\s*$", markdown, re.MULTILINE)
    if fm:
        return fm.group(1).strip()
    h1 = re.search(r"^#\s+(.+)$", markdown, re.MULTILINE)
    if h1:
        return h1.group(1).strip()
    return fallback_url


async def crawl_single_page(url: str) -> Optional[PageResult]:
    browser_config = BrowserConfig(
        headless=True,
        enable_stealth=True,
        ignore_https_errors=True,
        extra_args=["--disable-setuid-sandbox", "--no-sandbox"],
    )

    md_generator = DefaultMarkdownGenerator(
        content_filter=PruningContentFilter(
            threshold=0.45,
            threshold_type="dynamic",
            min_word_threshold=30
        ),
        options={
            "ignore_links": False,
            "ignore_images": True,
            "image_alt_text": True,
        },
    )

    config = CrawlerRunConfig(
        markdown_generator=md_generator,
        excluded_tags=["script", "style", "noscript"],
        remove_overlay_elements=True,
        exclude_external_links=False,
        cache_mode="bypass",
        page_timeout=60000,
    )

    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            raw_result = await crawler.arun(url=url, config=config)
            result = raw_result[0] if hasattr(raw_result, "__getitem__") else raw_result

            if not result or not result.success:
                return None
            # use getattr like this im from js background
            # it does like this result?.metadata?.title || "No Title"
            title = getattr(result, "metadata", {}).get("title") or "No Title"
            # above statment in js can be written as result?.metadata?.title || "No Title"
            md_obj = getattr(result, "markdown", None)
            #md_obj is a object that contains the markdown content this above line in js is md_obj = result?.markdown || null
            markdown_content = ""
            if md_obj:
                if isinstance(md_obj, MarkdownGenerationResult):
                    markdown_content = (
                        md_obj.fit_markdown
                        or md_obj.raw_markdown
                        or ""
                    )
                else:
                    markdown_content = str(md_obj)
            else:
                html = getattr(result, "fit_html", None) or getattr(result, "cleaned_html", "")
                soup = BeautifulSoup(html, "html.parser")
                for tag in soup(["script", "style", "nav", "noscript"]):
                    tag.decompose()
                markdown_content = soup.get_text(separator="\n", strip=True)

            if markdown_content and len(markdown_content.strip()) > 80:
                print(f"Crawl success: {url}, title: {title}, md_len: {len(markdown_content)}")
                return PageResult(url=url, title=title, markdown=markdown_content.strip())

            return None

    except Exception as e:
        print(f"Error crawling {url}: {e}")
        return None


# this gives all the links of the same domain
async def discover_same_domain_links(seed_url: str, max_links: int = 50) -> List[str]:
    from urllib.parse import urlparse, urljoin

    parsed_seed = urlparse(seed_url)
    base = f"{parsed_seed.scheme}://{parsed_seed.netloc}"
    found: List[str] = [seed_url]
    seen = {seed_url.rstrip("/")}

    try:
        from scraper import http_fetcher as http

        async with http.build_client() as client:
            sitemap_urls = await http.discover_sitemap_urls(seed_url, client)
            for u in sitemap_urls:
                norm = u.rstrip("/")
                if norm not in seen and urlparse(u).netloc == parsed_seed.netloc:
                    seen.add(norm)
                    found.append(u)
                if len(found) >= max_links:
                    return found[:max_links]

            seed_result = await http.fetch_url(seed_url, client, delay=False)
            if isinstance(seed_result, http.FetchSuccess):
                soup = BeautifulSoup(seed_result.html, "lxml")
                for a in soup.find_all("a", href=True):
                    href = a["href"].strip()
                    if not href or href.startswith("#") or href.startswith("mailto:"):
                        continue
                    full = urljoin(seed_url, href)
                    p = urlparse(full)
                    if p.netloc != parsed_seed.netloc:
                        continue
                    clean = full.split("#")[0].rstrip("/")
                    if clean not in seen:
                        seen.add(clean)
                        found.append(full.split("#")[0])
                    if len(found) >= max_links:
                        break
    except Exception as e:
        print(f"Link discovery fallback: {e}")

    return found[:max_links]


async def crawl_multi_page(seed_url: str, max_pages: int = 10) -> CrawlResponse:
    """Discover and crawl up to max_pages same-domain URLs."""
    discovered = await discover_same_domain_links(seed_url, max_links=max(50, max_pages * 3))
    to_crawl = discovered[:max_pages] # this is like discovered.slice(0, max_pages)
    skipped = discovered[max_pages:] # this is like discovered.slice(max_pages)

    pages: List[PageResult] = []
    failed: List[dict] = []

    sem = asyncio.Semaphore(4) #semaphore is like a gate that allows only 4 requests at a time

    async def _crawl_one(url: str) -> None:
        async with sem:
            result = await crawl_single_page(url)
            if result:
                pages.append(result)
            else:
                failed.append({"url": url, "error": "Crawl returned empty or failed"})

    await asyncio.gather(*[_crawl_one(u) for u in to_crawl])

    if not pages:
        pipeline_pages = await _crawl_via_pipeline(seed_url, max_pages)
        if pipeline_pages:
            return CrawlResponse(
                pages=pipeline_pages,
                meta=CrawlMeta(
                    discovered=len(discovered),
                    indexed=len(pipeline_pages),
                    skipped=skipped,
                    failed=failed,
                ),
            )
        raise HTTPException(
            status_code=500,
            detail="Failed to crawl any pages — site may be blocked or empty",
        )

    return CrawlResponse(
        pages=pages,
        meta=CrawlMeta(
            discovered=len(discovered),
            indexed=len(pages),
            skipped=skipped,
            failed=failed,
        ),
    )


async def _crawl_via_pipeline(seed_url: str, max_pages: int) -> List[PageResult]:
    """Fallback: use the 4-tier pipeline scraper for difficult sites."""
    try:
        from scraper.pipeline import discover_urls, crawl_url
        from scraper import http_fetcher as http
        from scraper.url_store import URLStore
        from scraper import classifier as clf

        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            db_path = output_dir / "crawl_state.db"
            store = URLStore(db_path)
            results: List[PageResult] = []

            async with http.build_client() as client:
                discovered = await discover_urls(seed_url, client, depth=1, store=store)
                urls = discovered[:max_pages]

                for url in urls:
                    store.add_pending(url, clf.classify(url).tier.value)
                    pr = await crawl_url(url, store, output_dir, client)
                    if pr.status == "success" and pr.output_path:
                        md_content = Path(pr.output_path).read_text(encoding="utf-8")
                        title = _extract_title_from_markdown(md_content, pr.url)
                        results.append(PageResult(url=pr.url, title=title, markdown=md_content))

            store.close()
            return results
    except Exception as e:
        print(f"Pipeline fallback failed: {e}")
        return []


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/crawl", response_model=CrawlResponse)
async def crawl_endpoint(
    request: CrawlRequest,
    x_internal_key: Optional[str] = Header(None), # we pass from header
):
    if x_internal_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid Internal Key")

    return await crawl_multi_page(request.url, request.max_pages)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
