import test from 'node:test';
import assert from 'node:assert/strict';
import { parseContextQuery } from '../dist/index.mjs';

test('parseContextQuery - extracts category, tag, priority, and quoted phrases', () => {
  const parsed = parseContextQuery('category:security tag:jwt priority:pinned "bearer token" how to authenticate');

  assert.equal(parsed.cleanQuery, 'how to authenticate');
  assert.deepEqual(parsed.categories, ['security']);
  assert.deepEqual(parsed.tags, ['jwt']);
  assert.equal(parsed.priority, 'pinned');
  assert.deepEqual(parsed.phrases, ['bearer token']);
});

test('parseContextQuery - merges with initial category and tag filters', () => {
  const parsed = parseContextQuery('category:api find user endpoint', ['backend'], ['auth']);

  assert.equal(parsed.cleanQuery, 'find user endpoint');
  assert.ok(parsed.categories.includes('backend'));
  assert.ok(parsed.categories.includes('api'));
  assert.ok(parsed.tags.includes('auth'));
});
