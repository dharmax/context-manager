import test from 'node:test';
import assert from 'node:assert/strict';
import { packContext, type ContextItem } from '../dist/index.mjs';

test('Priority Knapsack Packer - respects priority tiers and hard budget limits', async () => {
  const candidates: ContextItem[] = [
    {
      id: 'history-old',
      title: 'Old History',
      content: 'This is older conversation history.',
      priority: 'history',
      score: 100
    },
    {
      id: 'pinned-rule',
      title: 'System Rule',
      content: 'Never leak secrets or credentials.',
      priority: 'pinned',
      score: 1
    },
    {
      id: 'rag-doc',
      title: 'API Spec',
      content: 'Endpoint returns JSON with status code 200.',
      priority: 'retrieved',
      score: 50
    }
  ];

  const result = await packContext(candidates, {
    maxTokens: 50,
    maxItems: 5
  });

  assert.ok(result.items.length >= 1);
  assert.equal(result.items[0].id, 'pinned-rule');
  assert.ok(result.diagnostics.budget.used <= 50);
});

test('Priority Knapsack Packer - prevents budget bypass on oversized first item', async () => {
  const candidates: ContextItem[] = [
    {
      id: 'huge-doc',
      title: 'Enormous Payload',
      content: 'A'.repeat(5000),
      priority: 'retrieved',
      score: 99
    }
  ];

  const result = await packContext(candidates, {
    maxTokens: 100
  });

  assert.equal(result.items.length, 0);
  assert.equal(result.diagnostics.budget.used, 0);
  assert.equal(result.diagnostics.excluded.length, 1);
  assert.equal(result.diagnostics.excluded[0].reason, 'budget');
});
