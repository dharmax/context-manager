import type {
  ContextCompressorAdapter,
  ContextDiagnostics,
  ContextFormat,
  ContextItem,
  ContextPriority,
  TokenizerFunction
} from './types.ts';

export interface PackOptions {
  maxTokens: number;
  maxItems?: number;
  format?: ContextFormat;
  tokenizer?: TokenizerFunction;
  compressor?: ContextCompressorAdapter;
  minCompressibleTokens?: number;
}

export interface PackResult {
  items: ContextItem[];
  rendered: string;
  diagnostics: ContextDiagnostics;
}

const PRIORITY_ORDER: Record<ContextPriority, number> = {
  pinned: 0,
  working: 1,
  retrieved: 2,
  history: 3
};

/**
 * Calibrated token estimator: 1 token ~= 3.7 characters.
 */
export function defaultEstimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.7);
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderContextItem(item: ContextItem, format: ContextFormat = 'markdown'): string {
  switch (format) {
    case 'xml':
      return `<item id="${escapeXml(item.id)}" priority="${item.priority ?? 'retrieved'}" title="${escapeXml(item.title)}">\n${item.content}\n</item>`;
    case 'json':
      return JSON.stringify({
        id: item.id,
        title: item.title,
        content: item.content,
        priority: item.priority
      });
    case 'plain':
      return `${item.title}\n${item.content}`.trim();
    case 'markdown':
    default:
      return `### ${item.title}\n${item.content}`.trim();
  }
}

export function renderContextItems(items: ContextItem[], format: ContextFormat = 'markdown'): string {
  if (items.length === 0) return '';
  switch (format) {
    case 'xml':
      return `<context>\n${items.map(i => `  ${renderContextItem(i, 'xml').replace(/\n/g, '\n  ')}`).join('\n')}\n</context>`;
    case 'json':
      return JSON.stringify(
        items.map(i => ({
          id: i.id,
          title: i.title,
          content: i.content,
          priority: i.priority,
          metadata: i.metadata
        })),
        null,
        2
      );
    case 'plain':
      return items.map(i => renderContextItem(i, 'plain')).join('\n\n');
    case 'markdown':
    default:
      return items.map(i => renderContextItem(i, 'markdown')).join('\n\n');
  }
}

/**
 * Packs context items into a strict token budget with priority ordering, format awareness, and optional compression.
 */
export async function packContext(
  candidates: ContextItem[],
  options: PackOptions
): Promise<PackResult> {
  const {
    maxTokens,
    maxItems = candidateLimit(candidates.length),
    format = 'markdown',
    tokenizer = defaultEstimateTokens,
    compressor
  } = options;

  if (maxTokens <= 0) {
    return {
      items: [],
      rendered: '',
      diagnostics: {
        strategy: 'priority-knapsack-packing',
        format,
        budget: { requested: maxTokens, used: 0, itemsIncluded: 0, itemsExcluded: candidates.length },
        excluded: candidates.map(c => ({ id: c.id, reason: 'budget' }))
      }
    };
  }

  // Stable sort: Pinned (0) > Working (1) > Retrieved (2) > History (3), then score descending
  const sorted = [...candidates].sort((a, b) => {
    const priorityA = PRIORITY_ORDER[a.priority ?? 'retrieved'] ?? 2;
    const priorityB = PRIORITY_ORDER[b.priority ?? 'retrieved'] ?? 2;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return (b.score ?? 0) - (a.score ?? 0);
  });

  const items: ContextItem[] = [];
  const excluded: Array<{ id: string; reason: 'budget' | 'maxItems' | 'filtered' | 'lowScore' }> = [];
  let usedBudget = 0;

  for (const candidate of sorted) {
    if (items.length >= maxItems) {
      excluded.push({ id: candidate.id, reason: 'maxItems' });
      continue;
    }

    let currentItem = candidate;
    let rendered = renderContextItem(currentItem, format);
    let itemTokens = tokenizer(rendered);

    const remainingBudget = maxTokens - usedBudget;

    // Attempt non-destructive compression if item exceeds remaining budget
    if (itemTokens > remainingBudget && compressor && remainingBudget > 20) {
      try {
        const compressedContent = await compressor.compress(currentItem.content, remainingBudget);
        if (compressedContent && compressedContent !== currentItem.content) {
          currentItem = {
            ...currentItem,
            content: compressedContent
          };
          rendered = renderContextItem(currentItem, format);
          itemTokens = tokenizer(rendered);
        }
      } catch {
        // Fallback to uncompressed evaluation
      }
    }

    if (itemTokens <= remainingBudget) {
      items.push(currentItem);
      usedBudget += itemTokens;
    } else {
      excluded.push({ id: candidate.id, reason: 'budget' });
    }
  }

  const renderedOutput = renderContextItems(items, format);

  return {
    items,
    rendered: renderedOutput,
    diagnostics: {
      strategy: 'priority-knapsack-packing',
      format,
      budget: {
        requested: maxTokens,
        used: usedBudget,
        itemsIncluded: items.length,
        itemsExcluded: excluded.length
      },
      excluded
    }
  };
}

function candidateLimit(length: number): number {
  return length > 0 ? length : 10;
}
