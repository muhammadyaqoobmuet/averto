# RAG Pipeline — Analysis & Optimization Plan

**Scope:** `express-backend` only. No code was modified.
**Date:** 2026-10-09

---

## 1. Current Pipeline (as-built)

```
POST /api/chat  (chat.controller.ts:38)
  │
  ├─ 1. chatbot lookup by apiKey                    :53   (no index concern — unique)
  ├─ 2. allowedOrigins check                        :62
  ├─ 3. status gate ready|indexing                  :79
  ├─ 4. chunk.count({chatbotId})  ← FULL COUNT     :87   ❌ expensive
  │
  ├─ retrieveContext(chatbotId, query, 8)  [30s hard timeout]   :101
  │    ├─ expandQuery()          Groq LLM, 3s timeout            retrieval.service.ts:165
  │    │    └─ returns [raw, v1, v2]  (max 3)                     :80
  │    ├─ Promise.all(                                           :169
  │    │    ├─ denseSearch(raw, 25)   embedQuery + pgvector HNSW  dense.service.ts:23
  │    │    └─ sparseSearch(v, 25) ×3  tsvector + GIN            sparse.service.ts:39
  │    │  )   ← dense waits on its own Voyage round-trip
  │    ├─ fuseResults(RRF, k=60) → slice 25                      :178-179
  │    └─ rerankWithVoyage(raw, 25 cands, top_k=8)  15s          :195
  │
  ├─ confidence = max(semantic_score)                            :112
  ├─ missedQuery insert if < 0.35                               :117
  │
  ├─ generateAnswer()                                            llm.service.ts:83
  │    ├─ context assembly  [Source i] heading/URL/content        :104-112
  │    ├─ Claude BYOK direct axios, max_tokens 1024, NO timeout  :147-163
  │    └─ waterfall: Gemini(0.2) → Groq(0.2) → Groq(0.2)         :261-270
  │         12s withTimeout, strips <think></think>               :32, :296-331
  │
  ├─ SSE write done{sources, sourceDetails, confidence}          :162
  └─ persist conversation + 2 messages (3 sequential queries)    :168-188
```

### Stack summary

| Layer | Choice |
|---|---|
| Embeddings | `voyage-3`, 1024-dim, batch 96, 30s timeout — `utils/voyage.ts:6,8,30` |
| Reranker | `rerank-2` — `retrieval.service.ts:110` |
| Vector store | pgvector HNSW cosine (`m=16, ef_construction=64`) |
| Sparse | Postgres `tsvector` + GIN, `websearch_to_tsquery('english')` |
| Fusion | RRF `k=60`, pool 25 |
| Chunking | 1200 chars / 130 overlap (chars, not tokens) |
| Generation | `gemini-3.8-flash` → `qwen/qwen3.8-27b` (Groq) → Groq again |
| Cache | **none** |
| Rate limit | **none** |
| Tests | **none** |

---

## 2. Latency Budget

### 2.1 Serial chain — critical path

```
expandQuery (Groq, avg ~0.6s, worst 3s)
  ↓ awaits
denseSearch ── embedQuery Voyage round-trip (~0.3s) THEN pgvector
  ↓
sparseSearch ×3  (parallel with dense)
  ↓
rerank Voyage (25 docs, ~0.4-1.5s, worst 15s)
  ↓
generateAnswer (Gemini 1-4s typical, 12s cap)
  ↓
3 sequential Prisma writes (~30-90ms)
────────────────────────────────────────
TYPICAL p50 : 3.0 – 5.0 s
WORST CASE  : 3 + 15 + 12 = 30s retrieval cap + 12s gen ≈ 42s+
```

### 2.2 Waste identified in the critical path

| Waste | Cost | Location |
|---|---|---|
| `chunk.count()` scans full table on **every** request | 50–300ms, scales with corpus | `chat.controller.ts:87` |
| `expandQuery` blocks retrieval entirely | +0.6–3.0s every request | `retrieval.service.ts:165` |
| Sparse waits on dense's embed round-trip | +0.3s | `retrieval.service.ts:169` |
| 3× sequential Prisma writes after stream closes | +60–180ms | `chat.controller.ts:168-188` |
| Voyage re-embedded per request (no cache) | ~0.3s + cost | `dense.service.ts:35` |
| 3rd waterfall entry is a duplicate of the 2nd | wasted latency on failure | `llm.service.ts:267-269` |

**Measured fix ceiling:** removing the count + overlapping expansion with sparse + batching persistence → **~1.0–1.5s saved p50**.

---

## 3. Drawbacks — Accuracy

### 🔴 D1. `Chunk.heading` is ALWAYS NULL — citations are broken
`indexing.service.ts:38` passes metadata `{chatbotId, pageId}` only. LangChain's `MarkdownTextSplitter` emits no `heading` key. So `:89-90` always reads `undefined → null`.

Consequences:
- Every citation renders `"Page"` — `llm.service.ts:109`
- `content_tsv` index only covers `content` — `migration.sql:14-16`
- The LLM has no structural signal for *where* in the page content lives

**Fix:** parse `#`/`##`/`###` headings during splitting, track the active heading per chunk, and prepend it to the embedded text.

---

### 🔴 D2. Chunking ignores structure — 1200 **characters** ≈ 300 tokens
`indexing.service.ts:31-35`. For RAG this is on the large side; for a customer-facing support bot it produces broad, diluted chunks.

Compounding problems:
- `MarkdownTextSplitter` in `@langchain/textsplitters@1.0.1` is just `RecursiveCharacterTextSplitter` + markdown separators — it splits on `#` lines but **does not** map heading context to each chunk
- `chunkOverlap: 130` chars ≈ 11% — low, causing facts to break across boundaries

**Fix:** structure-aware splitting (heading → sections), 600–900 chars, overlap 15–20%, embed `heading + "\n" + content` while indexing `content` alone in `content_tsv`.

---

### 🔴 D3. Dense search uses ONLY the raw query
`retrieval.service.ts:170` — `denseSearch(chatbotId, rawQuery, 25)`. The 3 variants from `expandQuery` are fed to sparse **only** (`retrieval.service.ts:171`).

The main semantic channel ignores all rewriting work — this is almost certainly unintentional, and it's the single largest accuracy loss in the pipeline.

**Fix:** embed all variants (Voyage supports `input: string[]` in one call) and run one ANN query using the **centroid** vector, or union the per-variant result lists.

---

### 🔴 D4. No deduplication of near-identical chunks
RRF dedupes by `chunk.id` (`rrf.service.ts:50-57`), not by content. A nav-heavy page produces 5–10 chunks that are near-duplicates. They occupy all 8 final slots, starving the LLM of distinct facts.

**Fix:** MMR (maximal marginal relevance) on rerank output, or content-hash dedupe, target 3–5 unique chunks.

---

### 🟠 D5. Rerank is scored against the raw query only
`retrieval.service.ts:195` passes `rawQuery` while candidates came from a multi-variant search. Mismatch when the user's phrasing is terse ("pricing?") or long.

**Fix:** rerank against the raw query **plus** joined variants, or rerank the top-3 per variant and merge.

---

### 🟠 D6. Confidence score is semantically wrong — analytics lie
`chat.controller.ts:112-115` uses `max(semantic_score)`, where `semantic_score` is **Voyage rerank `relevance_score`** (`retrieval.service.ts:201`).

But on the fallback path (`retrieval.service.ts:136-142`) every chunk gets `rerankScore: 0`. So:
- Every rerank failure → confidence `0` → `lowConfidence: true` for **every** answer
- Every query logged to `MissedQuery` (`chat.controller.ts:117`)
- The "Insights" tab fills with false negatives

**Fix:** fall back to the RRF score, not `0`. Keep raw cosine similarity as a separate field. Add a per-chatbot threshold calibrated from actual score distribution rather than a hard-coded `0.35`/`0.45`.

---

### 🟠 D7. RRF `k=60` over-weighted for a 4-list fusion
`rrf.service.ts:38`. With only 4 lists and top-25 each, `k=60` compresses contributions into a narrow band (`0.0163`–`0.0399`), so top-rank differences get flattened. Standard for 10+ lists; too flat for 4.

**Fix:** `k = 10` for a 4-list fusion, or use weighted RRF (`0.6·dense + 0.4·sparse`).

---

### 🟠 D8. `websearch_to_tsquery('english')` stemming mangles product terms
`sparse.service.ts:54,58`. The English config stems (`pricing→pric`, `services→servic`) and drops stopwords. Named entities, SKUs, version numbers (`v2.0`), and acronyms (`API`, `SaaS`) get destroyed.

**Fix:** use `'simple'` config for a custom corpus, or `english` + a `phrase`/trigram fallback. Add a per-chatbot `search_config` column if the corpus is technical.

---

### 🟠 D9. No `set-based` / iterative retrieval — single-shot only
One retrieval round. If the top-8 chunks cover half the answer, the rest is guesswork or dropped.

**Fix:** optional second pass — if the reranked top-1 score is below threshold, re-retrieve with a "gap-filling" query derived from what was already found.

---

### 🟠 D10. No conversation history in retrieval or prompt
`chat.controller.ts` reads `Conversation`/`Message` only for persistence (`:168-188`). Multi-turn questions ("What about the enterprise plan?") retrieve against an anaphoric query with no context → near-zero recall.

**Fix:** for turns > 1, rewrite the query into a standalone question using the last 2–3 messages before retrieval. Cheap with the Groq fast model already wired in.

---

### 🟡 D11. Prompt injects `{query}` twice
`llm.service.ts:132` ends with `Answer: {query}`. The model sees the question at `:123` and again at `:132`. Increases echo/repetition on small models.

**Fix:** `Answer:` only.

---

### 🟡 D12. `max_tokens: 1024` on Anthropic, unconstrained elsewhere
`llm.service.ts:151,201`. Gemini/Groq have no cap set. Long-context behaviour is inconsistent across providers.

**Fix:** set `maxTokens: 1024` uniformly.

---

### 🟡 D13. No refusal threshold in the prompt, only an instruction
`llm.service.ts:112` inserts a `(No relevant context found...)` placeholder when retrieval is empty, but the model still gets no "you must abstain" directive tied to the actual retrieved score. A low-quality-but-nonempty context set produces a confident hallucination.

**Fix:** when `max(rerankScore) < τ`, force a canned refusal instead of calling the LLM at all. Saves cost and eliminates the worst hallucination class.

---

## 4. Drawbacks — Performance

### 🔴 P1. `chunk.count()` on every request
`chat.controller.ts:87-89`. `SELECT count(*) FROM "Chunk" WHERE chatbotId = $1`. With **no index on `Chunk.chatbotId`**, this is a sequential scan. At 100k chunks this is 100–500ms per request, on every single message.

**Fix:** cache the count per chatbot (Redis, or an in-process LRU with 60s TTL). Delete the per-request query.

---

### 🔴 P2. NO index on `Chunk.chatbotId`
`schema.prisma:73-83` — no index. Both retrieval queries filter on it:
- `dense.service.ts:58` — `WHERE c."chatbotId" = $1` + ANN
- `sparse.service.ts:57` — same

pgvector HNSW is a **global** index. Without a `chatbotId` btree, the ANN walk filters after the fact, scanning many chunks from other tenants and discarding them. Multi-tenant corpora make this much worse.

**Fix:**
```sql
CREATE INDEX CONCURRENTLY chunk_chatbot_id_idx ON "Chunk" ("chatbotId");
CREATE INDEX CONCURRENTLY chunk_chatbot_page_idx ON "Chunk" ("chatbotId", "pageId");
```
Then raise `hnsw.ef_search` from the default 40 to ~100 for higher recall, or use iterative HNSW scans (`SET LOCAL hnsw.iterative_scan = strict_order`).

---

### 🔴 P3. Query expansion is a blocking round-trip
`retrieval.service.ts:165` awaits the Groq call **before** any DB work starts. Costs 0.6–3.0s of pure dead time, on requests where expansion adds nothing.

**Fix:** start sparse search on the raw query immediately (it needs no LLM), race it against expansion. Or gate expansion on query length — skip it for queries already ≥ 6 tokens, where rewriting rarely helps.

---

### 🔴 P4. No caching anywhere
`lib/redis.ts` exists and is **never imported**. Zero caching of:
- embeddings (query + chunk level)
- retrieval results per `(chatbotId, normalizedQuery)`
- expansion results

On a support bot, repeat/variant questions are the norm. This is the cheapest 200–800ms available.

**Fix:** Redis `GET retrieval:{chatbotId}:{sha256(normalizedQuery)}` with 1h TTL; LRU in-process for query embeddings; LLM prompt cache (Groq/Gemini both support prefix caching — put `systemInstructions` first, it already is).

---

### 🔴 P5. `Promise.race` timeouts don't cancel the work
`retrieval.service.ts:26-35`, `chat.controller.ts:14-24`. When the 30s hard cap fires, the Voyage rerank HTTP call **keeps running** and keeps consuming a connection. Under load this leaks sockets and burns paid tokens for results nobody reads.

**Fix:** pass an `AbortController` signal into axios calls (`signal: ac.signal`) and abort in `withTimeout`.

---

### 🟠 P6. Streaming generation has no timeout and no abort
`llm.service.ts:147-190` (Anthropic) and `:280-335` (platform waterfall) — `withTimeout` is only applied to the **non-streaming** paths (`:245-248`, `:337-343`). A stalled SSE stream holds the HTTP request open forever.

**Fix:** wire `AbortController` into both streaming paths, plus a `res.on('close')` handler that aborts upstream when the client disconnects.

---

### 🟠 P7. Sequential per-chunk inserts during indexing
`indexing.service.ts:78-112`. One `INSERT` round-trip per chunk. A 200-page crawl at ~20 chunks/page = 4000 sequential round-trips → several minutes of pure DB latency.

**Fix:** single multi-row INSERT built with `Prisma.sql` joins, batched at ~200 rows (parameter limit). Or `prisma.$transaction` over an array. Expected 10–50× faster indexing.

---

### 🟠 P8. Ingestion and query share the same pool, no concurrency ceiling
Workers run at `concurrency: 2` (`crawl.worker.ts:197`, `document.worker.ts:80`). A bulk re-crawl hammers the DB with 4000 serial inserts while chat requests compete for the same connections.

**Fix:** separate `pg` pool / read replica for retrieval. Or add an advisory lock so ingestion yields during live traffic.

---

### 🟠 P9. `prisma.log: ['query']` unconditionally on
`lib/prisma.ts:8`. Logs every SQL string including 1024-float vector payloads (the `[v1,v2,...]` cast makes these huge). Production I/O amplification and PII leakage in logs.

**Fix:** `log: process.env.NODE_ENV === 'development' ? ['query','warn','error'] : ['warn','error']`.

---

### 🟠 P10. HNSW build params are low for a recall-sensitive workload
`migration.sql:27` — `m=16, ef_construction=64`. For 100k+ chunks, `ef_search` should be raised at query time.

**Fix:** `SET LOCAL hnsw.ef_search = 100;` before the ANN query (requires `SET LOCAL` inside a transaction, or session-level).

---

### 🟡 P11. `/api/chat` has zero request validation and zero rate limiting
`routes/chat.routes.ts:7`, `app.ts:51`. `chatRequestSchema` and `zodMiddleware` exist in `utils/schemas.ts:57-61` and are **dead code**. `express-rate-limit` and `redis-rate-limiter` are installed and **never imported**.

An empty or 1MB `query` string goes straight to the embedding API. The endpoint is public with only the apiKey as a gate.

**Fix:** wire `chatRequestSchema` + a rate limit (e.g. 30 req/min per chatbot).

---

### 🟡 P12. `chunk.count()` is also the readiness gate — inverted logic
`chat.controller.ts:90-96`. A chatbot with 3 chunks passes; with 0 returns 503. But `status === 'indexing'` is also accepted (`:79`), so a half-indexed bot serves answers from a partial corpus.

**Fix:** cache the count, and add a minimum chunk threshold (e.g. ≥ 5) rather than `=== 0`.

---

### 🟡 P13. `embedQuery` can return `[]`
`voyage.ts:83` — `return embedding ?? []`. `dense.service.ts:38` then builds `"[]"`, the `::vector` cast throws, and the catch returns `[]` → **the entire dense channel silently disappears**. Same if `expandQuery` never ran.

**Fix:** throw explicitly on an empty embedding so the failure is visible.

---

### 🟡 P14. `getGroqLLM` hard-codes the base URL, ignoring `GROQ_BASE_URL`
`llm-provider.ts:48` vs `:66`. Only `getGroqFastLLM` honors the override. Query expansion and generation can hit different endpoints under a proxy setup.

**Fix:** use `process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"` in both.

---

### 🟡 P15. Third waterfall provider is a duplicate
`llm.service.ts:267-269` — `[Gemini, Groq, Groq]`. Two identical Groq entries with different keys. Adds latency and burns a second key on retry rather than trying a genuinely different provider.

**Fix:** replace with a genuinely distinct third option, or drop it.

---

## 5. Recommended Optimization Plan

### Phase 1 — Latency, no behaviour change (~1.0–1.5s p50 saved)

| # | Action | File | Est. gain |
|---|---|---|---|
| 1.1 | Delete `chunk.count()` per request; cache count with 60s TTL | `chat.controller.ts:87` | 50–300ms |
| 1.2 | Start sparse on raw query **in parallel** with expansion; only use variants after expansion lands | `retrieval.service.ts:165-172` | 600–3000ms |
| 1.3 | Batch the 3 conversation writes into one `$transaction` | `chat.controller.ts:168-188` | 40–120ms |
| 1.4 | Cache query embeddings in-process (LRU 1000) | `dense.service.ts:35` | ~300ms on hits |
| 1.5 | Gate `prisma.log` to dev only | `lib/prisma.ts:8` | I/O + memory |
| 1.6 | Add Redis cache for `retrieveContext` keyed on `(chatbotId, normalizedQuery)`, 1h TTL | `retrieval.service.ts` | 200–800ms on hits |
| 1.7 | Remove duplicate `{query}` from the prompt tail | `llm.service.ts:132` | ~0 (accuracy) |
| 1.8 | Set `maxTokens: 1024` uniformly | `llm.service.ts` | ~0 (consistency) |

### Phase 2 — Accuracy (largest gains)

| # | Action | File | Expected effect |
|---|---|---|---|
| 2.1 | **Extract headings** during split; store on `Chunk.heading`; embed `heading + content` | `indexing.service.ts:30-40, 89-90` | Fixes all citations; better ranking |
| 2.2 | **Dense-search all query variants** — one batched embed call + centroid vector, or union result lists | `retrieval.service.ts:170` | Largest single recall gain |
| 2.3 | Structure-aware chunking: 700 chars / 20% overlap, split on heading boundaries | `indexing.service.ts:31-35` | +10–20% answer faithfulness |
| 2.4 | **MMR dedupe** on rerank output, target 5 distinct chunks | `retrieval.service.ts:195-202` | Removes duplicate-context dilution |
| 2.5 | RRF `k` 60 → 10 (tuned for 4 lists) | `rrf.service.ts:38` | Better fusion separation |
| 2.6 | Rerank against `rawQuery + variants` | `retrieval.service.ts:195` | Better final ordering |
| 2.7 | Fix confidence: fall back to RRF score, keep raw cosine separate, calibrate τ from the score distribution | `retrieval.service.ts:136-142`, `chat.controller.ts:6-7,112` | Analytics become truthful |
| 2.8 | Hard abstention when `maxScore < τ` — skip the LLM, return canned refusal | `chat.controller.ts` | Kills top hallucination class |
| 2.9 | Conversation-aware query rewriting for turns > 1 | `chat.controller.ts` | Multi-turn recall |
| 2.10 | `to_tsvector('simple')` or add a trigram fallback for technical terms | `migration.sql:14-16` | Better sparse recall |

### Phase 3 — Scale & robustness

| # | Action | File |
|---|---|---|
| 3.1 | Add `Chunk(chatbotId)` and `Chunk(chatbotId, pageId)` btree indexes | new migration |
| 3.2 | `SET LOCAL hnsw.ef_search = 100` (+ iterative scan) per ANN query | `dense.service.ts:40-62` |
| 3.3 | Batch chunk inserts (multi-row, ~200/batch) | `indexing.service.ts:78-112` |
| 3.4 | `AbortController` into every axios call; abort in `withTimeout` | `retrieval.service.ts:26`, `chat.controller.ts:14` |
| 3.5 | Timeout + abort for both streaming LLM paths | `llm.service.ts:147-190, 280-335` |
| 3.6 | Wire `chatRequestSchema` + `express-rate-limit` on `/api/chat` | `routes/chat.routes.ts:7` |
| 3.7 | Read replica or separate pool for retrieval | `lib/prisma.ts` |
| 3.8 | Replace duplicate 3rd waterfall provider | `llm.service.ts:267-269` |
| 3.9 | Throw on empty embedding instead of `[]` | `voyage.ts:83` |
| 3.10 | Honor `GROQ_BASE_URL` in `getGroqLLM` | `llm-provider.ts:48` |

### Phase 4 — Measurement (do this **first**)

There is currently **no test suite, no eval harness, and no tracing**. Every tuning above is a guess until you can measure.

1. Build a **retrieval eval set**: 50–200 real questions per chatbot, each with the ground-truth source URL(s).
2. Measure **Recall@8** (fraction of questions where a ground-truth chunk appears in the final 8).
3. Measure **MRR@8** and **nDCG@8**.
4. Log per-stage latency (already partly done at `retrieval.service.ts:204`) — emit it as structured fields, not a string.
5. Measure **answer faithfulness**: fraction of claims in the answer traceable to a retrieved chunk.
6. Add a golden-set regression test that runs on every change.

Without this, changing `k`, `chunkSize`, and `ef_search` is numerology.

---

## 6. Priority Summary

| Rank | Item | Type | Impact | Effort |
|---|---|---|---|---|
| 1 | `Chunk.heading` always NULL (D1) | Accuracy | Critical | Small |
| 2 | Dense ignores query variants (D3) | Accuracy | Critical | Medium |
| 3 | `chunk.count()` per request + no index (P1, P2) | Perf | Critical | Small |
| 4 | No caching (P4) | Perf | High | Medium |
| 5 | Blocking query expansion (P3) | Perf | High | Small |
| 6 | Confidence score is fake on fallback (D6) | Accuracy | High | Small |
| 7 | No near-duplicate dedupe (D4) | Accuracy | High | Medium |
| 8 | Structure-aware chunking (D2) | Accuracy | High | Medium |
| 9 | Timeouts don't abort (P5, P6) | Robustness | High | Small |
| 10 | Per-chunk serial inserts (P7) | Ingestion | High | Small |
| 11 | No eval harness (Phase 4) | Enabler | High | Medium |
| 12 | No multi-turn retrieval (D10) | Accuracy | Medium | Medium |
| 13 | MMR + RRF k tuning (D7, D4) | Accuracy | Medium | Small |
| 14 | `/api/chat` unvalidated, unlimited (P11) | Security | Medium | Small |
| 15 | English stemming on technical corpus (D8) | Accuracy | Medium | Small |

---

## 7. Key File References

| Concern | Path |
|---|---|
| Chat endpoint | `express-backend/src/controllers/chat.controller.ts:38` |
| Retrieval orchestrator | `express-backend/src/services/retrieval.service.ts:157` |
| Query expansion | `express-backend/src/services/retrieval.service.ts:46` |
| Rerank | `express-backend/src/services/retrieval.service.ts:97` |
| Dense search | `express-backend/src/services/retrieval/dense.service.ts:23` |
| Sparse search | `express-backend/src/services/retrieval/sparse.service.ts:39` |
| RRF fusion | `express-backend/src/services/retrieval/rrf.service.ts:38` |
| Chunking + embedding + insert | `express-backend/src/services/indexing.service.ts:23` |
| Voyage client | `express-backend/src/utils/voyage.ts:18` |
| Context assembly + prompt + LLM | `express-backend/src/services/llm.service.ts:83` |
| LLM providers | `express-backend/src/utils/llm-provider.ts:41` |
| Prisma client | `express-backend/src/lib/prisma.ts:8` |
| Indexes / tsvector | `express-backend/prisma/migrations/20260614_add_tsvector/migration.sql` |
| Schema | `express-backend/prisma/schema.prisma:73` |