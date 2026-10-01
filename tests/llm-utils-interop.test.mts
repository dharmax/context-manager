import test from 'node:test';
import assert from 'node:assert/strict';
import { ModularContextManager, MemoryContextSource } from '../src/index.mts';

test('interoperates with @dharmax/llm-utils PromptContextManager when available', async t => {
  let resolveContext: ((manager: unknown, request: Record<string, unknown>) => Promise<string>) | undefined;

  try {
    ({ resolveContext } = await import('@dharmax/llm-utils'));
  } catch {
    t.skip('@dharmax/llm-utils is an optional peer and is not installed');
    return;
  }

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
  ]);

  const manager = new ModularContextManager({ source });
  const contextString = await resolveContext(manager, {
    query: 'What are the architectural rules on simplicity and solid design?',
    maxTokens: 500
  });

  assert.ok(contextString.includes('Extreme KISS Rule'));
  assert.ok(contextString.includes('SOLID Principles'));
  assert.ok(contextString.indexOf('Extreme KISS Rule') < contextString.indexOf('SOLID Principles'));
});
