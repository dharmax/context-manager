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
* **Drop-in `@dharmax/llm-utils` Interop**: Implements `PromptContextManager` interface for 1-line context injection into `Asker.ask()`, `Asker.prompt()`, and `LLMSession`.

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

## Dynamic Auto-Tagging & Entity Ingestion

Use `Asker.json()` with fast or local models (`task: 'fast'` / `preferLocal: true`) to automatically extract tags and categories before indexing documents:

```ts
import { Asker, z } from '@dharmax/llm-utils';
import { createContextManager } from '@dharmax/context-manager';

const asker = new Asker();
const contextManager = createContextManager();

const MetadataSchema = z.object({
  category: z.string(),
  tags: z.array(z.string()),
  summary: z.string()
});

async function autoIngest(id: string, title: string, content: string) {
  // Extract metadata locally or using fast cloud models
  const res = await asker.json(
    `Extract 1 category, 3-5 tags, and a 1-sentence summary:\n\nTitle: ${title}\n${content}`,
    MetadataSchema,
    { task: 'fast', preferLocal: true }
  );

  await contextManager.add({
    id,
    title,
    body: content,
    category: res.data?.category,
    tags: res.data?.tags,
    metadata: { summary: res.data?.summary }
  });
}
```

---

## Production Recipe: Long-Running Sessions with Smart Model Routing

For long sessions (20–100+ turns), pair `LLMSession` with `ModularContextManager` and `ModelRouter` to prevent token window explosion while keeping costs and latency minimal:

```ts
import { Asker, LLMSession, z } from '@dharmax/llm-utils';
import { createContextManager, createSqliteStore } from '@dharmax/context-manager';

// 1. Set up persistent SQLite context store
const contextStore = createSqliteStore({ filename: './session-context.db' });
const context = createContextManager({
  store: contextStore,
  defaultMaxTokens: 1200 // Dedicated token budget for context + history
});

// Pinned global system rules (never evicted)
await context.add({
  id: 'system-guidelines',
  title: 'Core Constraints',
  body: 'Always write concise TypeScript. Prefer Bun APIs.',
  priority: 'pinned'
});

const asker = new Asker({ context });
const session = new LLMSession(asker, { maxHistory: 6 }); // Keep last 6 raw turns in immediate memory

// 2. Compact older turns into structured milestone blocks
async function compactOlderTurns(history: Array<{ role: string; content: string }>) {
  if (history.length < 6) return;

  // Use fast/summarization model route (e.g. Gemini 2.0 Flash or local Ollama)
  const summaryResult = await asker.json(
    `Summarize the key facts, decisions, and user preferences from this dialogue:\n\n` +
    history.map(m => `[${m.role}]: ${m.content}`).join('\n'),
    z.object({
      milestone: z.string(),
      decisions: z.array(z.string()),
      tags: z.array(z.string())
    }),
    { task: 'summarization' }
  );

  if (summaryResult.ok && summaryResult.data) {
    // Ingest summary block as working session memory
    await context.add({
      id: `milestone-${Date.now()}`,
      title: `Session Milestone: ${summaryResult.data.milestone}`,
      body: summaryResult.data.decisions.join('\n'),
      category: 'session-summary',
      tags: summaryResult.data.tags,
      priority: 'working' // High priority working context
    });
  }
}

// 3. Multi-turn execution with task-routed reasoning
async function chat(userPrompt: string) {
  // Main reasoning uses powerful model (e.g. 'code' or 'reasoning' route)
  const reply = await session.ask(userPrompt, {
    task: 'code' // Automatically routed to GPT-4o / Claude 3.7 Sonnet / Qwen Coder
  });

  // Background compaction for turns exceeding rolling threshold
  if (session.getHistory().length >= 6) {
    compactOlderTurns(session.getHistory()).catch(console.error);
  }

  return reply.text;
}
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

## Limitations & Engineering Trade-offs

When designing long-session agent architectures, be aware of the following trade-offs:

| Limitation | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Lossy Compaction** | Summarizing old turns loses exact code lines and quotes. | Retain code snippets in dedicated code blocks (`priority: 'working'`) rather than conversational prose. |
| **Temporal Contradiction** | User changing their mind on Turn 40 can conflict with Turn 5 summary. | Store timestamps/versions in block `metadata` and apply recency-weighted scoring. |
| **Extraction Model Variance** | Small local models (3B) may miss subtle edge-case entities. | Use `task: 'fast'` (Gemini 2.0 Flash) or `task: 'code'` for complex structured entity extraction. |
| **Synchronous Latency Jitter** | Running compaction during user turns adds 300–800ms latency. | Fire compaction asynchronously in the background (`compact().catch()`). |
| **Retrieval Vocabulary Mismatch** | Unrelated phrasing can miss lexical keywords. | Use `HybridContextStore` with embeddings so semantic meaning is captured even if keywords differ. |

---

## License

MIT © [dharmax](https://github.com/dharmax)
