# @dharmax/context-manager

Baseline prompt context manager for `@dharmax/llm-utils`.

It provides:

- heuristic retrieval over block stores
- prompt-ready rendered context
- token-aware trimming
- `lean-ctx` compression for oversized items when available
- diagnostics and provenance

## Usage

```ts
import { Asker, PromptEngine } from '@dharmax/llm-utils';
import { HeuristicContextManager } from '@dharmax/context-manager';
```
