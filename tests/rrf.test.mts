import test from 'node:test';
import assert from 'node:assert/strict';
import { reciprocalRankFusion } from '../dist/index.mjs';

test('Reciprocal Rank Fusion - merges disparate rankings fairly', () => {
  const lexical = [
    { id: 'doc-a', score: 10 },
    { id: 'doc-b', score: 8 },
    { id: 'doc-c', score: 5 }
  ];

  const vector = [
    { id: 'doc-b', score: 0.95 },
    { id: 'doc-c', score: 0.88 },
    { id: 'doc-d', score: 0.82 }
  ];

  const fused = reciprocalRankFusion({ lexical, vector }, { k: 60 });

  assert.ok(fused.length === 4);
  assert.equal(fused[0].id, 'doc-b');
  assert.equal(fused[0].ranks.lexical, 2);
  assert.equal(fused[0].ranks.vector, 1);
  assert.equal(fused[1].id, 'doc-c');
});
