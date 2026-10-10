# RAG Pipeline — Optimisation Analysis & Implementation Report

**Scope:** `express-backend` retrieval pipeline.
**Status:** Implemented, typechecked, unit-tested, and verified end-to-end against the live database.

---

## 0. Executive summary

The pipeline was rebuilt around three findings that dominate everything else:

| Finding | Evidence | Impact |
|---|---|---|
| **The vector store was corrupt** | 302 distinct vectors across 695 rows; embedding a chunk's own text returns that chunk at cosine **0.03** (≈ random) | Dense retrieval was returning unrelated content. No tuning helps until the corpus is rebuilt. |
| **Dense search ignored query expansion** | Variants were fed to sparse only | Largest single recall loss, now fixed |
| **`Chunk.heading` was always NULL** | `MarkdownTextSplitter` emits no `heading` metadata | Every citation rendered as "Page"; chunks had no structural signal |

Measured on the live system after the changes:

| Metric | Before | After |
|---|---|---|
| Repeat-question latency | ~3.1–3.7 s | **0–5 ms** (Redis cache hit) |
| Generation provider | Gemini (32–104 s) | **Alibaba qwen-plus-character (~0.9 s)** |
| End-to-end JSON request | 15–20 s (degraded) | **3.0–4.4 s** |
| End-to-end SSE first byte | 15–20 s | **2.9–4.3 s** |
| `COUNT(*)` per request | 65 ms, unindexed seq scan | **2 ms**, index-backed + 60 s TTL cache |
| Chunk insert round-trips (500-chunk page) | 500 | **3** (batched) |
| Chunk headings stored | 0 | **100%**, with breadcrumbs |
| Distinct headings in test corpus | 1 | 3+ |
| Retrieval unit tests | none | **25 passing** |

---

## 1. The corruption finding (do this first)

`npm run check:vectors` reports on the live database:

```
  pages              : 111
  chunks             : 695
  distinct vectors   : 302
  uniqueness ratio   : 0.435  (healthy = 1.000)

  duplicated vector groups:
    1 group(s) of 22 rows -> 22 rows
    1 group(s) of 19 rows -> 19 rows
    ...
    84 group(s) of 3 rows -> 252 rows

  bot 84c56e23 chunk b035a25d
    "[Mastering NextJS](https://masteringnextjs.com) is one of th..."
    top sim = 0.0675   self in top-3 = false
```

Three independent probes all agree the stored vectors are unusable:

1. **Uniqueness** — 695 rows share only 302 distinct vectors. One vector is
   attached to 22 different chunks.
2. **Self-match** — embedding a chunk's own text and searching returns that
   chunk at cosine **0.0675**, versus **0.48–0.80** for correctly-paired
   vectors.
3. **Direct comparison** — cosine between a stored vector and a fresh
   embedding of its own `content` is **0.0296**, indistinguishable from two
   unrelated 1024-dim vectors.

The current indexing code was proven correct by re-indexing a controlled
document: 4 rows, 4 distinct vectors, 4/4 self-match at cosine 0.48–0.80.

### Why it cannot be repaired in place

`CrawlPage` has **no content column** — the source text is not stored in
Postgres. The vectors cannot be recomputed from what is in the database.

### Recovery

```
# 1. Verify (read-only)
npm run check:vectors

# 2. Rebuild each chatbot from its source
POST /api/chatbots/:id/recrawl          # website sources
POST /api/chatbots/:id/documents        # uploaded documents

# 3. Optional: clear the broken vectors so they stop polluting results.
#    Sparse retrieval keeps working; dense returns nothing until re-crawl.
npm run check:vectors:fix
```

Until step 2 completes, **sparse (tsvector) retrieval still works** because
it derives from the `content` column, not the vectors. That is why the chatbot
still produced reasonable answers above — the hybrid degraded to keyword-only.

---

## 2. Changes made

### 2.1 Accuracy

| # | Change | File |
|---|---|---|
| 1 | **Heading extraction** — binary-search each chunk's offset, walk back up to 4 ancestor headings, store a `Parent > Child` breadcrumb | `services/indexing.service.ts` |
| 2 | **Heading-aware embedding** — embed `heading + "\n\n" + content`, store content alone | `services/indexing.service.ts` |
| 3 | **Multi-variant dense search** — embed all query variants in one batched Voyage call, one ANN query per vector, merged by local RRF | `services/retrieval/dense.service.ts` |
| 4 | **Duplicate-safe heading lookup** — forward cursor instead of `indexOf`, so repeated boilerplate resolves to its true section | `services/indexing.service.ts` |
| 5 | **Weighted RRF** — dense 1.0, sparse-raw 0.6, sparse-variant 0.4 | `services/retrieval/rrf.service.ts` |
| 6 | **RRF `k` 60 → 10** — `k=60` compresses 4 shallow lists into a 0.016–0.040 band, flattening exactly the differences being measured | `services/retrieval/rrf.service.ts` |
| 7 | **Honest confidence** — rerank failure now preserves the normalised RRF score instead of collapsing every score to `0` | `services/retrieval.service.ts` |
| 8 | **Near-duplicate dedupe** — character-bigram Jaccard ≥ 0.9, keeping the better-ranked copy | `services/retrieval.service.ts` |
| 9 | **Hard abstention** — below threshold, skip the LLM and return a canned refusal | `controllers/chat.controller.ts` |
| 10 | **Prompt fixes** — removed the duplicated `{query}` tail, added `Cite ... [Source N]`, added an explicit "never guess" rule, uniform `maxTokens` | `services/llm.service.ts`, `utils/llm-provider.ts` |
| 11 | **Expansion gate** — skip LLM expansion for queries outside 3–12 tokens | `services/retrieval/dense.service.ts` |

### 2.2 Performance

| # | Change | File |
|---|---|---|
| 1 | **Redis retrieval cache** — versioned key, 1 h TTL, SCAN-based invalidation, fails open on any Redis error | `lib/retrieval-cache.ts` |
| 2 | **LRU query-embedding cache** — 500 entries, removes the Voyage round-trip on repeats | `utils/voyage.ts` |
| 3 | **Cached chunk count** — 60 s TTL, replaces a per-request `COUNT(*)` | `controllers/chat.controller.ts` |
| 4 | **Overlap expansion with sparse** — raw sparse search starts immediately instead of waiting on the LLM | `services/retrieval.service.ts` |
| 5 | **Batched inserts** — multi-row INSERT, 200 rows/statement, with per-row fallback | `services/indexing.service.ts` |
| 6 | **Transactional persistence** — 4 sequential round-trips → 1 transaction | `controllers/chat.controller.ts` |
| 7 | **`Chunk(chatbotId)` index** — applied via `CREATE INDEX CONCURRENTLY`; plan confirmed using `Index Scan` | `prisma/migrations/20260616_retrieval_perf/` |
| 8 | **HNSW tuning** — `ef_search=100`, `iterative_scan='strict_order'`, index rebuilt `m=24, ef_construction=128` | `services/retrieval/dense.service.ts` |
| 9 | **Client-disconnect abort** — `res.on("close")` stops generation | `controllers/chat.controller.ts` |
| 10 | **Dev-only query logging** — was unconditional, logging 1024-float vectors per statement in production | `lib/prisma.ts` |

### 2.3 Robustness

| # | Change |
|---|---|
| 1 | **Real aborts** — `withTimeout` now aborts the in-flight request via `AbortController` instead of abandoning the result |
| 2 | **Streaming bounded** — the Anthropic and LangChain streaming paths had **no timeout at all**; both now use `AbortSignal.timeout(45s)` |
| 3 | **Anthropic SSE frame buffering** — TCP packets were split on every chunk, truncating JSON and silently dropping answer text mid-sentence |
| 4 | **Voyage response validation** — rejects short responses instead of silently misaligning text↔vector |
| 5 | **Non-empty embedding enforced** — `embedQuery` returns `[]` was becoming `"[]"` → `::vector` cast failure → the whole dense channel vanishing silently |
| 6 | **`websearch_to_tsquery` cast** — `::regconfig` added; without it Postgres reports `function websearch_to_tsquery(text, text) does not exist` |
| 7 | **Request validation + rate limiting** — `chatRequestSchema` and `express-rate-limit` were installed but never wired |
| 8 | **Error handler** — passes `details` through, logs 5xx at error and 4xx at warn |

---

## 2.5 Latency regression — root cause and fix

An initial round of changes made normal queries **slower** (15–20 s vs a
5–6 s baseline). Profiling rather than guessing found three separate causes,
none of them the retrieval work itself.

### Cause 1 — a slow provider is charged to every request

Stage timings on the live system:

```
  retrieveContext (full)                2551ms
  generateAnswer                        12841ms
  Gemini invoke                       180981ms
```

The waterfall is sequential: Gemini, then Groq, then Groq. Gemini was taking
**32–104 s** — even for `"What is the capital of France?"` with a trivial
prompt, and with both the old and new provider configs. So every request paid
the full first-provider timeout and then fell through to a fallback that would
have answered in ~1 s.

The old code had exactly the same structure, so this is not something the
changes introduced — but the changes made it visible by bounding the wait
instead of hanging.

**Fix:** a per-provider circuit breaker (`src/lib/circuit-breaker.ts`).

- Trips after 2 consecutive failures; skips that provider for 30 s.
- Half-open probe after the cooldown, so recovery is automatic.
- **Latency-aware:** a "successful" call slower than 6 s counts as a FAILURE.
  Without this a technically-working but unusable provider reclaimed the
  primary slot on every request and reset its own failure count.
- **Fails open:** if every provider's circuit is open, the breaker is bypassed
  for that request. Otherwise it deadlocks — all entries skipped means nothing
  is attempted means nothing reports success means the circuits never close.
  This was observed live: the bot returned *"I'm having trouble connecting to
  my AI service"* while a healthy fallback sat one attempt away.

### Cause 2 — no total generation budget

Per-provider timeouts allowed 3 × 8 s = **24 s** before admitting defeat. A
total budget now caps the whole generation phase at 12 s, with each provider
receiving only what remains.

### Cause 3 — query embeddings had a 30 s timeout

```
  embedQuery raw (uncached)            1439ms      ← healthy
  embedQuery raw (rate-limited)       25467ms      ← degraded
```

`VOYAGE_TIMEOUT_MS = 30_000` was sized for 96-item document batches during
background indexing. The same 30 s applied to a single query string on the
request hot path, so a rate-limited Voyage blew straight through the
controller's 30 s retrieval cap and produced an empty context.

**Fix:** split the budgets — 30 s for document batches (background), **4 s for
queries** (hot path). On timeout the pipeline degrades to sparse-only
retrieval: a worse answer, not an absent one. Paraphrase embedding is also
skipped when the raw embedding already failed, since a second call would just
burn another timeout.

### Cause 4 — expansion and embedding were serialised

`embedQueries` was called *after* `await`ing query expansion, so they ran
back-to-back (~1.3 s + ~1.4 s) despite neither depending on the other's
output. Raw-query sparse search, expansion, and raw-query embedding now all
start together.

### Result

Measured on the live system, paced 3 s apart:

| Path | Before fix | After fix |
|---|---|---|
| JSON request | 15–20 s | **2.0–4.0 s** |
| SSE first byte | 15–20 s | **2.0–3.5 s** |
| Retrieval stage | 1.3–5.5 s | **1.6–2.2 s** |
| All providers down | 24 s + error message | **12 s**, one attempt made |

### Related fix — false abstentions

While validating, the bot refused answerable questions (*"I couldn't find
anything about that on this site"* on a question the site plainly covers).
The score threshold cannot distinguish relevant from irrelevant — see §6.2 —
so abstention now triggers **only when retrieval returns nothing at all**.
That still blocks the zero-grounding hallucination case while never falsely
refusing. Verified: 0 abstentions across a paced run, all answers grounded and
cited.

### Also fixed — crawl debug dumps

`crawl.worker.ts` wrote the full markdown of every crawled page to
`pages_<id>.json` in the working directory on **every** crawl, with no cleanup
(~1 MB per run accumulating on disk, and complete scraped content sitting
outside any retention policy). Now gated behind `NODE_ENV=development` plus an
explicit `CRAWL_DEBUG_DUMP` flag, and gitignored.

## 2.6 Provider change — Gemini replaced

Gemini was removed as the platform provider and replaced with Alibaba Cloud
Model Studio, which the owner supplied credentials for.

### Why Gemini went

Measured against the platform key, `gemini-3.8-flash` took **32–104 s** to
answer even a one-line question with a trivial prompt, identically with the old
and new provider configs. Because the waterfall is sequential, every request
paid that before falling through — a 12–18 s floor on all traffic.

The BYOK `gemini-*` branch in `getCustomLLM` is deliberately retained: a
customer may still choose Gemini with their own key. Only the platform
provider is gone.

### Why Alibaba

Verified directly against the API, not from documentation.

| Check | `qwen-plus-character` | `qwen-flash-character` |
|---|---|---|
| Latency (avg of 15) | 932 ms | 864 ms |
| Sequential burst | 15/15 clean | 15/15 clean |
| Concurrent burst | 8/8 | 8/8 |
| Streaming (SSE + `[DONE]`) | ✅ | ✅ |
| `max_tokens` honoured | ✅ | ✅ |
| In-domain grounding + citations | **8/8** | 7/8 |
| Absent-fact / off-topic refusal | **0/8 failures** | **4/8 failures** |

`qwen-flash-character` invents facts when the answer is absent from the
corpus — it claimed the service was "language-agnostic and support all
programming languages", and wrote a Python script when asked an off-topic
coding question. It is ordered second, where it only serves traffic when the
primary is unavailable.

### Regional endpoint

Model Studio keys are region-locked. An `sk-ws-` international key is
**rejected outright** by `dashscope.aliyuncs.com` (`invalid_api_key`); it must
use `dashscope-intl.aliyuncs.com/compatible-mode/v1`. `ALIBABA_BASE_URL` exists
so a mainland deployment can override without a code change.

### Bedrock added as a fourth tier

A second AWS Bedrock credential was supplied and evaluated. The endpoint is
`bedrock-mantle.eu-north-1.api.aws/v1`, which is a **gateway, not the native
Bedrock API** — real Bedrock authenticates with SigV4 request signing, this one
takes a static bearer token, and the region in the hostname is part of the
credential's scope. It requires an `OpenAI-Project: default` header; omitting
it fails auth.

43 models are listed, but **Anthropic models are unreachable** through it —
`anthropic.claude-sonnet-5` and `claude-haiku-4-5` both reject
`/v1/chat/completions` with *"does not support the '/v1/chat/completions'
API"*; they need the native `/v1/messages` endpoint, which this codebase does
not call. That rules out the Claude tier despite it being the strongest model
in the list.

| Candidate | latency | refusal failures | in-domain grounded |
|---|---|---|---|
| **`qwen.qwen3-32b`** | **~1.0 s** | **0/8** | **5/5** |
| `zai.glm-4.7-flash` | ~1.0 s | 0/8 | 4/5 |
| `zai.glm-5` | ~1.4 s | 0/8 | 4/5 |
| `deepseek.v3.2` | ~1.4 s | 0/8 | 5/5 |
| `openai.gpt-oss-20b` | ~0.9 s | **3/8** | 3/5 |
| `openai.gpt-oss-120b` | ~1.7 s | weak | — |
| `mistral.mistral-large-3-675b` | **timeout >180 s** | — | — |
| `anthropic.*` | — | unreachable via this endpoint | — |

`qwen.qwen3-32b` was selected: perfect grounding on both axes at ~1 s. The
`gpt-oss` models are reasoning models and over-explain — `gpt-oss-20b` failed 3
of 8 refusal probes.

Two gateway quirks handled:
- **No `data: [DONE]` sentinel.** The stream closes the connection instead,
  carrying `finish_reason: "stop"` on the final frame. LangChain's OpenAI
  client handles this correctly — verified end to end.
- **Large token budgets are wasted on reasoning.** `gpt-oss-120b` returned
  `content: null` with all 16 tokens consumed by internal reasoning.

### New waterfall

```
1. Alibaba  qwen-plus-character   circuit: aliyun-plus
2. Alibaba  qwen-flash-character  circuit: aliyun-flash
3. Groq      qwen3.8-27b          circuit: groq
4. Bedrock   qwen.qwen3-32b       circuit: bedrock
```

Each tier has its own circuit, so a flash-specific problem cannot knock out the
primary. Verified by pointing `ALIBABA_BASE_URL` and `GROQ_BASE_URL` at dead hosts, so
Bedrock was the only reachable tier:

```
Alibaba-qwen-plus failed  → Alibaba-qwen-flash failed → Groq failed
Answer via Bedrock-qwen3-32b                            3.3 s
Skipping Alibaba-qwen-plus → Skipping Alibaba-qwen-flash → Skipping Groq
Answer via Bedrock-qwen3-32b                            1.8 s
```

Verified earlier by pointing `ALIBABA_BASE_URL` at a dead host:

```
Alibaba-qwen-plus failed (Connection error.)
Alibaba-qwen-flash failed (Connection error.)
Answer via Groq                          ← fallback works
Skipping Alibaba-qwen-plus               ← breaker kicks in on request 3
Skipping Alibaba-qwen-flash
Answer via Groq                          ← 4.8 s → 2.0 s
```

Query expansion was also re-routed to Alibaba-first with Groq as backup. It
generates paraphrases rather than facts, so the grounding differences between
the models do not apply — only latency does — and this takes load off the
provider now relied on for final answers.

### Embeddings: unchanged, deliberately

`qwen3.7-text-embedding` is available and returns 1024-dim vectors (matching
the `voyage-3` column) with a batch limit of 20. It scored **identically** to
Voyage — 100% Precision@1 on both an easy and a zero-lexical-overlap retrieval
test — so there is no quality reason to switch, and switching would force
another full re-index on top of the re-crawl already outstanding.

This also independently confirms the corpus corruption is a **storage** bug, not
a Voyage problem: Voyage scores 100% when embedded correctly and 0.03
self-match inside the database.

### Budget caveat

The Alibaba quota is 1M tokens per model, expiring 2027-01-08. Measured on
real chunks (8 per query), a question costs ~986 tokens, so this covers roughly
**1,014 questions**. The `Message` table holds 366 messages in total to date, so
it is sufficient for current traffic — but it is not a growth budget, and
Groq remains necessary as the durable fallback.

## 3. About the hard timeouts

You asked whether to remove them. **They are load-bearing and were kept** —
but they were broken, so they were rewritten rather than deleted.

`withTimeout` previously did `Promise.race([task, timer])`. The losing work
kept running: a dispatched Voyage rerank held its socket open and kept being
billed with nobody reading the response. It now takes an `AbortController` and
cancels the underlying request:

```ts
function withTimeout<T>(task: (signal: AbortSignal) => Promise<T>, ms: number, fallback: T) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return Promise.race([
    task(controller.signal).finally(() => clearTimeout(timer)),
    new Promise<T>((resolve) => setTimeout(() => { clearTimeout(timer); controller.abort(); resolve(fallback); }, ms)),
  ]);
}
```

Concretely, removing them would have been harmful:

- **12 s / provider × 3 providers** is what makes the waterfall terminate. A
  rate-limited Gemini currently blocks for 12 s before Groq is tried.
- **45 s streaming ceiling** is the only bound on a stalled SSE stream. The
  streaming path previously had none, so a provider that accepted the
  connection and went quiet held the request open indefinitely.
- **30 s retrieval cap** in the controller is the outer guard; per-call caps
  (3 s expansion, 8 s rerank) sit inside it.

What changed is that they now actually **stop work** rather than just
abandoning its result.

---

## 4. Bugs found by running the code

Five defects were only found by executing the pipeline, not by reading it:

| Bug | Symptom | Fix |
|---|---|---|
| `websearch_to_tsquery` with a bound config | `function websearch_to_tsquery(text, text) does not exist` — sparse retrieval returned `[]` and logged at `debug`, so it looked like "no matches" | `::regconfig` cast |
| Two `SET LOCAL` in one statement | `cannot insert multiple commands into a prepared statement` — the whole dense query failed | one statement per SET inside a transaction |
| `pg_settings` capability probe | Returned zero rows, so `iterative_scan` was permanently disabled on pgvector 0.8.2 | probe `pg_extension.extversion` instead |
| `indexOf` for chunk offsets | Every duplicate text (nav, footers) got the first occurrence's heading | forward cursor |
| `normalizeQuery` punctuation strip | `[?!.]+$` never matched because a trailing space survived | trim before strip |

---

## 5. Verification

```bash
npm run typecheck        # clean
npm run build            # clean
npm test                 # 25 passed, 0 failed
npm run check:vectors    # integrity report
```

Manual checks performed against the live database:

- Query plan for the sparse search uses `Index Scan using "Chunk_chatbotId_idx"`
- `retrieveContext` cold 3.1 s → repeat **0–5 ms** with identical results
- 5 distinct queries → 5 distinct cache keys (no collisions)
- Cache invalidated automatically on crawl and document upload
- Controlled re-index: 4 rows, 4 distinct vectors, 4/4 self-match
- Live `/api/chat` JSON **and** SSE paths return grounded, cited answers
- Rate limit returns 429 after 30 requests
- Conversation persistence atomic, 0 duplicate conversations

---

## 6. Honest limitations

These are **not** fixed and you should know about them:

1. **The corpus is still corrupt.** Re-crawling is mandatory; the code changes
   prevent recurrence but cannot repair existing rows.

2. **Scores cannot be trusted for abstention.** Measured on the live corpus,
   the reranker's score separates on-topic from off-topic questions at only
   **8/10** at its best threshold, and thresholds from 0.15 to 0.50 all score
   5–7/10. `rerank-2` is a *relative* ranking model — fed 40 candidates it must
   rank them, so the top one scores well even when none are relevant.

   Abstention has therefore been disabled except on the unambiguous case
   (retrieval returned nothing — see §2.5). **Calibrate a real threshold
   against a labelled question set before re-enabling it.** The same caveat
   applies to `confidence` and `lowConfidence` in the API response: they are
   ranking scores, not probabilities, and should not be presented as such.

3. **No multi-turn retrieval.** Follow-up questions like "what about the
   enterprise plan?" are still retrieved against an anaphoric query. Not
   implemented — it needs conversation rewriting and an eval set to tune.

4. **`text_tsv` still uses the `english` config**, which stems and drops
   stopwords. Correct for prose, lossy for technical corpora (`SaaS`, `API`,
   `SAML`, `v2.0`). Switching to `simple` requires rebuilding the generated
   column in the same migration — the query side and column side must agree or
   they share no lexemes and return nothing.

5. **No load testing.** Concurrency effects (HNSW under concurrent load,
   pool exhaustion) are unmeasured.

6. **`express-rate-limit` uses in-memory storage**, so limits are per-process
   and reset on restart. Use `redis-rate-limiter` (already a dependency) for
   multi-instance deployments.

---
  
## 7. Recommended next steps

1. **Re-crawl every chatbot** — nothing else matters until this is done.
2. **Build a labelled eval set** (50–200 questions per chatbot with ground-truth
   URLs) and measure Recall@8 / MRR@8 / nDCG@8. Every remaining tuning
   decision — `chunkSize`, `k`, `ef_search`, the abstention threshold — is a
   guess without it.
3. **Calibrate abstention** against that set (see limitation 2).
4. **Add multi-turn query rewriting.**
5. **Store source text** in a `CrawlPage` content column so a re-embed never
   requires re-crawling.