import type { ContextPriority } from './types.mjs';

export interface ParsedQuery {
  rawQuery: string;
  cleanQuery: string;
  categories: string[];
  tags: string[];
  priority?: ContextPriority;
  phrases: string[];
}

/**
 * Parses inline query operators like category:foo, tag:bar, priority:pinned, and "exact phrases".
 */
export function parseContextQuery(
  rawQuery: string,
  initialCategories: string[] = [],
  initialTags: string[] = []
): ParsedQuery {
  if (!rawQuery) {
    return {
      rawQuery: '',
      cleanQuery: '',
      categories: [...initialCategories],
      tags: [...initialTags],
      phrases: []
    };
  }

  const categories = new Set<string>(initialCategories);
  const tags = new Set<string>(initialTags);
  const phrases: string[] = [];
  let priority: ContextPriority | undefined;

  let query = rawQuery;

  // 1. Extract quoted phrases: "exact phrase"
  query = query.replace(/"([^"]+)"/g, (_, phrase) => {
    const trimmed = phrase.trim();
    if (trimmed) phrases.push(trimmed.toLowerCase());
    return '';
  });

  // 2. Extract inline category:foo
  query = query.replace(/\bcategory:([a-zA-Z0-9_-]+)/gi, (_, cat) => {
    categories.add(cat.toLowerCase());
    return '';
  });

  // 3. Extract inline tag:foo
  query = query.replace(/\btag:([a-zA-Z0-9_-]+)/gi, (_, tag) => {
    tags.add(tag.toLowerCase());
    return '';
  });

  // 4. Extract inline priority:pinned/working/retrieved/history
  query = query.replace(/\bpriority:(pinned|working|retrieved|history)\b/gi, (_, pri) => {
    priority = pri.toLowerCase() as ContextPriority;
    return '';
  });

  const cleanQuery = query.replace(/\s+/g, ' ').trim();

  return {
    rawQuery,
    cleanQuery,
    categories: Array.from(categories),
    tags: Array.from(tags),
    priority,
    phrases
  };
}
