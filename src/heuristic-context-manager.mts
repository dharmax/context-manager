import { LeanContextCompressor } from './compression.mjs';
import { ContextBlock, ContextItem, ContextRequest, ContextResult, ContextStore } from './types.mjs';

export interface HeuristicContextManagerOptions {
  defaultMaxItems?: number;
  defaultMaxTokens?: number;
  compressAboveWords?: number;
}

export class HeuristicContextManager {
  private defaultMaxItems: number;
  private defaultMaxTokens: number;
  private compressAboveWords: number;

  constructor(
    private store: ContextStore,
    options: HeuristicContextManagerOptions = {}
  ) {
    this.defaultMaxItems = options.defaultMaxItems ?? 10;
    this.defaultMaxTokens = options.defaultMaxTokens ?? 700;
    this.compressAboveWords = options.compressAboveWords ?? 140;
  }

  async resolve(request: ContextRequest): Promise<ContextResult> {
    const categories = request.categories ?? [];
    const queried = await this.store.query(request.query, categories);
    const scored = queried
      .map(block => this.scoreBlock(block, request.query, categories))
      .filter(entry => entry.score > 0 || categories.length > 0)
      .sort((a, b) => b.score - a.score);

    const maxItems = request.maxItems ?? this.defaultMaxItems;
    const requestedBudget = request.maxTokens ?? this.defaultMaxTokens;
    const selected = scored.slice(0, maxItems);
    const items: ContextItem[] = [];
    const excluded: Array<{ id: string; reason: string }> = [];
    let usedBudget = 0;

    for (const entry of selected) {
      const compressedContent = await this.maybeCompress(entry.block.body);
      const item = this.toContextItem(entry.block, compressedContent, entry.score, entry.rationale);
      const itemCost = estimateTokenCost(item.title, item.content);

      if (items.length > 0 && usedBudget + itemCost > requestedBudget) {
        excluded.push({ id: entry.block.id, reason: 'budget' });
        continue;
      }

      items.push(item);
      usedBudget += itemCost;
    }

    for (const entry of scored.slice(maxItems)) {
      excluded.push({ id: entry.block.id, reason: 'maxItems' });
    }

    return {
      items,
      rendered: renderItems(items, request.output?.format ?? 'markdown'),
      diagnostics: {
        strategy: 'heuristic-block-retrieval',
        budget: {
          requested: requestedBudget,
          used: usedBudget
        },
        excluded
      }
    };
  }

  private scoreBlock(block: ContextBlock, query: string, categories: string[]) {
    const lowerQuery = query.toLowerCase();
    const normalizedBody = block.body.toLowerCase();
    const normalizedTitle = block.title.toLowerCase();
    const rationale: string[] = [];
    let score = 0;

    if (categories.length > 0 && categories.includes(block.category)) {
      score += 3;
      rationale.push(`category:${block.category}`);
    }

    for (const tag of block.tags) {
      const normalizedTag = tag.toLowerCase();
      if (normalizedTag && lowerQuery.includes(normalizedTag)) {
        score += 10;
        rationale.push(`tag:${tag}`);
      }
    }

    if (normalizedTitle && lowerQuery.includes(normalizedTitle)) {
      score += 5;
      rationale.push('title');
    }

    const keywords = lowerQuery.split(/\s+/).filter(word => word.length > 4);
    for (const keyword of keywords) {
      if (normalizedBody.includes(keyword)) {
        score += 1;
        rationale.push(`body:${keyword}`);
      }
    }

    return {
      block,
      score,
      rationale: [...new Set(rationale)]
    };
  }

  private async maybeCompress(text: string): Promise<string> {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length <= this.compressAboveWords) return text.trim();
    return LeanContextCompressor.patternCompress(text, this.compressAboveWords);
  }

  private toContextItem(block: ContextBlock, content: string, score: number, rationale: string[]): ContextItem {
    return {
      id: block.id,
      kind: 'note',
      title: block.title,
      content,
      score,
      source: block.category,
      rationale,
      metadata: {
        category: block.category,
        tags: block.tags
      }
    };
  }
}

function renderItems(items: ContextItem[], format: 'markdown' | 'plain'): string {
  if (format === 'plain') {
    return items.map(item => `${item.title}\n${item.content}`.trim()).join('\n\n');
  }

  return items.map(item => `### ${item.title}\n${item.content}`.trim()).join('\n\n');
}

function estimateTokenCost(title: string, content: string): number {
  return Math.ceil(`${title}\n${content}`.split(/\s+/).filter(Boolean).length * 1.3);
}
