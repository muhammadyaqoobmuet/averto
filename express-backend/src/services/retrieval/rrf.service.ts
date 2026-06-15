/**
 * Reciprocal Rank Fusion (RRF) merge + dedupe.
 *
 * RRF combines multiple ranked result lists into a single unified ranking
 * without needing to normalise scores across lists (which is tricky when
 * mixing cosine distances and BM25 scores).
 *
 * Formula: score(item) = Σ  1 / (k + rank_in_list)
 *                         lists
 *
 * where k = 60 is the standard default. k dampens the effect of any single
 * list's top rank — a rank-1 item contributes 1/61 ≈ 0.016, while rank-10
 * contributes 1/70 ≈ 0.014. This prevents a strong signal in one list from
 * completely dominating over consistent mid-range appearances across lists.
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

/**
 * Merges N ranked result lists into a single deduplicated list ranked by
 * combined RRF score (descending).
 *
 * @param resultLists - Each sub-array is one ranked list. Items must have `id`.
 * @param k           - RRF constant (default 60, the widely-used value from the paper).
 */
export function fuseResults(resultLists: HitBase[][], k = 60): FusedHit[] {
  const scoreMap = new Map<string, number>();
  const metaMap = new Map<string, HitBase>();

  for (const list of resultLists) {
    list.forEach((hit, index) => {
      const rank = index + 1; // 1-indexed
      const contribution = 1 / (k + rank);

      scoreMap.set(hit.id, (scoreMap.get(hit.id) ?? 0) + contribution);

      // Keep the first-seen metadata (content/heading/url) for this id
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

  // Combine scores with metadata and sort descending
  const fused: FusedHit[] = Array.from(scoreMap.entries()).map(
    ([id, rrfScore]) => ({
      ...(metaMap.get(id)!),
      rrfScore,
    }),
  );

  fused.sort((a, b) => b.rrfScore - a.rrfScore);

  return fused;
}
