import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveContext, type PromptContextManager as LlmUtilsContextManager } from '../../llm-utils/dist/index.mjs';
import { ModularContextManager, MemoryContextStore, type PromptContextManager as LocalContextManager } from '../dist/index.mjs';

test('Interoperability with @dharmax/llm-utils - type compatibility & resolveContext execution', async () => {
  const store = new MemoryContextStore();
  await store.add([
    {
      id: 'rule-solid',
      title: 'SOLID Principles',
      body: 'Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, Dependency Inversion.',
      category: 'architecture',
      tags: ['solid', 'clean-code']
    },
    {
      id: 'rule-kiss',
      title: 'Extreme KISS Rule',
      body: 'If a solution is not super-simple, it is completely wrong.',
      category: 'architecture',
      tags: ['kiss', 'simplicity'],
      priority: 'pinned'
    }
  ]);

  const manager = new ModularContextManager({ store });

  // Verify type assignability to llm-utils interface
  const typeCheck: LlmUtilsContextManager = manager;
  assert.ok(typeCheck);

  // Execute using llm-utils's resolveContext function
  const contextString = await resolveContext(manager, {
    query: 'What are the architectural rules on simplicity and solid design?',
    categories: ['architecture'],
    maxTokens: 500
  });

  assert.ok(typeof contextString === 'string');
  assert.ok(contextString.includes('Extreme KISS Rule'));
  assert.ok(contextString.includes('SOLID Principles'));
  // Pinned item should appear first
  const kissIndex = contextString.indexOf('Extreme KISS Rule');
  const solidIndex = contextString.indexOf('SOLID Principles');
  assert.ok(kissIndex < solidIndex, 'Pinned item should precede retrieved item in rendered output');
});
