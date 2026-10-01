import { expect, test } from 'bun:test'
import { createContextManager, createMemorySource } from '../src/index.ts'

test('factory APIs use the ContextSource boundary', async () => {
  const source = createMemorySource([{ id: 'b1', title: 'Block 1', body: 'Content for block 1' }])
  const manager = createContextManager({ source, defaultMaxTokens: 600 })
  await manager.addBlock({ id: 'b2', title: 'Block 2', body: 'Content for block 2' })

  expect((await manager.search('Content')).length).toBe(2)

  const result = await manager.resolve({
    query: 'Block 2',
    output: { format: 'plain' }
  })
  expect(result.rendered).toContain('Block 2')
})
