"""
fallback_fetcher.py — Tier 3: Lightweight Content Extraction
=============================================================
No browser required. Used when both HTTP and browser crawling fail or are
blocked. Converts raw HTML into clean text / basic markdown using:

  Primary:   trafilatura  (best readability extraction in Python)
  Secondary: readability-lxml (Mozilla Readability algorithm)
  Tertiary:  BeautifulSoup naive extraction (last resort)
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class FallbackSuccess:
    url: str
    markdown: str
    method: str   # "trafilatura" | "readability" | "beautifulsoup"
    char_count: int


@dataclass
class FallbackFailed:
    url: str
    reason: str


FallbackResult = FallbackSuccess | FallbackFailed


# ── Helper: basic HTML → markdown ────────────────────────────────────────────

def _html_to_basic_markdown(html: str) -> str:
    """Very naive HTML → markdown conversion for last-resort extraction."""
    import re
    from html import unescape

    text = html

    # Block-level to markdown
    text = re.sub(r"<h1[^>]*>(.*?)</h1>", r"\n# \1\n", text, flags=re.S | re.I)
    text = re.sub(r"<h2[^>]*>(.*?)</h2>", r"\n## \1\n", text, flags=re.S | re.I)
    text = re.sub(r"<h3[^>]*>(.*?)</h3>", r"\n### \1\n", text, flags=re.S | re.I)
    text = re.sub(r"<h[456][^>]*>(.*?)</h[456]>", r"\n#### \1\n", text, flags=re.S | re.I)
    text = re.sub(r"<p[^>]*>(.*?)</p>", r"\n\1\n", text, flags=re.S | re.I)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"<li[^>]*>(.*?)</li>", r"\n- \1", text, flags=re.S | re.I)
    text = re.sub(r"<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", r"[\2](\1)", text, flags=re.S | re.I)
    text = re.sub(r"<strong[^>]*>(.*?)</strong>", r"**\1**", text, flags=re.S | re.I)
    text = re.sub(r"<em[^>]*>(.*?)</em>", r"*\1*", text, flags=re.S | re.I)
    text = re.sub(r"<code[^>]*>(.*?)</code>", r"`\1`", text, flags=re.S | re.I)
    text = re.sub(r"<pre[^>]*>(.*?)</pre>", r"\n```\n\1\n```\n", text, flags=re.S | re.I)

    # Strip all remaining tags
    text = re.sub(r"<[^>]+>", "", text)

    # Cleanup
    text = unescape(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)

    return text.strip()


# ── Trafilatura extraction ────────────────────────────────────────────────────

def _try_trafilatura(html: str, url: str) -> str | None:
    """Extract main content using trafilatura (best in class)."""
    try:
        import trafilatura

        result = trafilatura.extract(
            html,
            url=url,
            output_format="markdown",
            include_comments=False,
            include_tables=True,
            include_links=True,
            include_images=False,
            no_fallback=False,
            favor_precision=True,
        )
        return result if result and len(result.strip()) > 100 else None
    except Exception:
        return None


# ── Readability-lxml extraction ───────────────────────────────────────────────

def _try_readability(html: str, url: str) -> str | None:
    """Extract main content using Mozilla Readability algorithm."""
    try:
        from readability import Document

        doc = Document(html)
        article_html = doc.summary(html_partial=True)

        if not article_html:
            return None

        # Convert article HTML to markdown
        md = _html_to_basic_markdown(article_html)
        title = doc.title()
        if title:
            md = f"# {title}\n\n{md}"

        return md if len(md.strip()) > 100 else None
    except Exception:
        return None


# ── BeautifulSoup fallback ────────────────────────────────────────────────────

def _try_beautifulsoup(html: str) -> str | None:
    """Last-resort extraction targeting article / main / body."""
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "lxml")

        # Remove noise tags
        for tag in soup(["script", "style", "nav", "footer", "aside",
                          "header", "form", "button", "iframe"]):
            tag.decompose()

        # Try to find main content container
        content = (
            soup.find("article")
            or soup.find("main")
            or soup.find(id=re.compile(r"content|main|article", re.I))
            or soup.find(class_=re.compile(r"content|main|article|post|entry", re.I))
            or soup.find("body")
        )

        if not content:
            return None

        text = _html_to_basic_markdown(str(content))
        return text if len(text.strip()) > 100 else None
    except Exception:
        return None


# ── Public API ────────────────────────────────────────────────────────────────

def extract(html: str, url: str = "") -> FallbackResult:
    """
    Extract main readable content from HTML without a browser.
    Tries trafilatura → readability → beautifulsoup in order.
    """
    if not html or len(html.strip()) < 50:
        return FallbackFailed(url=url, reason="HTML content is empty or too short")

    # 1. trafilatura
    result = _try_trafilatura(html, url)
    if result:
        return FallbackSuccess(
            url=url,
            markdown=result,
            method="trafilatura",
            char_count=len(result),
        )

    # 2. readability-lxml
    result = _try_readability(html, url)
    if result:
        return FallbackSuccess(
            url=url,
            markdown=result,
            method="readability",
            char_count=len(result),
        )

    # 3. BeautifulSoup last resort
    result = _try_beautifulsoup(html)
    if result:
        return FallbackSuccess(
            url=url,
            markdown=result,
            method="beautifulsoup",
            char_count=len(result),
        )

    return FallbackFailed(url=url, reason="All fallback extraction methods failed")
