import { expect, test } from 'bun:test'
import type { PromptContextManager as LlmUtilsPromptContextManager } from '@dharmax/llm-utils'
import { ModularContextManager, MemoryContextSource } from '../src/index.ts'

test('matches @dharmax/llm-utils PromptContextManager contract', async () => {
  const source = new MemoryContextSource([
    {
      id: 'rule-solid',
      title: 'SOLID Principles',
      body: 'Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, Dependency Inversion.'
    },
    {
      id: 'rule-kiss',
      title: 'Extreme KISS Rule',
      body: 'If a solution is not super-simple, it is completely wrong.',
      priority: 'pinned'
    }
  ])

  const manager: LlmUtilsPromptContextManager = new ModularContextManager({ source })
  const result = await manager.resolve({
    query: 'What are the architectural rules on simplicity and solid design?',
    maxTokens: 500
  })

  const rendered = typeof result === 'string' ? result : result.rendered ?? ''
  expect(rendered).toContain('Extreme KISS Rule')
  expect(rendered).toContain('SOLID Principles')
  expect(rendered.indexOf('Extreme KISS Rule')).toBeLessThan(rendered.indexOf('SOLID Principles'))
})
