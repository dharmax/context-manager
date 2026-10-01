# @dharmax/context-manager

A small prompt-context attention layer.

**Semantika owns semantic identity, taxonomy, persistence, and discovery. Context Manager owns prompt selection, priority, token budgets, compression, and rendering.**

## Architecture

```
user goal
   |
   v
Semantika tag search
   |
   v
taxonomy-aware artifact discovery
   |
   v
Context Manager
   |
   +-- priority
   +-- token budget
   +-- compression
   +-- rendering
   v
LLM prompt
```

There is deliberately no second database, vector index, tag system, category system, or hybrid-retrieval stack here.

## Semantika integration

Semantika entities are application-defined, so the adapter never guesses which fields are prompt content. Supply one explicit mapper:

```ts
import {
  createContextManager,
  createSemantikaSource
} from '@dharmax/context-manager'

const source = createSemantikaSource({
  semanticPackage: sp,
  toBlock: async artifact => {
    const entity = artifact as MyContextEntity
    await entity.populate('title', 'body', 'priority')

    return {
      id: entity.id,
      title: entity.title,
      body: entity.body,
      priority: entity.priority
    }
  }
})

const context = createContextManager({ source })

const result = await context.resolve({
  query: 'why are scheduled tasks staying RUNNING?',
  maxTokens: 1200
})
```

The source performs two-stage semantic retrieval:

1. `sp.tags.search(query)` resolves the user's goal to canonical semantic tags.
2. Matching tags retrieve their artifacts, including descendants by default.

Artifacts matched through multiple tags are deduplicated and ranked by their strongest tag match. Context Manager then performs prompt-specific packing.

Semantic tag search is optional in Semantika. Without a configured vector search, exact tag/alias lookup still works.

## In-memory source

For tests, ephemeral context, or applications that do not need persistent semantic discovery:

```ts
const context = createContextManager()

await context.add({
  id: 'style',
  title: 'Style rule',
  body: 'Prefer simple code.',
  priority: 'pinned'
})
```

The in-memory source is intentionally small. It is not another semantic store.

## Responsibilities

Context Manager keeps:

- priority tiers: `pinned > working > retrieved > history`
- strict token-budget packing
- optional compression
- Markdown, XML, JSON, and plain rendering
- diagnostics/provenance
- conversation-history merging

Semantika keeps:

- durable storage
- canonical tags and aliases
- taxonomy and constraints
- semantic tag search and derived vector indexing
- artifact discovery and graph relationships

## Custom sources

The integration boundary is intentionally tiny:

```ts
interface ContextSource {
  retrieve(request: {
    query: string
    limit: number
    hints?: Record<string, unknown>
  }): Promise<ScoredContextBlock[]>
}
```

Mutation methods are optional, so persistent/read-only sources do not need to pretend to be context databases.

## Development

```sh
bun test
bun run build
```

MIT © Dharmax
