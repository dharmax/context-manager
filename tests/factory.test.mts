import test from 'node:test';
import assert from 'node:assert/strict';
import { createContextManager, createMemoryStore } from '../dist/index.mjs';

test('Factory APIs & Fluent methods - easy instantiation and chaining', async () => {
  const store = createMemoryStore([
    {
      id: 'b1',
      title: 'Block 1',
      body: 'Content for block 1',
      category: 'demo'
    }
  ]);

  const manager = createContextManager({ store, defaultMaxTokens: 600 });
  await manager.addBlock({
    id: 'b2',
    title: 'Block 2',
    body: 'Content for block 2',
    category: 'demo'
  });

  // Direct search method
  const found = await manager.search('category:demo Content');
  assert.equal(found.length, 2);

  // Full resolve method
  const res = await manager.resolve({
    query: 'category:demo Block 2',
    output: { format: 'plain' }
  });

  assert.ok(typeof res.rendered === 'string');
  assert.ok(res.rendered.includes('Block 2'));
});
