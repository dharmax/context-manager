import { reciprocalRankFusion, type RrfOptions } from '../rrf.mjs';
import type {
  ContextBlock,
  ContextStoreAdapter,
  ScoredContextBlock,
  StoreQueryOptions,
  VectorStoreAdapter
} from '../types.mjs';

export interface HybridStoreOptions {
  lexicalStore: ContextStoreAdapter;
  vectorStore: VectorStoreAdapter;
  rrfOptions?: RrfOptions;
}

export class HybridContextStore implements ContextStoreAdapter {
  private lexicalStore: ContextStoreAdapter;
  private vectorStore: VectorStoreAdapter;
  private rrfOptions?: RrfOptions;

  constructor(options: HybridStoreOptions) {
    this.lexicalStore = options.lexicalStore;
    this.vectorStore = options.vectorStore;
    this.rrfOptions = options.rrfOptions;
  }

  async add(blocks: ContextBlock | ContextBlock[]): Promise<void> {
    const list = Array.isArray(blocks) ? blocks : [blocks];
    await this.lexicalStore.add(list);

    if (this.vectorStore.upsert) {
      await Promise.all(
        list.map(block =>
          this.vectorStore.upsert!(block.id, `${block.title}\n${block.body}`, block.metadata)
        )
      );
    }
  }

  async delete(id: string): Promise<void> {
    if (this.lexicalStore.delete) {
      await this.lexicalStore.delete(id);
    }
  }

  async clear(): Promise<void> {
    if (this.lexicalStore.clear) {
      await this.lexicalStore.clear();
    }
  }

  async list(): Promise<ContextBlock[]> {
    if (this.lexicalStore.list) {
      return this.lexicalStore.list();
    }
    return [];
  }

  async query(options: StoreQueryOptions): Promise<ScoredContextBlock[]> {
    const limit = options.limit ?? 20;

    // Run lexical and vector retrieval in parallel
    const [lexicalScored, vectorHits] = await Promise.all([
      this.lexicalStore.query({ ...options, limit: limit * 2 }),
      this.vectorStore.search(options.query, limit * 2)
    ]);

    // Build block lookup map from lexical store candidates and full list
    const blockMap: Map<string, ContextBlock> = new Map();
    for (const item of lexicalScored) {
      blockMap.set(item.block.id, item.block);
    }

    // If vector hits returned IDs not in lexical results, retrieve from lexical store list
    const missingIds = vectorHits.filter(hit => !blockMap.has(hit.id)).map(hit => hit.id);
    if (missingIds.length > 0 && this.lexicalStore.list) {
      const allBlocks = await this.lexicalStore.list();
      for (const block of allBlocks) {
        if (missingIds.includes(block.id)) {
          blockMap.set(block.id, block);
        }
      }
    }

    // Format for RRF
    const lexicalRanked = lexicalScored.map(s => ({ id: s.block.id, score: s.score }));
    const vectorRanked = vectorHits.map(v => ({ id: v.id, score: v.score }));

    const fused = reciprocalRankFusion(
      {
        lexical: lexicalRanked,
        vector: vectorRanked
      },
      this.rrfOptions
    );

    const results: ScoredContextBlock[] = [];
    for (const item of fused) {
      const block = blockMap.get(item.id);
      if (!block) continue;

      // Filter verification
      if (options.categories && options.categories.length > 0) {
        if (!block.category || !options.categories.includes(block.category)) {
          continue;
        }
      }

      if (options.tags && options.tags.length > 0) {
        const blockTags = block.tags ?? [];
        if (!options.tags.some(t => blockTags.includes(t))) {
          continue;
        }
      }

      const ranksStr = Object.entries(item.ranks)
        .map(([k, rank]) => `${k}:#${rank}`)
        .join(', ');

      results.push({
        block,
        score: item.rrfScore,
        rationale: [`rrf(${ranksStr})`]
      });
    }

    return results.slice(0, limit);
  }
}
