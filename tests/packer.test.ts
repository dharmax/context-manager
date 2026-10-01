import { expect, test } from 'bun:test'
import { packContext, type ContextItem } from '../src/index.ts'

test('Priority Knapsack Packer - respects priority tiers and hard budget limits', async () => {
  const candidates: ContextItem[] = [
    { id: 'history-old', title: 'Old History', content: 'This is older conversation history.', priority: 'history', score: 100 },
    { id: 'pinned-rule', title: 'System Rule', content: 'Never leak secrets or credentials.', priority: 'pinned', score: 1 },
    { id: 'rag-doc', title: 'API Spec', content: 'Endpoint returns JSON with status code 200.', priority: 'retrieved', score: 50 }
  ]

  const result = await packContext(candidates, { maxTokens: 50, maxItems: 5 })
  expect(result.items.length).toBeGreaterThanOrEqual(1)
  expect(result.items[0].id).toBe('pinned-rule')
  expect(result.diagnostics.budget.used).toBeLessThanOrEqual(50)
})

test('Priority Knapsack Packer - prevents budget bypass on oversized first item', async () => {
  const result = await packContext([
    { id: 'huge-doc', title: 'Enormous Payload', content: 'A'.repeat(5000), priority: 'retrieved', score: 99 }
  ], { maxTokens: 100 })

  expect(result.items.length).toBe(0)
  expect(result.diagnostics.budget.used).toBe(0)
  expect(result.diagnostics.excluded.length).toBe(1)
  expect(result.diagnostics.excluded[0].reason).toBe('budget')
})
