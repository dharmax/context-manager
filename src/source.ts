import type {
  ContextBlock,
  ContextSource,
  ContextSourceRequest,
  ScoredContextBlock
} from './types.ts';

export class MemoryContextSource implements ContextSource {
  private blocks = new Map<string, ContextBlock>();

  constructor(initialBlocks: ContextBlock[] = []) {
    for (const block of initialBlocks) this.blocks.set(block.id, block);
  }

  async add(blocks: ContextBlock | ContextBlock[]): Promise<void> {
    for (const block of Array.isArray(blocks) ? blocks : [blocks]) {
      this.blocks.set(block.id, block);
    }
  }

  async delete(id: string): Promise<void> {
    this.blocks.delete(id);
  }

  async clear(): Promise<void> {
    this.blocks.clear();
  }

  async list(): Promise<ContextBlock[]> {
    return [...this.blocks.values()];
  }

  async retrieve(request: ContextSourceRequest): Promise<ScoredContextBlock[]> {
    if (request.limit <= 0) return [];
    const terms = tokenize(request.query);
    const scored = [...this.blocks.values()].map(block => ({
      block,
      score: relevance(block, terms),
      rationale: ['memory-lexical']
    }));

    if (terms.length === 0) return scored.slice(0, request.limit);

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, request.limit);
  }
}

function relevance(block: ContextBlock, terms: string[]): number {
  if (terms.length === 0) return 1;

  const title = tokenize(block.title);
  const body = tokenize(block.body);
  let score = 0;

  for (const term of terms) {
    if (title.includes(term)) score += 3;
    score += body.filter(token => token === term).length;
  }

  return score;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9_-]+/).filter(token => token.length > 1);
}
