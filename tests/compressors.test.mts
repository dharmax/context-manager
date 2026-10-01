import test from 'node:test';
import assert from 'node:assert/strict';
import { HeadTailCompressor, CodeOutlineCompressor } from '../src/index.mts';

test('HeadTailCompressor - truncates large logs cleanly preserving head and tail', () => {
  const compressor = new HeadTailCompressor({ headLines: 3, tailLines: 3 });
  const longLog = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}: log entry details`).join('\n');

  const compressed = compressor.compress(longLog, 50);

  assert.ok(compressed.includes('Line 1'));
  assert.ok(compressed.includes('Line 100'));
  assert.ok(compressed.includes('... [truncated'));
});

test('CodeOutlineCompressor - extracts signatures and structural outlines', () => {
  const compressor = new CodeOutlineCompressor();
  const code = `
import { Foo } from './foo.js';

export interface User {
  id: string;
  name: string;
}

export function calculateTotal(items: number[]): number {
  let total = 0;
  for (const item of items) {
    total += item;
  }
  return total;
}

export class OrderService {
  processOrder(id: string): void {
    console.log('Processing order ' + id);
  }
}
`;

  const compressed = compressor.compress(code, 80);

  assert.ok(compressed.includes('export interface User'));
  assert.ok(compressed.includes('id: string;'));
  assert.ok(compressed.includes('export function calculateTotal'));
  assert.ok(compressed.includes('{ /* ... */ }'));
  assert.ok(!compressed.includes('console.log'));
});
