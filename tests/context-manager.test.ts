import { expect, test } from 'bun:test'
import { ModularContextManager, HeuristicContextManager } from '../src/index.ts'

test('ModularContextManager resolves, merges history, and packs', async () => {
  const manager = new ModularContextManager()

  await manager.add([
    { id: 'style-guide', title: 'Styling Architecture', body: 'Always separate Global Theme from Component Scoped styles.' },
    { id: 'db-guide', title: 'Database Queries', body: 'Always use parameterized SQL queries.' }
  ])

  const result = await manager.resolve({
    query: 'How should I structure CSS and component styling?',
    maxTokens: 500,
    history: [
      { role: 'user', content: 'What UI framework are we using?' },
      { role: 'ai', content: 'We are using Riot.js.' }
    ]
  })

  expect(result.rendered).toContain('Styling Architecture')
  expect(result.rendered).toContain('History: ai')
  expect(result.diagnostics?.strategy).toBe('priority-knapsack-packing')
  expect(result.diagnostics?.budget.used ?? 501).toBeLessThanOrEqual(500)
})

test('HeuristicContextManager remains a thin compatibility alias', async () => {
  const manager = new HeuristicContextManager()
  await manager.add({
    id: 'legacy-doc',
    title: 'Legacy Compatibility',
    body: 'Works seamlessly as a drop-in replacement.'
  })

  const result = await manager.resolve({ query: 'compatibility' })
  expect(result.items?.[0]?.id).toBe('legacy-doc')
})
