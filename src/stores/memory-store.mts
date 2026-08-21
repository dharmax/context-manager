import type {
  ContextBlock,
  ContextStoreAdapter,
  ScoredContextBlock,
  StoreQueryOptions
} from '../types.mjs';

export interface MemoryStoreOptions {
  titleWeight?: number;
  tagWeight?: number;
  bodyWeight?: number;
  minScoreThreshold?: number;
}

export class MemoryContextStore implements ContextStoreAdapter {
  private blocks: Map<string, ContextBlock> = new Map();
  private titleWeight: number;
  private tagWeight: number;
  private bodyWeight: number;
  private minScoreThreshold: number;

  constructor(options: MemoryStoreOptions = {}) {
    this.titleWeight = options.titleWeight ?? 3.0;
    this.tagWeight = options.tagWeight ?? 5.0;
    this.bodyWeight = options.bodyWeight ?? 1.0;
    this.minScoreThreshold = options.minScoreThreshold ?? 0.05;
  }

  async add(blocks: ContextBlock | ContextBlock[]): Promise<void> {
    const list = Array.isArray(blocks) ? blocks : [blocks];
    for (const block of list) {
      this.blocks.set(block.id, { ...block, tags: block.tags ?? [] });
    }
  }

  async delete(id: string): Promise<void> {
    this.blocks.delete(id);
  }

  async clear(): Promise<void> {
    this.blocks.clear();
  }

  async list(): Promise<ContextBlock[]> {
    return Array.from(this.blocks.values());
  }

  async query(options: StoreQueryOptions): Promise<ScoredContextBlock[]> {
    const { query, categories, tags, limit = 20, metadataFilter } = options;
    const queryTerms = tokenize(query);

    const scored: ScoredContextBlock[] = [];

    for (const block of this.blocks.values()) {
      // 1. Strict Category Filter
      if (categories && categories.length > 0) {
        if (!block.category || !categories.includes(block.category)) {
          continue;
        }
      }

      // 2. Strict Tag Filter (if requested)
      if (tags && tags.length > 0) {
        const blockTags = block.tags ?? [];
        const hasTag = tags.some(t => blockTags.includes(t));
        if (!hasTag) {
          continue;
        }
      }

      // 3. Metadata Filter
      if (metadataFilter && !metadataFilter(block.metadata)) {
        continue;
      }

      // 4. Calculate Relevance Score
      const { score, rationale } = this.calculateRelevance(block, queryTerms, query);

      // If query is empty but filter matched, assign default baseline score
      const finalScore = queryTerms.length === 0 ? 1.0 : score;

      if (finalScore >= this.minScoreThreshold) {
        scored.push({
          block,
          score: finalScore,
          rationale
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  private calculateRelevance(block: ContextBlock, queryTerms: string[], rawQuery: string) {
    let score = 0;
    const rationale: string[] = [];

    if (queryTerms.length === 0) {
      return { score: 0, rationale: ['no-query'] };
    }

    const titleTokens = new Set(tokenize(block.title));
    const bodyTokens = tokenize(block.body);
    const blockTags = (block.tags ?? []).map(t => t.toLowerCase());
    const lowerQuery = rawQuery.toLowerCase();

    // Body token frequencies (TF)
    const bodyTermFreq: Map<string, number> = new Map();
    for (const token of bodyTokens) {
      bodyTermFreq.set(token, (bodyTermFreq.get(token) ?? 0) + 1);
    }

    for (const term of queryTerms) {
      // Title match
      if (titleTokens.has(term)) {
        score += this.titleWeight;
        rationale.push(`title:${term}`);
      }

      // Tag exact match
      if (blockTags.includes(term)) {
        score += this.tagWeight;
        rationale.push(`tag:${term}`);
      }

      // Body term frequency with saturation: count / (count + 1.5)
      const count = bodyTermFreq.get(term) ?? 0;
      if (count > 0) {
        const tf = (count / (count + 1.5)) * this.bodyWeight;
        score += tf;
        rationale.push(`body:${term}(x${count})`);
      }
    }

    // Exact phrase match bonus
    if (block.title.toLowerCase().includes(lowerQuery) && lowerQuery.length > 3) {
      score += this.titleWeight * 1.5;
      rationale.push('title-phrase-match');
    }

    return {
      score,
      rationale: [...new Set(rationale)]
    };
  }
}

function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter(token => token.length > 1);
}
