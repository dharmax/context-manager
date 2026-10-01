import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryContextSource } from '../src/index.mts';

test('MemoryContextSource is a small lexical fallback, not a semantic store', async () => {
  const source = new MemoryContextSource([
    {
      id: 'auth',
      title: 'Authentication Strategy',
      body: 'Use OAuth2 Bearer tokens with JWT verification.'
    },
    {
      id: 'db',
      title: 'Database Access Guide',
      body: 'Use Postgres connection pools.'
    }
  ]);

  const results = await source.retrieve({ query: 'auth jwt', limit: 10 });
  assert.equal(results[0]?.block.id, 'auth');
  assert.ok((results[0]?.score ?? 0) > 0);
});
