import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryContextStore } from '../dist/index.mjs';

test('MemoryContextStore - ranks by relevance and respects filters', async () => {
  const store = new MemoryContextStore();

  await store.add([
    {
      id: 'rule-auth',
      title: 'Authentication Strategy',
      body: 'Always use OAuth2 Bearer tokens with JWT verification.',
      category: 'security',
      tags: ['auth', 'jwt', 'security']
    },
    {
      id: 'rule-database',
      title: 'Database Access Guide',
      body: 'Connect to Postgres using connection pools and parameterized queries.',
      category: 'database',
      tags: ['postgres', 'sql']
    },
    {
      id: 'author-bio',
      title: 'Author Biography',
      body: 'The author has written multiple documentation guides.',
      category: 'general',
      tags: ['bio']
    }
  ]);

  // 1. Tag & Title Match
  const authResults = await store.query({ query: 'How to do auth with jwt?' });
  assert.ok(authResults.length > 0);
  assert.equal(authResults[0].block.id, 'rule-auth');
  assert.ok(authResults[0].score > 5.0);

  // 2. Word Boundary Awareness: "auth" should rank rule-auth higher than author-bio
  const wordBoundaryResults = await store.query({ query: 'auth' });
  assert.equal(wordBoundaryResults[0].block.id, 'rule-auth');

  // 3. Category Filter
  const dbSecurityOnly = await store.query({
    query: 'query database and auth tokens',
    categories: ['database']
  });
  assert.equal(dbSecurityOnly.length, 1);
  assert.equal(dbSecurityOnly[0].block.id, 'rule-database');

  // 4. Tag Filter
  const tagFiltered = await store.query({
    query: 'tokens',
    tags: ['postgres']
  });
  assert.equal(tagFiltered.length, 0);
});
