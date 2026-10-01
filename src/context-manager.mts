import { packContext } from './packer.mjs';
import { MemoryContextSource } from './source.mjs';
import type {
  ContextBlock,
  ContextCompressorAdapter,
  ContextFormat,
  ContextItem,
  ContextRequest,
  ContextResult,
  ContextSource,
  PromptContextManager,
  TokenizerFunction
} from './types.mjs';

export interface ModularContextManagerOptions {
  source?: ContextSource;
  defaultMaxTokens?: number;
  defaultMaxItems?: number;
  compressor?: ContextCompressorAdapter;
  tokenizer?: TokenizerFunction;
  format?: ContextFormat;
}

export class ModularContextManager implements PromptContextManager {
  private source: ContextSource;
  private defaultMaxTokens: number;
  private defaultMaxItems: number;
  private compressor?: ContextCompressorAdapter;
  private tokenizer?: TokenizerFunction;
  private defaultFormat: ContextFormat;

  constructor(options: ModularContextManagerOptions = {}) {
    this.source = options.source ?? new MemoryContextSource();
    this.defaultMaxTokens = options.defaultMaxTokens ?? 1500;
    this.defaultMaxItems = options.defaultMaxItems ?? 10;
    this.compressor = options.compressor;
    this.tokenizer = options.tokenizer;
    this.defaultFormat = options.format ?? 'markdown';
  }

  getSource(): ContextSource {
    return this.source;
  }

  async add(blocks: ContextBlock | ContextBlock[]): Promise<this> {
    if (!this.source.add) throw new Error('This context source is read-only');
    await this.source.add(blocks);
    return this;
  }

  async addBlock(block: ContextBlock): Promise<this> {
    return this.add(block);
  }

  async clear(): Promise<this> {
    if (this.source.clear) await this.source.clear();
    return this;
  }

  async search(query: string, options: { limit?: number; hints?: Record<string, unknown> } = {}) {
    return this.source.retrieve({
      query,
      limit: options.limit ?? this.defaultMaxItems,
      hints: options.hints
    });
  }

  async resolve(request: ContextRequest): Promise<ContextResult> {
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;
    const maxItems = request.maxItems ?? this.defaultMaxItems;
    const format = request.output?.format ?? this.defaultFormat;

    const scoredBlocks = await this.source.retrieve({
      query: request.query,
      limit: maxItems * 2,
      hints: request.hints
    });

    const candidates: ContextItem[] = scoredBlocks.map(({ block, score, rationale }) => ({
      id: block.id,
      title: block.title,
      content: block.body,
      kind: 'note',
      score,
      source: block.source,
      priority: block.priority ?? 'retrieved',
      rationale,
      metadata: block.metadata
    }));

    if (request.history) {
      for (let i = 0; i < request.history.length; i++) {
        const h = request.history[i];
        candidates.push({
          id: `history-${i}`,
          title: `History: ${h.role}`,
          content: h.content,
          kind: 'history',
          priority: 'history',
          score: 1 / (request.history.length - i)
        });
      }
    }

    return packContext(candidates, {
      maxTokens,
      maxItems,
      format,
      tokenizer: this.tokenizer,
      compressor: this.compressor
    });
  }
}

export function createContextManager(options?: ModularContextManagerOptions): ModularContextManager {
  return new ModularContextManager(options);
}

export function createMemorySource(initialBlocks?: ContextBlock[]): MemoryContextSource {
  return new MemoryContextSource(initialBlocks);
}

export interface HeuristicContextManagerOptions extends ModularContextManagerOptions {
  compressAboveWords?: number;
}

export class HeuristicContextManager extends ModularContextManager {}
