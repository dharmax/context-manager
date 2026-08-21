import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryContextStore, HybridContextStore, type VectorStoreAdapter } from '../dist/index.mjs';

test('HybridContextStore - combines lexical and vector search with RRF', async () => {
  const lexical = new MemoryContextStore();
  await lexical.add([
    {
      id: 'doc-1',
      title: 'Python Django Framework',
      body: 'Django is a high-level Python web framework.',
      category: 'backend'
    },
    {
      id: 'doc-2',
      title: 'Machine Learning with PyTorch',
      body: 'Deep neural networks and tensors in Python.',
      category: 'ai'
    }
  ]);

  const mockVector: VectorStoreAdapter = {
    async search(query: string, limit: number) {
      if (query.includes('neural') || query.includes('ai')) {
        return [{ id: 'doc-2', score: 0.92 }, { id: 'doc-1', score: 0.41 }];
      }
      return [];
    }
  };

  const hybrid = new HybridContextStore({
    lexicalStore: lexical,
    vectorStore: mockVector
  });

  const results = await hybrid.query({ query: 'neural ai modeling' });
  assert.ok(results.length > 0);
  assert.equal(results[0].block.id, 'doc-2');
  assert.ok(results[0].rationale?.[0].startsWith('rrf('));
});
