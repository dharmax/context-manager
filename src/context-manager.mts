import { packContext } from './packer.mjs';
import { parseContextQuery } from './query-parser.mjs';
import { MemoryContextStore } from './stores/memory-store.mjs';
import { BunSqliteContextStore, type SqliteStoreOptions } from './stores/sqlite-store.mjs';
import type {
  ContextBlock,
  ContextCompressorAdapter,
  ContextFormat,
  ContextItem,
  ContextRequest,
  ContextResult,
  ContextStoreAdapter,
  PromptContextManager,
  TokenizerFunction
} from './types.mjs';

export interface ModularContextManagerOptions {
  store?: ContextStoreAdapter;
  defaultMaxTokens?: number;
  defaultMaxItems?: number;
  compressor?: ContextCompressorAdapter;
  tokenizer?: TokenizerFunction;
  format?: ContextFormat;
}

export class ModularContextManager implements PromptContextManager {
  private store: ContextStoreAdapter;
  private defaultMaxTokens: number;
  private defaultMaxItems: number;
  private compressor?: ContextCompressorAdapter;
  private tokenizer?: TokenizerFunction;
  private defaultFormat: ContextFormat;

  constructor(options: ModularContextManagerOptions = {}) {
    this.store = options.store ?? new MemoryContextStore();
    this.defaultMaxTokens = options.defaultMaxTokens ?? 1500;
    this.defaultMaxItems = options.defaultMaxItems ?? 10;
    this.compressor = options.compressor;
    this.tokenizer = options.tokenizer;
    this.defaultFormat = options.format ?? 'markdown';
  }

  getStore(): ContextStoreAdapter {
    return this.store;
  }

  async add(blocks: ContextBlock | ContextBlock[]): Promise<this> {
    await this.store.add(blocks);
    return this;
  }

  async addBlock(block: ContextBlock): Promise<this> {
    await this.store.add(block);
    return this;
  }

  async clear(): Promise<this> {
    if (this.store.clear) {
      await this.store.clear();
    }
    return this;
  }

  /**
   * Directly queries the store and returns scored items without prompt packing.
   */
  async search(query: string, options: { categories?: string[]; tags?: string[]; limit?: number } = {}) {
    const parsed = parseContextQuery(query, options.categories, options.tags);
    return this.store.query({
      query: parsed.cleanQuery || query,
      categories: parsed.categories,
      tags: parsed.tags,
      limit: options.limit ?? this.defaultMaxItems
    });
  }

  /**
   * Implements PromptContextManager for @dharmax/llm-utils.
   */
  async resolve(request: ContextRequest): Promise<ContextResult> {
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;
    const maxItems = request.maxItems ?? this.defaultMaxItems;
    const format = request.output?.format ?? this.defaultFormat;

    // 1. Parse inline query operators (category:tag/etc) and merge with request parameters
    const parsed = parseContextQuery(request.query, request.categories, request.tags);

    // 2. Retrieve candidates from store
    const scoredBlocks = await this.store.query({
      query: parsed.cleanQuery || request.query,
      categories: parsed.categories,
      tags: parsed.tags,
      limit: maxItems * 2
    });

    const candidates: ContextItem[] = scoredBlocks.map(({ block, score, rationale }) => ({
      id: block.id,
      title: block.title,
      content: block.body,
      kind: 'note',
      score,
      source: block.source ?? block.category,
      priority: block.priority ?? parsed.priority ?? 'retrieved',
      rationale,
      metadata: {
        category: block.category,
        tags: block.tags,
        ...block.metadata
      }
    }));

    // 3. Add history items if present
    if (request.history && request.history.length > 0) {
      for (let i = 0; i < request.history.length; i++) {
        const h = request.history[i];
        candidates.push({
          id: `history-${i}`,
          title: `History: ${h.role}`,
          content: h.content,
          kind: 'history',
          priority: 'history',
          score: 1.0 / (request.history.length - i)
        });
      }
    }

    // 4. Pack into token budget
    const packed = await packContext(candidates, {
      maxTokens,
      maxItems,
      format,
      tokenizer: this.tokenizer,
      compressor: this.compressor
    });

    return {
      items: packed.items,
      rendered: packed.rendered,
      diagnostics: packed.diagnostics
    };
  }
}

/**
 * Factory helper for creating context managers with zero boilerplate.
 */
export function createContextManager(options?: ModularContextManagerOptions): ModularContextManager {
  return new ModularContextManager(options);
}

export function createMemoryStore(initialBlocks?: ContextBlock[]): MemoryContextStore {
  const store = new MemoryContextStore();
  if (initialBlocks && initialBlocks.length > 0) {
    store.add(initialBlocks);
  }
  return store;
}

export function createSqliteStore(options?: SqliteStoreOptions, initialBlocks?: ContextBlock[]): BunSqliteContextStore {
  const store = new BunSqliteContextStore(options);
  if (initialBlocks && initialBlocks.length > 0) {
    store.add(initialBlocks);
  }
  return store;
}

/**
 * Backward-compatible alias for HeuristicContextManager.
 */
export interface HeuristicContextManagerOptions extends ModularContextManagerOptions {
  compressAboveWords?: number;
}

export class HeuristicContextManager extends ModularContextManager {
  constructor(options: HeuristicContextManagerOptions = {}) {
    super(options);
  }
}
