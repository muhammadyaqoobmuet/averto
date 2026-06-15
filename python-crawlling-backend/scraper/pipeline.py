"""
pipeline.py — RAG Scraper Orchestrator
========================================
Ties all fetcher tiers together following the 4-step strategy from Goal.md.

Flow per URL:
  1. Classify URL (Tier A / B / C)
  2. Tier C → mark blocked immediately, skip
  3. HTTP fetch (always first)
       Success → fallback_fetcher.extract(html) for clean markdown
       Blocked → go to Step 4
       Failed  → go to Step 3 (browser) for Tier B, or Step 4 for Tier A
  4. Browser fetch (Tier B, or Tier A with JS-only detection)
       Success → use fit_markdown
       Blocked → go to Step 4
       Failed  → go to Step 4
  5. Fallback extraction on cached html (trafilatura / readability)
       Success → save
       Failed  → mark as failed
  6. Save clean markdown, update URL store

All outputs go to output/pages/<safe_filename>.md
State is persisted in output/crawl_state.db
"""

from __future__ import annotations

import asyncio
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlparse

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn

from . import classifier as clf
from .classifier import Tier
from . import http_fetcher as http
from . import browser_fetcher as browser
from . import fallback_fetcher as fallback
from . import md_cleaner as md
from .url_store import URLStore, URLStatus

console = Console()

# ── Config ────────────────────────────────────────────────────────────────────

DEFAULT_OUTPUT_DIR = Path("output")
DEFAULT_DB_PATH = DEFAULT_OUTPUT_DIR / "crawl_state.db"
MAX_DEPTH = 2
PIPELINE_CONCURRENCY = 8   # URLs crawled in parallel (HTTP is async, non-blocking)


# ── Result ────────────────────────────────────────────────────────────────────

@dataclass
class PageResult:
    url: str
    status: str          # success | blocked | failed
    method: str          # http | browser | trafilatura | readability | beautifulsoup | none
    tier: str
    char_count: int
    output_path: str
    error: str


# ── Core crawl logic ──────────────────────────────────────────────────────────

async def crawl_url(
    url: str,
    store: URLStore,
    output_dir: Path,
    http_client,
    tier_override: Optional[str] = None,
) -> PageResult:
    """
    Execute the 4-tier strategy for a single URL. Updates the store.
    """
    # ── Pre-check: already handled ────────────────────────────────────────
    norm = store.normalise(url)
    record = store.get_record(norm)
    if record and record.status in (URLStatus.SUCCESS, URLStatus.BLOCKED):
        return PageResult(
            url=url,
            status=record.status.value,
            method=record.method,
            tier=record.tier,
            char_count=record.char_count,
            output_path=record.output_path,
            error=record.error,
        )

    # ── Classify ──────────────────────────────────────────────────────────
    classification = clf.classify(url)
    tier = Tier(tier_override) if tier_override else classification.tier

    # ── Tier C — Protected — skip immediately ──────────────────────────────
    if tier == Tier.C:
        reason = classification.reason
        store.mark_blocked(url, reason)
        console.log(f"[red]BLOCKED[/red] (Tier C) {url} — {reason}")
        return PageResult(
            url=url, status="blocked", method="none",
            tier=tier.value, char_count=0,
            output_path="", error=reason,
        )

    raw_html: Optional[str] = None
    markdown_content: Optional[str] = None
    method_used = "none"
    title = ""

    # ─────────────────────────────────────────────────────────────────────
    # STEP 1 — HTTP fetch
    # ─────────────────────────────────────────────────────────────────────
    console.log(f"[cyan]HTTP[/cyan] {url}")
    http_result = await http.fetch_url(url, http_client)
    http_soft_block_reason: str = ""

    if isinstance(http_result, http.FetchSuccess):
        raw_html = http_result.html

        # Check if JS-only (content requires browser)
        if not http._is_js_only(raw_html):
            # Extract with fallback pipeline directly on HTML
            fb = fallback.extract(raw_html, url)
            if isinstance(fb, fallback.FallbackSuccess):
                markdown_content = fb.markdown
                method_used = fb.method
                console.log(
                    f"[green]✓ HTTP+{fb.method}[/green] {url} "
                    f"({fb.char_count:,} chars)"
                )

    elif isinstance(http_result, http.FetchBlocked):
        # Body signal (e.g. Cloudflare challenge) — NOTE: stealth browser can
        # bypass this, so fall through to browser before giving up.
        http_soft_block_reason = http_result.reason
        console.log(
            f"[yellow]HTTP bot-wall ({http_soft_block_reason[:50]}) → trying browser[/yellow]"
        )
    else:
        # FetchFailed (403, timeout, network) — fall through to browser
        console.log(f"[dim]HTTP failed ({getattr(http_result, 'reason','')[:60]}) → trying browser[/dim]")

    # ─────────────────────────────────────────────────────────────────────
    # STEP 2 — Browser rendering (if HTTP gave nothing OR was soft-blocked)
    # ─────────────────────────────────────────────────────────────────────
    if not markdown_content:
        console.log(f"[yellow]BROWSER[/yellow] {url}")
        browser_result = await browser.fetch_url(url)

        if isinstance(browser_result, browser.BrowserSuccess):
            markdown_content = browser_result.markdown
            title = browser_result.title
            method_used = "browser"
            console.log(
                f"[green]✓ BROWSER[/green] {url} "
                f"({browser_result.char_count:,} chars)"
            )

        elif isinstance(browser_result, browser.BrowserBlocked):
            reason = browser_result.reason
            store.mark_blocked(url, reason)
            console.log(f"[red]✗ BLOCKED[/red] {url} — {reason}")
            return PageResult(
                url=url, status="blocked", method="none",
                tier=tier.value, char_count=0,
                output_path="", error=reason,
            )
        # else BrowserFailed — fall through to fallback on raw html

    # ─────────────────────────────────────────────────────────────────────
    # STEP 3 — Lightweight fallback on cached HTML (if browser also failed)
    # ─────────────────────────────────────────────────────────────────────
    if not markdown_content and raw_html:
        console.log(f"[magenta]FALLBACK[/magenta] {url}")
        fb = fallback.extract(raw_html, url)
        if isinstance(fb, fallback.FallbackSuccess):
            markdown_content = fb.markdown
            method_used = fb.method
            console.log(
                f"[green]✓ FALLBACK({fb.method})[/green] {url} "
                f"({fb.char_count:,} chars)"
            )

    # ─────────────────────────────────────────────────────────────────────
    # STEP 4 — All methods exhausted
    # ─────────────────────────────────────────────────────────────────────
    if not markdown_content:
        reason = "All fetch methods failed"
        store.mark_failed(url, reason)
        console.log(f"[red]✗ FAILED[/red] {url}")
        return PageResult(
            url=url, status="failed", method="none",
            tier=tier.value, char_count=0,
            output_path="", error=reason,
        )

    # ─────────────────────────────────────────────────────────────────────
    # Clean & save
    # ─────────────────────────────────────────────────────────────────────
    cleaned = md.clean(
        markdown=markdown_content,
        url=url,
        title=title,
        tier=tier.value,
        method=method_used,
        crawled_at=time.time(),
    )

    if not cleaned.strip():
        reason = "Cleaning produced empty output"
        store.mark_failed(url, reason)
        return PageResult(
            url=url, status="failed", method=method_used,
            tier=tier.value, char_count=0,
            output_path="", error=reason,
        )

    pages_dir = output_dir / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)

    filename = md.safe_filename(url) + ".md"
    out_path = pages_dir / filename

    out_path.write_text(cleaned, encoding="utf-8")

    store.mark_success(
        url=url,
        method=method_used,
        char_count=len(cleaned),
        output_path=str(out_path),
    )

    return PageResult(
        url=url,
        status="success",
        method=method_used,
        tier=tier.value,
        char_count=len(cleaned),
        output_path=str(out_path),
        error="",
    )


# ── Discovery helpers ─────────────────────────────────────────────────────────

async def discover_urls(
    seed_url: str,
    http_client,
    depth: int = 1,
    store: Optional[URLStore] = None,
) -> list[str]:
    """
    Discover URLs to crawl from sitemap, RSS, and page links.
    Returns a deduplicated list (excluding already-successful ones).
    """
    all_urls: list[str] = [seed_url]

    # Sitemap discovery
    console.log(f"[dim]Discovering sitemap URLs for {seed_url}[/dim]")
    sitemap_urls = await http.discover_sitemap_urls(seed_url, http_client)
    if sitemap_urls:
        console.log(f"[dim]Found {len(sitemap_urls)} sitemap URLs[/dim]")
        all_urls.extend(sitemap_urls)

    # RSS/Feed discovery
    console.log(f"[dim]Checking RSS/Atom feeds...[/dim]")
    feed_urls = await http.discover_feed_urls(seed_url, http_client)
    if feed_urls:
        console.log(f"[dim]Found {len(feed_urls)} feed URLs[/dim]")
        all_urls.extend(feed_urls)

    # Depth-based link crawl (only if depth > 0 and few sitemap results)
    if depth > 0 and len(all_urls) < 5:
        console.log(f"[dim]No sitemap found, crawling links at depth {depth}[/dim]")
        seed_result = await http.fetch_url(seed_url, http_client, delay=False)
        if isinstance(seed_result, http.FetchSuccess):
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(seed_result.html, "lxml")
            parsed_seed = urlparse(seed_url)
            base = f"{parsed_seed.scheme}://{parsed_seed.netloc}"
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if href.startswith("/"):
                    href = base + href
                elif not href.startswith("http"):
                    continue
                # Same-domain only
                if urlparse(href).netloc == parsed_seed.netloc:
                    all_urls.append(href)

    # Deduplicate via store normalisation
    seen: set[str] = set()
    unique: list[str] = []
    for u in all_urls:
        norm = store.normalise(u) if store else u
        if norm not in seen:
            seen.add(norm)
            unique.append(u)

    # Filter out already-successful
    if store:
        unique = [
            u for u in unique
            if not (
                store.is_seen(u) and
                store.get_record(store.normalise(u)) and
                store.get_record(store.normalise(u)).status == URLStatus.SUCCESS
            )
        ]

    return unique


# ── Main pipeline entry point ─────────────────────────────────────────────────

async def run(
    urls: list[str],
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    db_path: Optional[Path] = None,
    depth: int = 1,
    discover: bool = True,
    on_result: Optional[Callable[[PageResult], None]] = None,
) -> list[PageResult]:
    """
    Run the full RAG scraping pipeline on a list of seed URLs.

    Args:
        urls:       List of seed URLs to crawl
        output_dir: Directory for output markdown files
        db_path:    SQLite database path (default: output/crawl_state.db)
        depth:      Link discovery depth (0 = seed only, 1-2 = follow links)
        discover:   Whether to discover sitemap/RSS/links from each seed
        on_result:  Callback called after each page is processed

    Returns:
        List of PageResult objects for all processed URLs.
    """
    if db_path is None:
        db_path = output_dir / "crawl_state.db"

    output_dir.mkdir(parents=True, exist_ok=True)
    store = URLStore(db_path)

    results: list[PageResult] = []

    async with http.build_client() as client:

        # ── Discover all URLs ──────────────────────────────────────────────
        all_urls: list[str] = []
        for seed in urls:
            if discover:
                discovered = await discover_urls(seed, client, depth=depth, store=store)
                all_urls.extend(discovered)
            else:
                all_urls.append(seed)

        # Final dedup
        seen: set[str] = set()
        deduped: list[str] = []
        for u in all_urls:
            norm = store.normalise(u)
            if norm not in seen:
                seen.add(norm)
                deduped.append(u)
                store.add_pending(u, clf.classify(u).tier.value)

        console.rule(f"[bold cyan]RAG Scraper — {len(deduped)} URLs queued[/bold cyan]")

        # ── Crawl concurrently ─────────────────────────────────────────────
        sem = asyncio.Semaphore(PIPELINE_CONCURRENCY)

        async def _crawl_one(url: str) -> PageResult:
            async with sem:
                return await crawl_url(url, store, output_dir, client)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            console=console,
            transient=False,
        ) as progress:
            task_id = progress.add_task("Crawling...", total=len(deduped))

            # Launch all tasks at once, progress updates as each completes
            async def _crawl_and_tick(url: str) -> PageResult:
                result = await _crawl_one(url)
                progress.advance(task_id)
                progress.update(
                    task_id,
                    description=f"[cyan]{url[:55]}[/cyan]",
                )
                if on_result:
                    on_result(result)
                return result

            results = list(
                await asyncio.gather(*[_crawl_and_tick(u) for u in deduped])
            )

    # ── Print summary ──────────────────────────────────────────────────────
    stats = store.stats()
    success = stats.get("success", 0)
    blocked = stats.get("blocked", 0)
    failed  = stats.get("failed", 0)
    total   = success + blocked + failed

    console.rule("[bold]Crawl Complete[/bold]")
    console.print(f"  [green]✓ Success:[/green]  {success} / {total}")
    console.print(f"  [red]✗ Blocked:[/red]  {blocked} / {total}")
    console.print(f"  [yellow]⚠ Failed:[/yellow]   {failed} / {total}")
    console.print(f"  [dim]Output:[/dim]     {output_dir / 'pages'}")
    console.print(f"  [dim]DB:[/dim]         {db_path}")

    store.close()
    return results
