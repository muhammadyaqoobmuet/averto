"""
classifier.py — Site Tier Classification
=========================================
Classifies URLs into tiers to determine the optimal crawling strategy.

Tier A (safe)     → HTTP-first crawling
Tier B (JS-heavy) → Browser rendering after HTTP failure
Tier C (protected)→ Skip / mark blocked immediately
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from urllib.parse import urlparse


class Tier(str, Enum):
    A = "A"  # Static / documentation / blogs — HTTP-first
    B = "B"  # JS-heavy SPAs — browser after HTTP failure
    C = "C"  # Cloudflare / CAPTCHA / aggressive WAF — skip


@dataclass
class Classification:
    tier: Tier
    reason: str


# ─── Tier A patterns ─────────────────────────────────────────────────────────
_TIER_A_DOMAINS: list[str] = [
    "wikipedia.org",
    "github.com",
    "gitlab.com",
    "readthedocs.io",
    "readthedocs.org",
    "mkdocs.org",
    "gitbook.io",
    "medium.com",
    "substack.com",
    "dev.to",
    "hashnode.com",
    "blogger.com",
    "wordpress.com",
    "ghost.io",
    "pages.github.com",
    "netlify.app",
    "vercel.app",
]

_TIER_A_PATH_PATTERNS: list[re.Pattern] = [
    re.compile(r"^/docs/", re.I),
    re.compile(r"^/documentation/", re.I),
    re.compile(r"^/blog/", re.I),
    re.compile(r"^/wiki/", re.I),
    re.compile(r"^/guide/", re.I),
    re.compile(r"^/tutorial/", re.I),
    re.compile(r"^/api/", re.I),
    re.compile(r"^/reference/", re.I),
]

_TIER_A_SUBDOMAINS: list[str] = [
    "docs.",
    "blog.",
    "wiki.",
    "help.",
    "support.",
    "learn.",
    "developer.",
    "dev.",
    "api.",
]

# ─── Tier C patterns ─────────────────────────────────────────────────────────
_TIER_C_DOMAINS: list[str] = [
    "cloudflare.com",
    "recaptcha.google.com",
    "hcaptcha.com",
    "distil.it",
    "imperva.com",
    "perimeterx.com",
    "datadome.co",
    "akamai.com",
]

_TIER_C_SIGNALS: list[str] = [
    "captcha",
    "ddos-guard",
    "sucuri.net",
    "incapsula",
    "bot-manager",
    "antibot",
    "shield.io",
]

# ─── Tier B patterns (JS-heavy frameworks) ────────────────────────────────────
_TIER_B_DOMAINS: list[str] = [
    "twitter.com",
    "x.com",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "tiktok.com",
    "youtube.com",
    "reddit.com",
    "notion.so",
    "notion.site",
    "app.gitbook.com",
    "figma.com",
    "miro.com",
    "atlassian.net",
    "monday.com",
    "airtable.com",
    "webflow.io",
    "squarespace.com",
]


def classify(url: str) -> Classification:
    """
    Classify a URL into a crawling tier.

    Returns a Classification with .tier (Tier.A/B/C) and .reason (str).
    """
    parsed = urlparse(url.lower())
    host = parsed.netloc.lstrip("www.")
    path = parsed.path

    # ── Tier C — check first (bail-out) ─────────────────────────────────────
    for c_domain in _TIER_C_DOMAINS:
        if c_domain in host:
            return Classification(Tier.C, f"Known protection service: {c_domain}")

    for signal in _TIER_C_SIGNALS:
        if signal in host:
            return Classification(Tier.C, f"WAF/bot-protection signal in host: {signal}")

    # ── Tier A — static/documentation domains ───────────────────────────────
    for a_domain in _TIER_A_DOMAINS:
        if host.endswith(a_domain) or host == a_domain:
            return Classification(Tier.A, f"Known static/doc domain: {a_domain}")

    for subdomain in _TIER_A_SUBDOMAINS:
        if host.startswith(subdomain):
            return Classification(Tier.A, f"Documentation subdomain: {subdomain}")

    for pattern in _TIER_A_PATH_PATTERNS:
        if pattern.match(path):
            return Classification(Tier.A, f"Documentation path pattern: {pattern.pattern}")

    # ── Tier B — JS-heavy SPA domains ───────────────────────────────────────
    for b_domain in _TIER_B_DOMAINS:
        if host.endswith(b_domain) or host == b_domain:
            return Classification(Tier.B, f"Known JS-heavy/SPA domain: {b_domain}")

    # ── Default: Tier A (optimistic — try HTTP first) ────────────────────────
    return Classification(Tier.A, "Default: HTTP-first (unknown site)")


def describe_tier(tier: Tier) -> str:
    descriptions = {
        Tier.A: "Tier A — Static/docs — HTTP fetch preferred",
        Tier.B: "Tier B — JS-heavy SPA — browser fallback enabled",
        Tier.C: "Tier C — Protected/CAPTCHA — will be skipped",
    }
    return descriptions[tier]
