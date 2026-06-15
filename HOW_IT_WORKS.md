# 🚀 How the System Works (Simple Explanation)

If you're wondering how the **Express Backend** talks to the **Python Crawler** using **BullMQ**, here is the "Explain Like I'm 5" version.

---

## 1. The Analogy: The Restaurant 🍔
To understand this system, imagine a busy restaurant:

1.  **The Waiter (Express API)**: Takes your order (URL to crawl) and writes it on a ticket.
2.  **The Ticket Rail (BullMQ/Redis)**: The waiter hangs the ticket on a rail. It stays there safely until a chef is ready.
3.  **The Chef (Express Worker)**: Picks up the ticket from the rail. He doesn't cook the food himself; he calls a **Specialist**.
4.  **The Specialist (Python Crawler)**: A separate kitchen that *only* knows how to turn raw websites into healthy "Markdown" text.
5.  **The Plate (Database)**: The final meal is served to the customer (The UI shows "Ready").

---

## 2. Step-by-Step Technical Flow

### Step A: Putting the job in the Queue
When you click **"Crawl"**, Express does this:
- It doesn't crawl yet.
- It just says: *"Hey Redis, remember that Bot #1 needs to crawl google.com."*
- This is **BullMQ**. It's a "Wait List" so the server doesn't get overwhelmed.

### Step B: The background Worker wakes up
The **Express Worker** is a background process that is always watching Redis.
- As soon as a new job appears, the Worker grabs it.
- It changes the Chatbot status in the database to **"CRAWLING"**.

### Step C: Poking Python (The Trigger)
Now, Express sends an HTTP "Poke" (a POST request) to Python.
- **Express says**: *"Yo Python! Here is a URL: `google.com`. Go turn it into Markdown and let me know when you're done. I'll wait."*
- **Python says**: *"On it! Give me a few seconds."*

### Step D: The Info (What Python gives back)
When Python finishes, it sends a package of data back to Express.
**Express gets exactly this:**
1.  **The Markdown**: The actual text content of every page (cleaned up for AI).
2.  **The Titles**: The name of each page.
3.  **The Links**: Every URL it successfully found.
4.  **The "Sad Path"**: A list of any links that failed (like 404 errors or blocked sites).

### Step E: Saving the Work
The Worker receives that big package from Python:
1.  It saves the **Markdown** into your database.
2.  It sends that text to the **Embedding Service** (to turn it into numbers for AI searching).
3.  It changes the status to **"READY"**.

---

## 3. Why do we do it this way?

| Why not just Python? | Why not just Express? | Why use BullMQ? |
| :--- | :--- | :--- |
| Express is much better at handling Users, Auth, and APIs. | Python has amazing libraries for scraping (like `crawl4ai`) that Node.js doesn't have. | Crawling is **slow**. If we didn't use a queue, the website would "freeze" while waiting for Python to finish. |

---

## Summary of "Who does what?"
*   **Express**: Handles the Users and the Database.
*   **BullMQ**: Handles the "Wait List" so nothing gets lost.
*   **Python**: Handles the messy work of reading websites.


---

## 🛠️ The Code: Step-by-Step

Here is exactly which code file is doing what:

### 1. The Waiter Adds the Ticket (Producer)
**File**: `express-backend/src/controllers/chatbot.controller.ts`
```typescript
// Line 41: Putting the job in the queue
await crawlQueue.add('crawl-job', {
    chatbotId: chatbot.id,
    url: websiteUrl
});
```

### 2. The Specialist is Poked (The Trigger)
**File**: `express-backend/src/queue/crawl.worker.ts`
```typescript
// Line 52: Express Worker calls the Python API
const response = await axios.post<CrawlResponse>(`${PYTHON_SERVICE_URL}/crawl`, {
    url,
    max_pages: maxPages
}, {
    headers: { 'X-Internal-Key': INTERNAL_API_KEY },
    timeout: 600000 // Waits for the big "package" to come back
});
```

### 3. Python Sends the Data Back
**File**: `python-crawlling-backend/main.py`
FastAPI automatically turns the Python **Return** into the **JSON package** that Express is waiting for.

```python
# Line 265: The endpoint that Express is "poking"
@app.post("/crawl", response_model=CrawlResponse)
async def crawl_endpoint(request: CrawlRequest):
    # ... does the heavy crawling work ...
    
    # Line 273: This return is the "package" sent back to Express
    return await crawl_multi_page(request.url, request.max_pages)
```

### 4. Express Unwraps the Package
**File**: `express-backend/src/queue/crawl.worker.ts`
```typescript
// Line 60: Express grabs the pages Python just sent
const pages = response.data?.pages;

// It then loops through them to save them to the database
for (const page of pages) {
    await prisma.crawlPage.create({
        data: { url: page.url, content: page.markdown }
    });
}
```

---

## 💡 Summary of "Who does what?"
*   **Express**: Handles the Users and the Database.
*   **BullMQ**: Handles the "Wait List" so nothing gets lost.
*   **Python**: Handles the messy work of reading websites.
