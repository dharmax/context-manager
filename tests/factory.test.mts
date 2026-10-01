import test from 'node:test';
import assert from 'node:assert/strict';
import { createContextManager, createMemorySource } from '../dist/index.mjs';

test('factory APIs use the ContextSource boundary', async () => {
  const source = createMemorySource([
    { id: 'b1', title: 'Block 1', body: 'Content for block 1' }
  ]);

  const manager = createContextManager({ source, defaultMaxTokens: 600 });
  await manager.addBlock({ id: 'b2', title: 'Block 2', body: 'Content for block 2' });

  const found = await manager.search('Content');
  assert.equal(found.length, 2);

  const result = await manager.resolve({
    query: 'Block 2',
    output: { format: 'plain' }
  });

  assert.ok(result.rendered?.includes('Block 2'));
});
