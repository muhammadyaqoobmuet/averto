Goal

The system must crawl websites and extract clean markdown content for RAG indexing using minimal resources and no paid proxy infrastructure.

Core Constraint
No residential proxies
No paid anti-bot services
Only use existing compute (AWS/DO/VPS)
Assume some sites will block automated access
High-level Strategy

The system must NOT try to “bypass” protection systems.

Instead, it must:

Maximize success on accessible pages
Minimize triggering bot detection
Gracefully degrade when blocked
Crawling Priority Order
Step 1 — HTTP-first fetch (default)

Always attempt lightweight HTTP fetching before using a browser.

Use:

HTTP client (httpx / requests)
sitemap.xml if available
RSS feeds if available

Rules:

Respect rate limits (2–6s delay between requests)
Max concurrency: 2–3 requests
Cache all successful responses

If successful:
→ extract HTML → convert to markdown → store

Step 2 — Browser rendering (only if needed)

If HTTP fetch fails or content is JavaScript-rendered:

Use Playwright-based crawler (e.g., Crawl4AI).

Rules:

Slow navigation (no rapid page jumps)
Wait for full page load
Simulate normal browsing delays
Reuse browser sessions when possible

If successful:
→ extract DOM → convert to markdown → store

Step 3 — Fallback extraction (no browser dependency)

If browser crawling fails or site is blocked:

Use lightweight readability-based extraction:

trafilatura
readability-lxml
boilerplate removal tools

If successful:
→ extract main content → convert to markdown → store

Step 4 — Block handling policy

If a page shows signs of blocking:

403 Forbidden
CAPTCHA / “Just a moment…”
Cloudflare challenge page

Then:

Do NOT retry aggressively
Mark URL as “blocked”
Skip for current crawl cycle
Optionally retry in a future batch with lower frequency
Crawling Rules (anti-blocking behavior)

The system must follow:

No burst crawling
No parallel heavy browsing sessions
Random delay between requests (2–8 seconds)
Maximum depth crawl: 1–2 levels unless explicitly required
Prefer sitemap-based discovery over link scraping
Deduplicate URLs before crawling
Site Classification Logic
Tier A (safe)
documentation sites
blogs
static websites

→ Use HTTP-first crawling

Tier B (JS-heavy)
React / Next.js / SPA sites

→ Use browser rendering only after HTTP failure

Tier C (protected)
Cloudflare “Just a moment…”
CAPTCHA / bot verification systems
aggressive WAF protection

→ Do not attempt repeated bypass
→ mark as blocked and skip

Output Requirements

For every successful page:

Clean markdown output only
Remove navigation, ads, scripts
Keep main article content
Store chunks for RAG indexing
Failure Philosophy

The system must accept:

partial coverage is acceptable
100% crawling success is NOT required
stability > completeness