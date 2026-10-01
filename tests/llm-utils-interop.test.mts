import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveContext, type PromptContextManager as LlmUtilsContextManager } from '../../llm-utils/dist/index.mjs';
import { ModularContextManager, MemoryContextSource } from '../dist/index.mjs';

test('interoperates with @dharmax/llm-utils PromptContextManager', async () => {
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
  const typeCheck: LlmUtilsContextManager = manager;
  assert.ok(typeCheck);

  const contextString = await resolveContext(manager, {
    query: 'What are the architectural rules on simplicity and solid design?',
    maxTokens: 500
  });

  assert.ok(contextString.includes('Extreme KISS Rule'));
  assert.ok(contextString.includes('SOLID Principles'));
  assert.ok(contextString.indexOf('Extreme KISS Rule') < contextString.indexOf('SOLID Principles'));
});
