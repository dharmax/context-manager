export interface RankedItem {
  id: string;
  score?: number;
}

export interface FusionResult {
  id: string;
  rrfScore: number;
  ranks: Record<string, number>;
}

export interface RrfOptions {
  /**
   * Smoothing constant (k). Standard default is 60.
   */
  k?: number;
  /**
   * Weights per ranked list key, e.g. { lexical: 1.0, vector: 1.2 }
   */
  weights?: Record<string, number>;
}

/**
 * Merges multiple ranked lists into a single fused ranking using Reciprocal Rank Fusion (RRF).
 */
export function reciprocalRankFusion(
  rankedLists: Record<string, RankedItem[]>,
  options: RrfOptions = {}
): FusionResult[] {
  const k = options.k ?? 60;
  const weights = options.weights ?? {};
  const scores: Map<string, { rrfScore: number; ranks: Record<string, number> }> = new Map();

  for (const [sourceName, list] of Object.entries(rankedLists)) {
    const weight = weights[sourceName] ?? 1.0;

    for (let index = 0; index < list.length; index++) {
      const item = list[index];
      const rank = index + 1; // 1-indexed rank
      const reciprocalScore = weight * (1 / (k + rank));

      const entry = scores.get(item.id) ?? {
        rrfScore: 0,
        ranks: {}
      };

      entry.rrfScore += reciprocalScore;
      entry.ranks[sourceName] = rank;
      scores.set(item.id, entry);
    }
  }

  const results: FusionResult[] = [];
  for (const [id, data] of scores.entries()) {
    results.push({
      id,
      rrfScore: data.rrfScore,
      ranks: data.ranks
    });
  }

  return results.sort((a, b) => b.rrfScore - a.rrfScore);
}
