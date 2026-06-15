"""
md_cleaner.py — Markdown Post-Processing for RAG
=================================================
Takes raw markdown from any fetcher and produces clean, chunk-ready output:

  1. Strip residual navigation patterns (menus, breadcrumbs, cookie banners)
  2. Normalise headings, whitespace, lists
  3. Remove duplicate lines / repeated boilerplate
  4. Inject YAML frontmatter with crawl metadata
  5. Ensure a single H1 title exists

Output format is ready for direct ingestion into a RAG chunker.
"""

from __future__ import annotations

import hashlib
import re
import time
from datetime import datetime, timezone
from typing import Optional


# ── Navigation noise patterns ─────────────────────────────────────────────────

_NAV_LINE_PATTERNS: list[re.Pattern] = [
    # Short lines that are pure navigation (under 6 words, start with a link)
    re.compile(r"^\s*\[([^\]]{1,30})\]\([^)]+\)\s*$"),
    # Breadcrumb separators: Home > Page > Sub
    re.compile(r"^\s*[\w\s]+\s*(>|›|»|/)\s*[\w\s]+", re.UNICODE),
    # Cookie/GDPR boilerplate
    re.compile(r"(accept all cookies|cookie policy|privacy policy|gdpr|we use cookies)", re.I),
    # Social share buttons
    re.compile(r"^(share|tweet|pin it|like|follow us|subscribe)", re.I),
    # Skip to content link
    re.compile(r"^skip to (main )?content$", re.I),
    # "Posted by" / "Tagged" lines with no real content
    re.compile(r"^(posted by|tagged|categories|tags|filed under)[\s:]+", re.I),
    # Navigation arrows
    re.compile(r"^(← previous|next →|< back|back to top)", re.I),
    # Table of contents label
    re.compile(r"^(table of contents|contents|on this page)$", re.I),
]

# Lines that look like repeated boilerplate (exact duplicates across pages)
_BOILERPLATE_PHRASES: list[str] = [
    "all rights reserved",
    "copyright ©",
    "sign up for our newsletter",
    "follow us on",
    "subscribe to our",
    "read more",
    "see also",
    "advertisement",
    "sponsored",
    "click here to",
]


# ── Low-quality content detection ────────────────────────────────────────────

def _is_noise_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False  # blank lines are not noise — they structure the doc

    # Very short non-heading lines (1–2 words — likely nav items)
    if len(stripped.split()) <= 1 and not stripped.startswith("#"):
        return True

    for pattern in _NAV_LINE_PATTERNS:
        if pattern.search(stripped):
            return True

    stripped_lower = stripped.lower()
    for phrase in _BOILERPLATE_PHRASES:
        if phrase in stripped_lower:
            return True

    return False


# ── Heading normalisation ────────────────────────────────────────────────────

def _normalise_headings(lines: list[str]) -> list[str]:
    """
    Ensure heading levels are well-formed and consecutive.
    Fixes ATX headings that have trailing hashes or extra spaces.
    """
    normalised = []
    for line in lines:
        # Fix: "##Title" → "## Title"
        m = re.match(r"^(#{1,6})([^#\s].*)", line)
        if m:
            line = f"{m.group(1)} {m.group(2)}"
        # Remove trailing hashes: "## Title ##" → "## Title"
        line = re.sub(r"(#+)\s*$", "", line).rstrip()
        normalised.append(line)
    return normalised


# ── Deduplication ─────────────────────────────────────────────────────────────

def _deduplicate_lines(lines: list[str]) -> list[str]:
    """
    Remove exact duplicate non-blank lines that appear more than once.
    Preserves first occurrence.
    """
    seen: set[str] = set()
    result: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped and stripped in seen:
            continue
        if stripped:
            seen.add(stripped)
        result.append(line)
    return result


# ── Whitespace normalisation ──────────────────────────────────────────────────

def _normalise_whitespace(text: str) -> str:
    # Max 2 consecutive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Strip trailing spaces on each line
    lines = [l.rstrip() for l in text.splitlines()]
    return "\n".join(lines).strip()


# ── Title extraction ──────────────────────────────────────────────────────────

def _extract_or_add_title(lines: list[str], fallback_title: str) -> tuple[list[str], str]:
    """
    Ensure the document starts with a single H1.
    Returns (updated_lines, title_string).
    """
    for i, line in enumerate(lines):
        m = re.match(r"^#\s+(.+)", line.strip())
        if m:
            return lines, m.group(1).strip()

    # No H1 found — prepend one
    if fallback_title:
        lines = [f"# {fallback_title}", ""] + lines
        return lines, fallback_title

    return lines, "Untitled"


# ── YAML frontmatter ──────────────────────────────────────────────────────────

def _build_frontmatter(
    url: str,
    title: str,
    tier: str,
    method: str,
    char_count: int,
    crawled_at: Optional[float] = None,
) -> str:
    ts = crawled_at or time.time()
    iso = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]

    # Escape any quotes in title
    safe_title = title.replace('"', '\\"')

    return (
        f'---\n'
        f'url: "{url}"\n'
        f'title: "{safe_title}"\n'
        f'crawled_at: "{iso}"\n'
        f'tier: "{tier}"\n'
        f'method: "{method}"\n'
        f'char_count: {char_count}\n'
        f'url_hash: "{url_hash}"\n'
        f'---\n'
    )


# ── Public API ────────────────────────────────────────────────────────────────

def clean(
    markdown: str,
    url: str = "",
    title: str = "",
    tier: str = "A",
    method: str = "unknown",
    crawled_at: Optional[float] = None,
) -> str:
    """
    Full cleaning pipeline:
      1. Split into lines
      2. Remove navigation noise
      3. Normalise headings
      4. Deduplicate lines
      5. Ensure H1 title
      6. Inject YAML frontmatter
      7. Normalise whitespace

    Returns clean, frontmatter-annotated markdown string.
    """
    if not markdown or not markdown.strip():
        return ""

    lines = markdown.splitlines()

    # Step 1: Strip navigation noise
    cleaned_lines = [
        line for line in lines
        if not _is_noise_line(line)
    ]

    # Step 2: Normalise headings
    cleaned_lines = _normalise_headings(cleaned_lines)

    # Step 3: Deduplicate
    cleaned_lines = _deduplicate_lines(cleaned_lines)

    # Step 4: Ensure H1
    cleaned_lines, resolved_title = _extract_or_add_title(cleaned_lines, title)

    # Step 5: Join and normalise whitespace
    body = _normalise_whitespace("\n".join(cleaned_lines))

    if not body.strip():
        return ""

    # Step 6: Build frontmatter
    fm = _build_frontmatter(
        url=url,
        title=resolved_title,
        tier=tier,
        method=method,
        char_count=len(body),
        crawled_at=crawled_at,
    )

    return fm + "\n" + body + "\n"


def safe_filename(url: str, max_len: int = 120) -> str:
    """
    Convert a URL to a safe, readable filename stem.
    e.g. "https://docs.example.com/guide/intro" → "docs.example.com_guide_intro"
    """
    from urllib.parse import urlparse
    p = urlparse(url)
    path = p.path.strip("/").replace("/", "_") or "index"
    host = p.netloc.lstrip("www.")
    name = f"{host}_{path}" if path != "index" else host
    # Remove unsafe chars
    name = re.sub(r"[^\w\-.]", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    return name[:max_len]
