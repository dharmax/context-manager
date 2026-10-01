import test from 'node:test';
import assert from 'node:assert/strict';
import { ModularContextManager, HeuristicContextManager } from '../dist/index.mjs';

test('ModularContextManager resolves, merges history, and packs', async () => {
  const manager = new ModularContextManager();

  await manager.add([
    {
      id: 'style-guide',
      title: 'Styling Architecture',
      body: 'Always separate Global Theme from Component Scoped styles.'
    },
    {
      id: 'db-guide',
      title: 'Database Queries',
      body: 'Always use parameterized SQL queries.'
    }
  ]);

  const result = await manager.resolve({
    query: 'How should I structure CSS and component styling?',
    maxTokens: 500,
    history: [
      { role: 'user', content: 'What UI framework are we using?' },
      { role: 'ai', content: 'We are using Riot.js.' }
    ]
  });

  assert.ok(result.rendered?.includes('Styling Architecture'));
  assert.ok(result.rendered?.includes('History: ai'));
  assert.equal(result.diagnostics?.strategy, 'priority-knapsack-packing');
  assert.ok((result.diagnostics?.budget.used ?? 501) <= 500);
});

test('HeuristicContextManager remains a thin compatibility alias', async () => {
  const manager = new HeuristicContextManager();
  await manager.add({
    id: 'legacy-doc',
    title: 'Legacy Compatibility',
    body: 'Works seamlessly as a drop-in replacement.'
  });

  const result = await manager.resolve({ query: 'compatibility' });
  assert.equal(result.items?.[0]?.id, 'legacy-doc');
});
