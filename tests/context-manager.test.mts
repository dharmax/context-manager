import test from 'node:test';
import assert from 'node:assert/strict';
import { ModularContextManager, HeuristicContextManager } from '../dist/index.mjs';

test('ModularContextManager - end to end resolution and rendering', async () => {
  const manager = new ModularContextManager();

  await manager.add([
    {
      id: 'style-guide',
      title: 'Styling Architecture',
      body: 'Always separate Global Theme from Component Scoped styles.',
      category: 'frontend',
      tags: ['css', 'riot']
    },
    {
      id: 'db-guide',
      title: 'Database Queries',
      body: 'Always use parameterized SQL queries.',
      category: 'backend',
      tags: ['sql']
    }
  ]);

  const result = await manager.resolve({
    query: 'How should I structure CSS and component styling?',
    categories: ['frontend'],
    maxTokens: 500,
    history: [
      { role: 'user', content: 'What UI framework are we using?' },
      { role: 'ai', content: 'We are using Riot.js.' }
    ]
  });

  assert.ok(typeof result.rendered === 'string');
  assert.ok(result.rendered.includes('Styling Architecture'));
  assert.ok(result.rendered.includes('History: ai'));
  assert.ok(result.diagnostics);
  assert.equal(result.diagnostics.strategy, 'priority-knapsack-packing');
  assert.ok(result.diagnostics.budget.used <= 500);
});

test('HeuristicContextManager - backward compatibility check', async () => {
  const legacyManager = new HeuristicContextManager();
  await legacyManager.add({
    id: 'legacy-doc',
    title: 'Legacy Compatibility',
    body: 'Works seamlessly as a drop-in replacement.'
  });

  const res = await legacyManager.resolve({ query: 'compatibility' });
  assert.ok(res.items && res.items.length > 0);
  assert.equal(res.items[0].id, 'legacy-doc');
});
