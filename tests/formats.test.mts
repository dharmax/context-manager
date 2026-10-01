import test from 'node:test';
import assert from 'node:assert/strict';
import { packContext, type ContextItem } from '../src/index.mts';

const sampleItems: ContextItem[] = [
  {
    id: 'rule-1',
    title: 'Security Guideline',
    content: 'Sanitize all user inputs before SQL execution.',
    priority: 'pinned'
  },
  {
    id: 'rule-2',
    title: 'Performance Tip',
    content: 'Use caching for frequent reads.',
    priority: 'retrieved'
  }
];

test('packContext - renders XML format with tags and attributes', async () => {
  const res = await packContext(sampleItems, {
    maxTokens: 500,
    format: 'xml'
  });

  assert.ok(res.rendered.startsWith('<context>'));
  assert.ok(res.rendered.includes('<item id="rule-1" priority="pinned" title="Security Guideline">'));
  assert.ok(res.rendered.includes('Sanitize all user inputs'));
  assert.ok(res.rendered.endsWith('</context>'));
  assert.equal(res.diagnostics.format, 'xml');
});

test('packContext - renders JSON format with valid schema', async () => {
  const res = await packContext(sampleItems, {
    maxTokens: 500,
    format: 'json'
  });

  const parsed = JSON.parse(res.rendered);
  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].id, 'rule-1');
});
