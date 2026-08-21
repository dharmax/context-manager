import test from 'node:test';
import assert from 'node:assert/strict';
import { BunSqliteContextStore } from '../dist/index.mjs';

test('BunSqliteContextStore - indexed FTS5 full-text search and filtering', async (t) => {
  // @ts-ignore
  if (typeof process.versions.bun === 'undefined') {
    t.skip('BunSqliteContextStore requires Bun runtime (bun:sqlite)');
    return;
  }

  const store = new BunSqliteContextStore({ inMemory: true });

  await store.add([
    {
      id: 'doc-bun',
      title: 'Bun Runtime Guide',
      body: 'Bun is an all-in-one JavaScript and TypeScript toolkit with built-in SQLite.',
      category: 'runtimes',
      tags: ['bun', 'typescript', 'fast']
    },
    {
      id: 'doc-node',
      title: 'Node.js Guide',
      body: 'Node.js is a classic event-driven JavaScript runtime.',
      category: 'runtimes',
      tags: ['node', 'v8']
    }
  ]);

  // FTS5 Full Text Query
  const results = await store.query({ query: 'toolkit SQLite' });
  assert.ok(results.length > 0);
  assert.equal(results[0].block.id, 'doc-bun');

  // Category Filtering
  const nodeFiltered = await store.query({ query: 'runtime', categories: ['runtimes'], tags: ['node'] });
  assert.equal(nodeFiltered.length, 1);
  assert.equal(nodeFiltered[0].block.id, 'doc-node');
});
