import { expect, test } from 'bun:test'
import { packContext, type ContextItem } from '../src/index.ts'

const sampleItems: ContextItem[] = [
  { id: 'rule-1', title: 'Security Guideline', content: 'Sanitize all user inputs before SQL execution.', priority: 'pinned' },
  { id: 'rule-2', title: 'Performance Tip', content: 'Use caching for frequent reads.', priority: 'retrieved' }
]

test('packContext - renders XML format with tags and attributes', async () => {
  const res = await packContext(sampleItems, { maxTokens: 500, format: 'xml' })
  expect(res.rendered).toStartWith('<context>')
  expect(res.rendered).toContain('<item id="rule-1" priority="pinned" title="Security Guideline">')
  expect(res.rendered).toContain('Sanitize all user inputs')
  expect(res.rendered).toEndWith('</context>')
  expect(res.diagnostics.format).toBe('xml')
})

test('packContext - renders JSON format with valid schema', async () => {
  const res = await packContext(sampleItems, { maxTokens: 500, format: 'json' })
  const parsed = JSON.parse(res.rendered)
  expect(Array.isArray(parsed)).toBe(true)
  expect(parsed.length).toBe(2)
  expect(parsed[0].id).toBe('rule-1')
})
