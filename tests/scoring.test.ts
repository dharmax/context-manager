import { expect, test } from 'bun:test'
import { MemoryContextSource } from '../src/index.ts'

test('MemoryContextSource is a small lexical fallback, not a semantic store', async () => {
  const source = new MemoryContextSource([
    { id: 'auth', title: 'Authentication Strategy', body: 'Use OAuth2 Bearer tokens with JWT verification.' },
    { id: 'db', title: 'Database Access Guide', body: 'Use Postgres connection pools.' }
  ])

  const results = await source.retrieve({ query: 'auth jwt', limit: 10 })
  expect(results[0]?.block.id).toBe('auth')
  expect(results[0]?.score ?? 0).toBeGreaterThan(0)
})
