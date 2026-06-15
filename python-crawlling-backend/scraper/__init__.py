"""
RAG Pipeline Web Scraper
========================
4-tier fallback crawler that produces clean markdown ready for RAG indexing.

Tier 1 — HTTP-first (httpx + sitemap/RSS)
Tier 2 — Browser rendering (Crawl4AI / Playwright)
Tier 3 — Lightweight fallback (trafilatura / readability-lxml)
Tier 4 — Block handling (mark & skip, no aggressive retries)
"""

__version__ = "1.0.0"
