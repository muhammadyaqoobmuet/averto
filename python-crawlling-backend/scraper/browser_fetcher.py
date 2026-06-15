"""
browser_fetcher.py — Browser Rendering via Crawl4AI
============================================================
Only invoked when HTTP-first fetch fails or detects JS-only content.

Rules (from Goal.md):
  • Slow navigation — no rapid page jumps
  • Wait for full page load (network idle)
  • Simulate normal browsing delays (2–8s)
  • Reuse browser sessions when possible
  • Return fit_markdown (pruning-filtered) for RAG quality
"""

from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass
from typing import Optional

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CrawlerRunConfig,
    CacheMode,
)
from crawl4ai.content_filter_strategy import PruningContentFilter
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

# ── Constants ─────────────────────────────────────────────────────────────────

MIN_DELAY = 2.0
MAX_DELAY = 8.0

# Tags to strip — pure navigation/ads noise
_EXCLUDED_TAGS = [
    "nav", "footer", "aside", "header",
    "script", "style", "noscript",
    "iframe", "form", "button",
    "[class*='cookie']", "[class*='banner']",
    "[class*='popup']", "[id*='cookie']",
    "[id*='modal']",
]

# ── Result types ──────────────────────────────────────────────────────────────


@dataclass
class BrowserSuccess:
    url: str
    markdown: str          # fit_markdown (filtered)
    raw_markdown: str      # raw_markdown (unfiltered)
    title: str
    char_count: int


@dataclass
class BrowserBlocked:
    url: str
    reason: str


@dataclass
class BrowserFailed:
    url: str
    reason: str


BrowserResult = BrowserSuccess | BrowserBlocked | BrowserFailed

# ── Block detection signals ───────────────────────────────────────────────────

_BLOCK_SIGNALS_IN_MARKDOWN = [
    "just a moment",
    "checking your browser",
    "enable javascript and cookies",
    "ddos protection by cloudflare",
    "please complete the security check",
    "access denied",
    "captcha",
]


def _is_browser_blocked(content: str) -> tuple[bool, str]:
    lower = content[:3000].lower()
    for signal in _BLOCK_SIGNALS_IN_MARKDOWN:
        if signal in lower:
            return True, f"Browser block signal: '{signal}'"
    if len(content.strip()) < 100:
        return True, "Content too short — likely blocked or empty page"
    return False, ""


# ── Browser config (reusable) ─────────────────────────────────────────────────


def _build_browser_config() -> BrowserConfig:
    return BrowserConfig(
        headless=True,

        enable_stealth=True,
        viewport_width=1280,
        viewport_height=900,
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        verbose=False,
    )


def _build_run_config() -> CrawlerRunConfig:
    md_generator = DefaultMarkdownGenerator(
        content_filter=PruningContentFilter(
            threshold=0.45,
            threshold_type="fixed",
            min_word_threshold=10,
        ),
        options={
            "ignore_links": False,
            "ignore_images": False,
            "image_alt_text": True,
            "mark_code": True,
        },
    )

    return CrawlerRunConfig(
        markdown_generator=md_generator,
        excluded_tags=_EXCLUDED_TAGS,
        magic="True",
        remove_overlay_elements=True,
        remove_forms=True,
        exclude_external_links=False,
        page_timeout=60_000,      # 60s for JS-heavy sites
        wait_for="css:body",      # Wait until body element is present
        cache_mode=CacheMode.BYPASS,
        screenshot=False,
    )


# ── Single URL fetch ──────────────────────────────────────────────────────────


async def fetch_url(url: str) -> BrowserResult:
    """
    Render a page with Crawl4AI and return high-quality filtered markdown.
    Includes a random pre-fetch delay to simulate human navigation.
    """
    await asyncio.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    browser_cfg = _build_browser_config()
    run_cfg = _build_run_config()

    try:
        async with AsyncWebCrawler(config=browser_cfg) as crawler:
            raw = await crawler.arun(url=url, config=run_cfg)

            # Unwrap container if needed
            result = raw[0] if hasattr(raw, "__getitem__") else raw

            if not result or not result.success:
                err = getattr(result, "error_message", "Unknown error")
                return BrowserFailed(url=url, reason=f"Crawl failed: {err}")

            # Extract markdown
            md_obj = getattr(result, "markdown", None)
            if md_obj is None:
                return BrowserFailed(url=url, reason="No markdown object returned")

            # Try fit_markdown first (pruning-filtered), fall back to raw
            if hasattr(md_obj, "fit_markdown") and md_obj.fit_markdown:
                fit_md = md_obj.fit_markdown
            elif hasattr(md_obj, "raw_markdown") and md_obj.raw_markdown:
                fit_md = md_obj.raw_markdown
            else:
                fit_md = str(md_obj) if md_obj else ""

            raw_md = getattr(md_obj, "raw_markdown", fit_md) or fit_md

            # Block check
            blocked, reason = _is_browser_blocked(fit_md)
            if blocked:
                return BrowserBlocked(url=url, reason=reason)

            title = ""
            meta = getattr(result, "metadata", None)
            if isinstance(meta, dict):
                title = meta.get("title", "")
            elif hasattr(meta, "title"):
                title = meta.title or ""

            return BrowserSuccess(
                url=url,
                markdown=fit_md,
                raw_markdown=raw_md,
                title=title,
                char_count=len(fit_md),
            )

    except Exception as exc:
        return BrowserFailed(url=url, reason=f"{type(exc).__name__}: {exc}")


# ── Batch fetch (sequential to avoid hammering) ───────────────────────────────


async def fetch_urls_sequential(
    urls: list[str],
    on_result=None,
) -> list[BrowserResult]:
    """
    Fetch multiple URLs one at a time (browser sessions are heavy).
    Calls `on_result(url, result)` after each fetch if provided.
    """
    results: list[BrowserResult] = []
    for url in urls:
        result = await fetch_url(url)
        results.append(result)
        if on_result:
            on_result(url, result)
    return results
