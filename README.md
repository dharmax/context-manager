# @dharmax/context-manager

High-performance, Bun-native prompt context engine with hybrid retrieval (BM25 + Vector RRF), SQLite FTS5, priority budgeting, and non-destructive compression. Designed for seamless use with [`@dharmax/llm-utils`](https://github.com/dharmax/llm-utils) and autonomous AI agent pipelines.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Context Resolution Pipeline                               │
├────────────────────┬──────────────────────┬────────────────────────────────────────────┤
│  Retrieval Layer   │   Rank & Merge       │     Token Budgeting & Formats              │
├────────────────────┼──────────────────────┼────────────────────────────────────────────┤
│ • MemoryStore      │                      │ • Priority Knapsack (Hard Ceiling)         │
│   (BM25 Lexical)   │ ──► RRF Fusion ──►   │ • Multi-Format: XML, Markdown, JSON, Plain │
│ • BunSqliteStore   │     (Rank Merging)   │ • Head-Tail Log Compressor                 │
│   (Native FTS5)    │                      │ • Code Outline / AST Extractor             │
│ • Vector Adapters  │                      │ • Inline Query Syntax (category: tag:)     │
└────────────────────┴──────────────────────┴────────────────────────────────────────────┘
```

---

## Highlights

* **Bun First-Class**: Powered by native `bun:sqlite` for lightning-fast FTS5 full-text queries and zero-dependency in-memory/on-disk storage.
* **Hybrid Retrieval (RRF)**: Merges sparse lexical scores (BM25 / FTS5) and dense embeddings (Vector DBs) using mathematical Reciprocal Rank Fusion ($k=60$) with zero arbitrary magic weights.
* **Inline Query Syntax**: Parse human or agent prompts containing inline operators (`category:security`, `tag:auth`, `priority:pinned`, `"exact phrase"`) automatically.
* **Strict Priority Knapsack Packing**: Guaranteed hard token ceilings without first-item overflow bugs. Prioritizes context tiers: `pinned` > `working` > `retrieved` > `history`.
* **Multi-Format Prompt Rendering**: Renders ready-to-inject context in modern LLM formats: XML (`<context><item ...>`), Markdown (`### Title`), JSON, or Plain text.
* **Non-Destructive Compression**: Structural code outline extraction and head-tail log compaction instead of destructive mid-sentence truncation.
* **Drop-in `@dharmax/llm-utils` Interop**: Implements `PromptContextManager` interface for 1-line context injection into `Asker.ask()` and `Asker.prompt()`.

---

## Installation

```sh
# Bun (Recommended)
bun add @dharmax/context-manager

# Node.js
npm install @dharmax/context-manager
```

---

## Quickstart (Zero-Boilerplate)

```ts
import { createContextManager } from '@dharmax/context-manager';

const contextManager = createContextManager({ defaultMaxTokens: 800 });

// 1. Add context blocks (rules, documentation, notes)
await contextManager.add([
  {
    id: 'auth-spec',
    title: 'OAuth2 Verification Rules',
    body: 'Always verify JWT signatures with RS256 and inspect the exp claim.',
    category: 'security',
    tags: ['auth', 'jwt'],
    priority: 'pinned' // Guaranteed to stay in context
  },
  {
    id: 'db-spec',
    title: 'PostgreSQL Connection Pooling',
    body: 'Use pgBouncer connection pools with a maximum of 20 connections.',
    category: 'database',
    tags: ['postgres', 'sql']
  }
]);

// 2. Resolve context with inline query operators
const result = await contextManager.resolve({
  query: 'category:security How do I authenticate incoming requests?',
  output: { format: 'xml' } // 'xml' | 'markdown' | 'json' | 'plain'
});

console.log(result.rendered);
// Output:
// <context>
//   <item id="auth-spec" priority="pinned" title="OAuth2 Verification Rules">
//     Always verify JWT signatures with RS256 and inspect the exp claim.
//   </item>
// </context>
```

---

## Integration with `@dharmax/llm-utils`

Pass `ModularContextManager` directly into `Asker`:

```ts
import { Asker } from '@dharmax/llm-utils';
import { createContextManager } from '@dharmax/context-manager';

const context = createContextManager();
await context.add({
  id: 'style-guide',
  title: 'CSS Guidelines',
  body: 'Use native CSS nesting and scoped component styles.',
  category: 'frontend'
});

const asker = new Asker({ context });

// Context is automatically retrieved, budgeted, and injected into the prompt
const res = await asker.ask('Write a button component', {
  model: 'openai/gpt-4o'
});
```

---

## Native Bun SQLite FTS5 Store

Leverage Bun's built-in SQLite engine (`bun:sqlite`) for indexed, zero-infra full-text search:

```ts
import { createContextManager, createSqliteStore } from '@dharmax/context-manager';

// In-Memory or On-Disk persistent store
const store = createSqliteStore({ filename: './context.db' });

await store.add([
  {
    id: 'doc-1',
    title: 'TypeScript Performance',
    body: 'Avoid deep recursive type mappings on hot execution paths.',
    tags: ['ts', 'performance']
  }
]);

const manager = createContextManager({ store });
```

---

## Advanced Guides & Recipes

### 1. Hybrid Search (FTS5 / BM25 + Vector DB via RRF)

Plug in any vector index (e.g. Orama, `sqlite-vec`, LanceDB, Qdrant) alongside a lexical store:

```ts
import { HybridContextStore, MemoryContextStore, type VectorStoreAdapter } from '@dharmax/context-manager';

const vectorAdapter: VectorStoreAdapter = {
  async search(query: string, limit: number) {
    const embedding = await myEmbedder(query);
    return await myVectorDb.query(embedding, limit); // returns [{ id, score }]
  }
};

const hybridStore = new HybridContextStore({
  lexicalStore: new MemoryContextStore(),
  vectorStore: vectorAdapter,
  rrfOptions: { k: 60 } // Standard RRF smoothing constant
});

const manager = createContextManager({ store: hybridStore });
```

---

### 2. Priority-Tiered Token Packing

Ensure critical instructions are never dropped while dynamically trimming less important history:

```ts
await manager.add([
  {
    id: 'sys-rules',
    title: 'System Rules',
    body: 'Never output private API keys.',
    priority: 'pinned' // Tier 0 (Highest - never evicted)
  },
  {
    id: 'active-file',
    title: 'Current File: index.ts',
    body: 'export function run() { ... }',
    priority: 'working' // Tier 1
  },
  {
    id: 'faq',
    title: 'General FAQ',
    body: 'Frequently asked questions...',
    priority: 'retrieved' // Tier 2
  }
]);

// Knapsack packing fills: Tier 0 -> Tier 1 -> Tier 2 -> History
// until the maxTokens budget ceiling is reached.
```

---

### 3. Non-Destructive Code & Log Compression

```ts
import { CodeOutlineCompressor, HeadTailCompressor, createContextManager } from '@dharmax/context-manager';

// Compress code files by extracting type signatures, interfaces, and function headers:
const codeManager = createContextManager({
  compressor: new CodeOutlineCompressor()
});

// Truncate long build logs safely keeping top and bottom output:
const logManager = createContextManager({
  compressor: new HeadTailCompressor({ headLines: 10, tailLines: 10 })
});
```

---

## Context Diagnostics & Provenance

Every `resolve()` call returns comprehensive diagnostic telemetry for evaluation and debugging:

```ts
const result = await contextManager.resolve({ query: 'database' });

console.log(result.diagnostics);
/*
{
  strategy: 'priority-knapsack-packing',
  format: 'markdown',
  budget: {
    requested: 800,
    used: 342,
    itemsIncluded: 2,
    itemsExcluded: 1
  },
  excluded: [
    { id: 'large-doc', reason: 'budget' }
  ]
}
*/
```

---

## AI Agent Integration Guidelines

When using `@dharmax/context-manager` in autonomous agents or background workers:

1. **Keep System Rules Pinned**: Mark safety constraints and mandatory schemas with `priority: 'pinned'` so they are never evicted under tight token constraints.
2. **Use Inline Modifiers**: Pass structured prompt queries like `category:api tag:auth "JWT validation" verify token` to automatically scope retrieval.
3. **Format Selection**: Prefer `format: 'xml'` when prompting Claude, Gemini, or OpenAI for clean item demarcation.

---

## Development & Testing

```sh
# Run Bun tests (ultra-fast)
bun test

# Run TypeScript build
bun run build
```

---

## License

MIT © [dharmax](https://github.com/dharmax)
