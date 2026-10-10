/**
 * Weighted Reciprocal Rank Fusion (RRF).
 *
 * ── Formula ────────────────────────────────────────────────────────────────
 *   score(item) = Σ   weight_list / (k + rank_in_list)
 *                 lists
 *
 * ── Why weights ────────────────────────────────────────────────────────────
 * The original code treated every list as equally trustworthy. That is not
 * true here: dense retrieval (a cross-encoder-free cosine match over the whole
 * corpus) is generally stronger than a single keyword `tsvector` match, and
 * within sparse, results from the raw user query deserve more trust than
 * results from an LLM-paraphrased variant. Equal weighting lets a lucky
 * BM25 hit on a stopword outrank a genuinely good semantic match.
 *
 * ── Why k = 10 instead of 60 ────────────────────────────────────────────────
 * The k constant exists to damp the top of any single list so that consistent
 * mid-range appearances across lists can win. The canonical value of 60 was
 * chosen for fusing 10+ lists of deep web results; with only ~4 shallow lists,
 * k = 60 compresses every contribution into a tiny band (~0.016 to ~0.040),
 * which flattens the differences we are trying to measure. k = 10 (the value
 * Elasticsearch and Azure AI Search both default to) keeps the same
 * "don't let one list dominate" property while preserving rank separation.
 *
 * Reference: Cormack, Clarke & Buettcher (SIGIR 2009) "Reciprocal Rank Fusion
 *            outperforms Condorcet and individual rank learning methods."
 */

export interface HitBase {
  id: string;
  content: string;
  heading: string | null;
  url: string;
}

export interface FusedHit extends HitBase {
  rrfScore: number;
}

/** A result list plus the weight of the channel that produced it. */
export interface WeightedList {
  hits: HitBase[];
  /** Higher = more trusted. Typically 0..1. */
  weight: number;
}

/** RRF damping constant. See the note above for why this is 10, not 60. */
export const RRF_K = 10;

/**
 * Merges weighted ranked lists into one deduplicated ranking.
 *
 * @param lists - Each entry is one ranked list and the weight of its channel.
 */
export function fuseResults(lists: WeightedList[]): FusedHit[] {
  const scoreMap = new Map<string, number>();
  const metaMap = new Map<string, HitBase>();

  for (const { hits, weight } of lists) {
    if (weight <= 0) continue;

    hits.forEach((hit, index) => {
      const rank = index + 1; // 1-indexed
      scoreMap.set(
        hit.id,
        (scoreMap.get(hit.id) ?? 0) + weight / (RRF_K + rank),
      );

      // Keep the first-seen metadata (content/heading/url) for this id.
      // All lists read from the same table, so the content is identical
      // whichever channel surfaced it first.
      if (!metaMap.has(hit.id)) {
        metaMap.set(hit.id, {
          id: hit.id,
          content: hit.content,
          heading: hit.heading,
          url: hit.url,
        });
      }
    });
  }

  const fused: FusedHit[] = Array.from(scoreMap.entries()).map(
    ([id, rrfScore]) => ({
      ...(metaMap.get(id)!),
      rrfScore,
    }),
  );

  fused.sort((a, b) => b.rrfScore - a.rrfScore);
  return fused;
}

/**
 * Normalises an RRF score to a 0..1 confidence range.
 *
 * Used as a *fallback* confidence when the cross-encoder reranker is
 * unavailable. RRF scores are not probabilities — they're bounded by
 * Σ weight/k over however many lists an item appeared in — so we scale by the
 * maximum achievable score for a document that ranked #1 in EVERY weighted
 * list. A doc found by only one channel therefore lands below 1.0, which is
 * the behaviour we want: it genuinely had less corroboration.
 */
export function normalizeRrfScore(score: number, totalWeight: number): number {
  if (totalWeight <= 0) return 0;
  const maxPossible = totalWeight / (RRF_K + 1); // rank 1 in every list
  return Math.max(0, Math.min(1, score / maxPossible));
}