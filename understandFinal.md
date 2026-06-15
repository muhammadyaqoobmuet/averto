# 🎓 Python Crawler: The Final Understanding Guide

Since you are coming from a Javascript/TypeScript background, this guide will explain the **Python Crowling Backend** by comparing it to things you already know, while detailing the exact flow of data through every file.

---

## 1. The Global Entry Point: `main.py`
This is your "Server File" (like `app.ts` in Express).

*   **Technology**: Uses **FastAPI** (think of it as Express for Python).
*   **The Flow**:
    1.  Express sends a POST request to `/crawl`.
    2.  `main.py` receives the URL and `max_pages`.
    3.  It uses **Pydantic Models** (`CrawlRequest`) to validate data. This is exactly like **Zod** in TypeScript—if the data is wrong, it rejects it immediately.
    4.  It calls `crawl_multi_page`, which is the gatekeeper to the deeper logic.
    5.  **JS Cheat Sheet**: 
        *   `getattr(obj, "key", default)` is like `obj?.key ?? default`.
        *   `async def` is like `async function`.
        *   `await` works exactly the same.

---

## 2. The Command Center: `scraper/pipeline.py`
This is the "Logic Orchestrator." It doesn't do the crawling itself; it tells other files when it's their turn.

*   **The 4-Step Strategy**: 
    Every URL goes through this "Waterflow" logic:
    1.  **Tier Check**: It asks `classifier.py` if the site is dangerous/blocked.
    2.  **HTTP First**: It calls `http_fetcher.py` (The "Sprinter"). It's extremely fast but doesn't handle JS.
    3.  **Browser Fallback**: If HTTP fails (blocked or empty), it calls `browser_fetcher.py` (The "Tank"). This starts a real Headless Chrome browser.
    4.  **Last Resort**: If both fail, it uses `fallback_fetcher.py` to try and scrape whatever raw HTML it can find.

---

## 3. The Brain: `scraper/url_store.py`
This is the most important file for reliability. It manages a **SQLite** database.

*   **Why it exists**: If you are crawling 200 pages and the power goes out at page 100, you don't want to start over.
*   **Functionality**:
    *   **Normalisation**: It turns `HTTPS://google.com/` and `http://google.com` into the same string so you don't crawl them twice.
    *   **Locking**: It uses a `threading.Lock()`. In Python, unlike Node.js, we have to manually make sure two "threads" don't write to the database at the exact same millisecond.
    *   **Persistence**: It saves the `status` (success, blocked, failed) so the `pipeline.py` can skip bad links.

---

## 4. The Fetchers (The Muscles)

### A. `scraper/http_fetcher.py`
*   **Job**: Uses a library called `httpx` to send raw GET requests.
*   **Logic**: It mimics a real browser header (User-Agent) to trick websites into thinking it's a human, but it doesn't execute Javascript.

### B. `scraper/browser_fetcher.py`
*   **Job**: Uses `crawl4ai` (which uses Playwright) to launch a Headless browser.
*   **Logic**: It "waits" for the page to render. It can click things, scroll down, and wait for React/Vue components to load. This is why it's slower but more powerful.

---

## 5. The Polisher: `scraper/md_cleaner.py`
Websites are messy. They have ads, navbars, and footers that AI doesn't need.

*   **Cleanup Steps**:
    1.  **Noise Removal**: It uses Regex and word-counts to detect "junk" lines (like "Click here to login" or "Privacy Policy").
    2.  **Formatting**: It makes sure the Markdown follows proper heading hierarchies (# H1, ## H2).
    3.  **Sanitization**: It removes extra whitespace and empty links.
*   **Result**: You get a text file that is 100% focused on the actual content, which makes your RAG (Retrieval Augmented Generation) much smarter.

---

## 6. How Python "Sends back" to Express
Since Python is a separate service, it doesn't "push" to Express. It responds to the "Poke."

1.  **The Loop ends**: Once `pipeline.py` finishes its list of URLs, it gathers all results into a list of objects.
2.  **The Package**: `main.py` takes that list and wraps it in a `CrawlResponse`.
3.  **HTTP Response**: FastAPI converts the Python objects into a **JSON string** automatically.
4.  **Arrival**: The Express `axios` call receives this JSON, and your TypeScript code takes over to save it to Postgres.

---

## 🚀 Deep Dive: Understanding the "Chunks" of Code

Here is the explanation for the most important technical patterns you'll see in the code.

### 1. The "Data Guard" (Pydantic Models)
In `main.py`, you see classes like `class CrawlRequest(BaseModel)`.
*   **What it does**: This ensures that if Express sends a string where it should be a number (like `max_pages: "hello"`), Python catches it immediately.
*   **Why it's cool**: It generates the "Help" page (Swagger UI) automatically and ensures your data is clean before it ever reaches your logic.

### 2. The "Bouncer" (Asyncio Semaphore)
In `main.py` and `pipeline.py`, you'll see `sem = asyncio.Semaphore(4)`.
*   **What it does**: This limits the code to only doing 4 things at the exact same time.
*   **Why it's important**: If you try to open 100 Chrome browsers at once, your server will crash. The Semaphore makes the other 96 tasks "wait in line" until one of the first 4 finishes.

### 3. The "Safe Brain" (SQLite + WAL Mode)
In `url_store.py`, there is a line: `conn.execute("PRAGMA journal_mode=WAL;")`.
*   **What it does**: **WAL** stands for *Write-Ahead Logging*. 
*   **Why it's important**: SQLite is usually "one person at a time." WAL mode allows one person to write data (the crawler) while many other people are reading data (the API) at the same time without locking error.
*   **The Lock**: You also see `self._lock = Lock()`. In JS, you have an Event Loop, but Python has "Threads." We use `Lock()` to make sure two threads don't accidentally try to write to the same database row at the same microsecond.

### 4. The "Optional Chaining" Python Style
You added a comment about `getattr`. This is a classic pattern:
```python
title = getattr(result, "metadata", {}).get("title") or "No Title"
```
*   **The JS Version**: `result?.metadata?.title || "No Title"`
*   **How it works**: `getattr` asks: "Does this object have a property called 'metadata'?" If not, give me a empty dictionary `{}`. Then `.get("title")` asks: "Does that dictionary have a title?" if not, give me `None`. Finally, `or "No Title"` handles the fallback.

### 5. The "Stealth Tank" (Crawl4AI Config)
In `browser_fetcher.py` and `main.py`, the `BrowserConfig` handles the heavy lifting:
```python
browser_config = BrowserConfig(
    headless=True,
    enable_stealth=True,  # Bypasses "I am a robot" detectors
    ignore_https_errors=True,
    extra_args=["--no-sandbox"], # Critical for running inside Docker/Linux
)
```
*   **Stealth Mode**: This injects tiny pieces of Javascript that make the Headless Chrome browser look like a real person using a mouse. Without this, many websites (like Amazon or LinkedIn) would block you instantly.

### 6. The "Noise Filter" (Regex in Cleaner)
In `md_cleaner.py`, you'll see complex things like `re.compile(r"...")`.
*   **What it does**: It looks for patterns like `[Log In]` or `| Privacy Policy |`.
*   **The Logic**: If a line of text is very short (1-2 words) and matches these patterns, the cleaner "throws it in the trash." This prevents your AI from reading 50 "Sign Up" buttons instead of the actual article.

---

## 7. Python Concepts for JS Experts
| Feature | JavaScript / TS | Python |
| :--- | :--- | :--- |
| **Objects** | `{ name: "Jack" }` | `{"name": "Jack"}` (Dictionaries) |
| **Variables** | `const x = 10;` | `x = 10` |
| **Imports** | `import { x } from './y'` | `from y import x` |
| **Null** | `null` / `undefined` | `None` |
| **Printing** | `console.log()` | `print()` or `console.log()` (via Rich) |
| **Callbacks** | `onSuccess(() => ...)` | `def on_success(): ...` (Passed as argument) |

---

## Summary of the "Chain Reaction"
1. **Express** -> 2. **FastAPI (`main.py`)** -> 3. **Pipeline** -> 4. **Classifier** -> 5. **URL Store (Check DB)** -> 6. **Fetchers (HTTP or Browser)** -> 7. **MD Cleaner** -> 8. **URL Store (Save to DB)** -> 9. **Return JSON** -> 10. **Express Persistence**.
