      # Task: Implement Hybrid Retrieval Pipeline (Query Expansion → Dense + BM25 → RRF Merge → Rerank → LLM)

## Context

This is a Node.js + TypeScript RAG backend (MERN-style, Prisma ORM, Postgres with `pgvector`). Pages are crawled (Firecrawl), chunked, embedded with Voyage AI (`voyage-4`, 1024-dim, via `embedText`/`embedQuery`/`embedTexts` in `embedding.service.ts`), and an LLM (Gemini, in `llm.service.ts`) answers using retrieved chunks via the `generateAnswer(query, chunks, chatbot)` function, which expects:

```typescript
interface SearchChunk {
  content: string;
  heading?: string;
  url: string;
  semantic_score?: number;
}
```

Currently retrieval is naive (likely a single pgvector similarity query). I want to upgrade it to a full hybrid retrieval pipeline:

```
User Query
   ↓
Query rewrite + expansion (LLM)
   ↓
Dense search (pgvector cosine, Voyage embeddings)   ─┐
   ↓                                                  ├─ run in parallel
BM25 / sparse search (Postgres full-text search)    ─┘
   ↓
Merge + dedupe (Reciprocal Rank Fusion)
   ↓
Rerank (Voyage rerank-2 cross-encoder)
   ↓
Top 5–10 chunks
   ↓
generateAnswer()
```

Follow the existing code conventions exactly: `axios` for HTTP calls, `logger` from `../utils/logger` for logging, the `catch (error: unknown)` + `err as { response?: {...}; message?: string }` error-handling pattern, Prisma for DB access, and small focused service files under `src/services/`.

---

## 1. Database changes (Prisma migration + schema)

Assume the existing chunk table is something like `Embedding` or `Chunk` with columns: `id`, `chatbotId`, `pageId`, `content`, `heading`, `url`, `embedding vector(1024)`.

Add:
- A generated `tsvector` column for BM25-style full-text search:
  ```sql
  ALTER TABLE "Chunk" ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, '') || ' ' || coalesce(heading, ''))) STORED;

  CREATE INDEX chunk_content_tsv_idx ON "Chunk" USING GIN (content_tsv);
  ```
- Ensure there's already an index on `embedding` (e.g. `USING hnsw (embedding vector_cosine_ops)` or `ivfflat`).

Write this as a raw SQL Prisma migration (`prisma/migrations/.../migration.sql`) since `tsvector` generated columns aren't expressible in `schema.prisma` directly. Add a comment explaining why raw SQL is needed.

---

## 2. Query Rewrite + Expansion Service

New file: `src/services/queryExpansion.service.ts`

```typescript
export interface ExpandedQuery {
  original: string;
  rewritten: string;     // cleaned-up / normalized version of the query
  variants: string[];    // 1-3 alternative phrasings / sub-questions
}

export async function expandQuery(query: string): Promise<ExpandedQuery>
```

Requirements:
- Call Gemini (reuse the same `MODEL_CHAIN` + `callGemini`-style fallback pattern from `llm.service.ts` — extract `callGemini` into a small shared helper if needed, e.g. `src/services/gemini.client.ts`, and import it in both places).
- Prompt Gemini to return **strict JSON only** (no markdown fences) in this shape:
  ```json
  {
    "rewritten": "...",
    "variants": ["...", "..."]
  }
  ```
- Prompt instructions for Gemini:
  - Fix typos/grammar and resolve obvious ambiguity in `rewritten`, but preserve the user's intent and entities — do not invent new topics.
  - Generate 1–3 `variants`: alternate phrasings, synonyms, or decomposed sub-questions that would help retrieve relevant documents (e.g. expand acronyms, add likely related terms).
  - If the query is a greeting / too short / not a real question, return `rewritten` = original and `variants` = [].
- Parse the JSON defensively: strip ```json fences if present, `JSON.parse`, validate shape with a type guard.
- On ANY failure (LLM error, bad JSON), **fail open**: return `{ original: query, rewritten: query, variants: [] }` and log a warning. Never throw — this must not break retrieval.
- Add a short in-memory cache (e.g. simple `Map` with TTL, or none if out of scope) — optional, mention as a future improvement in a comment but don't over-engineer.

---

## 3. Dense Retrieval (pgvector)

New file: `src/services/retrieval/dense.service.ts`

```typescript
export interface DenseHit {
  id: string;
  content: string;
  heading: string | null;
  url: string;
  distance: number; // raw cosine distance from pgvector
}

export async function denseSearch(
  chatbotId: string,
  queryEmbedding: number[],
  limit: number = 25,
): Promise<DenseHit[]>
```

Requirements:
- Use `prisma.$queryRaw` (with `Prisma.sql` for safe parameter interpolation — never string-concatenate the embedding array or chatbotId).
- Query pattern:
  ```sql
  SELECT id, content, heading, url, (embedding <=> $1::vector) AS distance
  FROM "Chunk"
  WHERE "chatbotId" = $2
  ORDER BY embedding <=> $1::vector
  LIMIT $3
  ```
- Convert `queryEmbedding` (a `number[]`) to the pgvector literal format `'[0.1,0.2,...]'` before passing as a parameter.
- Return distance as-is (lower = more similar); we'll convert to a score during RRF merge.

---

## 4. Sparse / BM25 Retrieval (Postgres Full-Text Search)

New file: `src/services/retrieval/sparse.service.ts`

```typescript
export interface SparseHit {
  id: string;
  content: string;
  heading: string | null;
  url: string;
  rank: number; // ts_rank_cd score
}

export async function sparseSearch(
  chatbotId: string,
  query: string,
  limit: number = 25,
): Promise<SparseHit[]>
```

Requirements:
- Use `websearch_to_tsquery('english', $query)` (handles natural-language queries better than `plainto_tsquery` — supports quotes/OR/-exclusions if the user types them).
- Query pattern:
  ```sql
  SELECT id, content, heading, url,
         ts_rank_cd(content_tsv, websearch_to_tsquery('english', $1)) AS rank
  FROM "Chunk"
  WHERE "chatbotId" = $2
    AND content_tsv @@ websearch_to_tsquery('english', $1)
  ORDER BY rank DESC
  LIMIT $3
  ```
- If `websearch_to_tsquery` produces an empty tsquery (e.g. query is only stopwords/punctuation), Postgres may error or return nothing — catch this, log a warning, and return `[]` rather than throwing.
- Run this once per query variant (original + rewritten + each expansion variant), but keep it cheap — cap total variants used at 3 to bound query count.

---

## 5. Merge + Dedupe via Reciprocal Rank Fusion (RRF)

New file: `src/services/retrieval/rrf.service.ts`

```typescript
export interface FusedHit {
  id: string;
  content: string;
  heading: string | null;
  url: string;
  rrfScore: number;
}

export function fuseResults(
  resultLists: { id: string; content: string; heading: string | null; url: string }[][],
  k: number = 60,
): FusedHit[]
```

Requirements:
- Implement standard RRF: for each ranked list, each item at rank `r` (1-indexed) contributes `1 / (k + r)` to its cumulative score. Sum contributions across all lists (dense list(s) + sparse list(s) across all query variants).
- Dedupe by `id`: if the same chunk `id` appears in multiple lists, sum its RRF scores and keep one copy of its content/heading/url.
- Sort descending by `rrfScore`, return all fused hits (caller will slice before reranking).
- Add a short doc comment explaining RRF and why `k=60` is the commonly used default (dampens the impact of any single list's top rank).

---

## 6. Reranking (Voyage rerank-2, cross-encoder)

New file: `src/services/retrieval/rerank.service.ts`

```typescript
export interface RerankedChunk {
  id: string;
  content: string;
  heading: string | null;
  url: string;
  rerankScore: number;
}

export async function rerankChunks(
  query: string,
  candidates: { id: string; content: string; heading: string | null; url: string }[],
  topK: number = 8,
): Promise<RerankedChunk[]>
```

Requirements:
- Call Voyage's rerank endpoint: `POST https://api.voyageai.com/v1/rerank`
  ```json
  {
    "query": "...",
    "documents": ["chunk text 1", "chunk text 2", ...],
    "model": "rerank-2",
    "top_k": 8,
    "return_documents": false
  }
  ```
  Auth header: `Authorization: Bearer ${process.env.VOYAGEAI_KEY}` (same env var already used in `embedding.service.ts`).
- Response shape: `{ data: [{ index: number, relevance_score: number }, ...] }` — map `index` back to the original `candidates` array to recover `id`/`content`/`heading`/`url`.
- Cap input to a sane candidate pool size before calling rerank (e.g. top ~25–30 from the fused RRF list) — reranking 100+ docs is slow and costly.
- On API failure: log a warning and **fail open** by returning the top `topK` candidates from the input list *unreranked* (i.e. skip reranking but don't break the pipeline), with `rerankScore: 0` for each.
- Concatenate `heading + "\n" + content` (truncated to a reasonable length, e.g. first ~2000 chars) as the "document" text sent to Voyage, to give the cross-encoder context.

---

## 7. Top-Level Orchestrator

New file: `src/services/retrieval.service.ts`

```typescript
export async function retrieveContext(
  chatbotId: string,
  rawQuery: string,
  finalTopK: number = 8,
): Promise<SearchChunk[]>
```

Pipeline steps:
1. `expandQuery(rawQuery)` → `{ original, rewritten, variants }`.
2. Build the set of query strings to search with: `[rewritten, ...variants]` (dedupe, cap at 3 total).
3. For dense search: embed only `rewritten` via `embedQuery` (don't re-embed every variant — too expensive/slow). Run `denseSearch(chatbotId, embedding, 25)`.
4. For sparse search: run `sparseSearch(chatbotId, q, 25)` for each query string in the set, in parallel via `Promise.all`.
5. Run dense + all sparse searches in parallel (`Promise.all`).
6. Pass all result lists into `fuseResults(...)`.
7. Take the top ~25–30 fused hits as candidates for reranking.
8. `rerankChunks(rewritten, candidates, finalTopK)`.
9. Map `RerankedChunk[]` → `SearchChunk[]`:
   ```typescript
   {
     content: hit.content,
     heading: hit.heading ?? undefined,
     url: hit.url,
     semantic_score: hit.rerankScore,
   }
   ```
10. Return the array — this is what gets passed directly into the existing `generateAnswer(query, chunks, chatbot)`.

Error handling:
- Any stage failure should degrade gracefully where possible (per fail-open notes above) rather than throwing and breaking the whole chat request — but if dense AND sparse search both fail (e.g. DB down), it's fine to let the error propagate so the caller can return an error response.
- Log timing for each stage (`logger.info`) so we can profile latency: query expansion, dense search, sparse search, fusion, rerank, total.

---

## 8. Wiring into the chat endpoint

Find wherever `generateAnswer` is currently called (likely a chat controller/service) and replace the existing naive retrieval call with `retrieveContext(chatbotId, query, 8)`. Keep the function signature of `generateAnswer` unchanged.

---

## 9. Env vars / config

- `VOYAGEAI_KEY` — already exists, also used for rerank.
- `GEMINI_API_KEY` — already exists, reused for query expansion.
- No new env vars strictly required; if you add tunables (e.g. `RRF_CANDIDATE_POOL_SIZE`, `RERANK_TOP_K`), default them sensibly in code and document in a comment, no need to add to `.env.example` unless asked.

---

## 10. File summary (new/modified)
   
```
prisma/migrations/.../migration.sql      (new - tsvector column + GIN index)
src/services/gemini.client.ts            (new - shared callGemini helper, optional refactor)
src/services/queryExpansion.service.ts   (new)
src/services/retrieval/dense.service.ts  (new)
src/services/retrieval/sparse.service.ts (new)
src/services/retrieval/rrf.service.ts    (new)
src/services/retrieval/rerank.service.ts (new)
src/services/retrieval.service.ts        (new - orchestrator)
src/<wherever chat handling lives>       (modified - call retrieveContext instead of old retrieval)
```

Please implement this step by step, file by file, matching the existing TypeScript style, logging conventions, and error-handling patterns shown in `embedding.service.ts` and `llm.service.ts`. Ask before assuming the exact name/shape of the `Chunk`/`Embedding` Prisma model if it's ambiguous from context.
