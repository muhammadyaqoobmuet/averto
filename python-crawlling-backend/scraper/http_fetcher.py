"""
http_fetcher.py — Tier 1: HTTP-first Fetch
============================================
Tries to retrieve pages with plain HTTP (httpx) before touching a browser.
Also discovers URLs from sitemap.xml and RSS/Atom feeds.

Rules (from Goal.md):
  • Rate limit: 2–6 second random delay between requests
  • Max concurrency: 2–3 requests (semaphore-controlled)
  • Cache all successful responses (in-memory, per-session)
  • Detect blocking signals → return BlockedError, never retry aggressively
"""

from __future__ import annotations

import asyncio
import random
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx

# ── Constants ─────────────────────────────────────────────────────────────────

MAX_CONCURRENCY = 8    # concurrent HTTP requests (RAM-friendly, fast)
MIN_DELAY = 0.3        # seconds — short same-domain delay
MAX_DELAY = 1.5        # seconds — stays polite but fast

# Status codes that mean "try the browser instead" — NOT a hard block
_SOFT_FAIL_CODES = {403, 406, 429, 503}

# Only confirmed bot-wall body signals = true hard block
# (403 alone on a govt/university site is NOT Cloudflare)
_HARD_BLOCK_BODY_SIGNALS = [
    "just a moment",
    "checking your browser",
    "ddos protection by cloudflare",
    "enable javascript and cookies to continue",
    "please complete the security check",
    "hcaptcha",
    "recaptcha",
    "bot detection",
    "access denied by perimeterx",
    "access denied by imperva",
    "access denied by datadome",
]

_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "DNT": "1",
    "Upgrade-Insecure-Requests": "1",
}

# ── Result types ──────────────────────────────────────────────────────────────


@dataclass
class FetchSuccess:
    url: str
    html: str
    status_code: int
    content_type: str


@dataclass
class FetchBlocked:
    url: str
    reason: str
    status_code: int


@dataclass
class FetchFailed:
    url: str
    reason: str


FetchResult = FetchSuccess | FetchBlocked | FetchFailed


# ── Blocking detection ────────────────────────────────────────────────────────


def _is_hard_blocked(status: int, body: str) -> tuple[bool, str]:
    """
    True hard block = confirmed bot-wall (Cloudflare challenge, CAPTCHA, etc.)
    403 alone is NOT a hard block — it may just be an HTTP bot filter
    that the browser can bypass. Return (hard_blocked, reason).
    """
    body_lower = body[:4000].lower()
    for signal in _HARD_BLOCK_BODY_SIGNALS:
        if signal in body_lower:
            return True, f"Bot-wall signal: '{signal}'"
    return False, ""


def _is_soft_fail(status: int) -> bool:
    """Soft fail = try the browser next. 403/429/503 without body signals."""
    return status in _SOFT_FAIL_CODES


def _is_js_only(html: str) -> bool:
    """Heuristic: page has very little content outside <script> tags."""
    # Strip scripts
    no_script = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.S | re.I)
    # Strip tags
    text = re.sub(r"<[^>]+>", " ", no_script)
    text = re.sub(r"\s+", " ", text).strip()
    return len(text) < 200


# ── Semaphore-controlled fetch ────────────────────────────────────────────────
# Created lazily so it uses the running event loop (avoids deprecation warning)
_semaphore: asyncio.Semaphore | None = None

def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    return _semaphore


async def fetch_url(
    url: str,
    client: httpx.AsyncClient,
    delay: bool = True,
) -> FetchResult:
    """
    Fetch a single URL with rate limiting and block detection.

    Returns:
      FetchSuccess  — got HTML, proceed to content extraction
      FetchBlocked  — confirmed bot-wall (Cloudflare/CAPTCHA) → mark & skip
      FetchFailed   — 403/timeout/network error → try browser next
    """
    if delay:
        await asyncio.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    async with _get_semaphore():
        try:
            resp = await client.get(url, timeout=20, follow_redirects=True)
            html = resp.text
            ct = resp.headers.get("content-type", "")

            # Check for confirmed bot-wall in body (regardless of status code)
            hard_blocked, reason = _is_hard_blocked(resp.status_code, html)
            if hard_blocked:
                return FetchBlocked(url=url, reason=reason, status_code=resp.status_code)

            # Soft fail (403, 429, 503) WITHOUT a bot-wall body → try browser
            if _is_soft_fail(resp.status_code):
                return FetchFailed(
                    url=url,
                    reason=f"HTTP {resp.status_code} (soft fail → will try browser)"
                )

            if resp.status_code >= 400:
                return FetchFailed(url=url, reason=f"HTTP {resp.status_code}")

            return FetchSuccess(
                url=str(resp.url),
                html=html,
                status_code=resp.status_code,
                content_type=ct,
            )

        except httpx.TimeoutException as e:
            return FetchFailed(url=url, reason=f"Timeout: {e}")
        except httpx.RequestError as e:
            return FetchFailed(url=url, reason=f"Network error: {e}")


# ── Sitemap discovery ─────────────────────────────────────────────────────────

_SITEMAP_NAMESPACES = {
    "sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
}


async def discover_sitemap_urls(base_url: str, client: httpx.AsyncClient) -> list[str]:
    """
    Try fetching /sitemap.xml and /sitemap_index.xml.
    Returns a flat list of all page URLs found.
    """
    parsed = urlparse(base_url)
    root = f"{parsed.scheme}://{parsed.netloc}"

    candidates = [
        f"{root}/sitemap.xml",
        f"{root}/sitemap_index.xml",
        f"{root}/sitemap.xml.gz",
        f"{root}/robots.txt",  # may contain Sitemap: directive
    ]

    sitemap_urls: list[str] = []

    for candidate in candidates:
        try:
            result = await fetch_url(candidate, client, delay=False)
            if not isinstance(result, FetchSuccess):
                continue

            content = result.html

            # robots.txt — extract Sitemap: lines
            if "robots.txt" in candidate:
                for line in content.splitlines():
                    if line.lower().startswith("sitemap:"):
                        sm_url = line.split(":", 1)[1].strip()
                        sub = await _parse_sitemap(sm_url, client)
                        sitemap_urls.extend(sub)
                continue

            urls = await _parse_sitemap_content(content, root, client)
            sitemap_urls.extend(urls)

            if sitemap_urls:
                break  # stop once we have results

        except Exception:
            continue

    return list(dict.fromkeys(sitemap_urls))  # deduplicate, preserve order


async def _parse_sitemap(url: str, client: httpx.AsyncClient) -> list[str]:
    result = await fetch_url(url, client, delay=False)
    if not isinstance(result, FetchSuccess):
        return []
    return await _parse_sitemap_content(result.html, url, client)


async def _parse_sitemap_content(
    content: str, base: str, client: httpx.AsyncClient
) -> list[str]:
    urls: list[str] = []
    try:
        root = ET.fromstring(content)
        tag = root.tag.lower()

        # Sitemap index → recurse into each sub-sitemap
        if "sitemapindex" in tag:
            sub_tasks = []
            for sm in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc"):
                if sm.text:
                    sub_tasks.append(_parse_sitemap(sm.text.strip(), client))
            results = await asyncio.gather(*sub_tasks, return_exceptions=True)
            for r in results:
                if isinstance(r, list):
                    urls.extend(r)

        else:
            # Regular sitemap
            for loc in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc"):
                if loc.text:
                    urls.append(loc.text.strip())

    except ET.ParseError:
        # Try naive regex as last resort
        found = re.findall(r"<loc>(https?://[^<]+)</loc>", content, re.I)
        urls.extend(found)

    return urls


# ── RSS / Atom feed discovery ─────────────────────────────────────────────────


async def discover_feed_urls(base_url: str, client: httpx.AsyncClient) -> list[str]:
    """
    Look for RSS/Atom feeds and extract article links.
    """
    parsed = urlparse(base_url)
    root = f"{parsed.scheme}://{parsed.netloc}"

    feed_candidates = [
        f"{root}/feed",
        f"{root}/feed.xml",
        f"{root}/rss.xml",
        f"{root}/atom.xml",
        f"{root}/index.xml",
        f"{root}/feed/",
        f"{root}/rss/",
    ]

    article_urls: list[str] = []

    for candidate in feed_candidates:
        result = await fetch_url(candidate, client, delay=False)
        if not isinstance(result, FetchSuccess):
            continue

        content = result.html
        # Extract <link> elements from RSS
        links = re.findall(
            r"<link>(?!<!\[CDATA\[)(https?://[^<]+)</link>", content, re.I
        )
        article_urls.extend(links)

        # Atom feed <link href="...">
        hrefs = re.findall(
            r'<link[^>]+href=["\']([^"\']+)["\'][^>]*rel=["\']alternate["\']',
            content, re.I
        )
        article_urls.extend(hrefs)

        if article_urls:
            break

    return [u for u in dict.fromkeys(article_urls) if urlparse(u).netloc]


# ── Convenience: build an httpx client ───────────────────────────────────────


def build_client(timeout: int = 30) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        headers=_DEFAULT_HEADERS,
        timeout=timeout,
        follow_redirects=True,
        http2=True,
    )
