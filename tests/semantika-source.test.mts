import test from 'node:test';
import assert from 'node:assert/strict';
import { SemantikaContextSource } from '../dist/index.mjs';

test('SemantikaContextSource routes query through tags and deduplicates artifacts', async () => {
  const scheduler = {
    id: 'scheduler-doc',
    title: 'Scheduler lifecycle',
    body: 'RUNNING tasks must be reclaimed after stale leases.'
  };

  const tagA = {
    name: 'scheduler',
    async artifacts() { return [scheduler]; }
  };

  const tagB = {
    name: 'durable-execution',
    async artifacts() { return [scheduler]; }
  };

  let readyCalled = false;
  let searched = '';

  const sp = {
    async ready() { readyCalled = true; },
    tags: {
      async search(query: string) {
        searched = query;
        return [
          { tag: tagA, match: 'semantic' as const, score: 0.91 },
          { tag: tagB, match: 'semantic' as const, score: 0.84 }
        ];
      }
    }
  };

  const source = new SemantikaContextSource({
    semanticPackage: sp,
    toBlock: artifact => {
      const value = artifact as typeof scheduler;
      return {
        id: value.id,
        title: value.title,
        body: value.body
      };
    }
  });

  const results = await source.retrieve({
    query: 'why are scheduled tasks staying RUNNING?',
    limit: 10
  });

  assert.equal(readyCalled, true);
  assert.equal(searched, 'why are scheduled tasks staying RUNNING?');
  assert.equal(results.length, 1);
  assert.equal(results[0]?.block.id, 'scheduler-doc');
  assert.equal(results[0]?.score, 0.91);
  assert.deepEqual(results[0]?.rationale, [
    'semantika:semantic:scheduler',
    'semantika:semantic:durable-execution'
  ]);
});

test('SemantikaContextSource does not guess artifact schema', async () => {
  const tag = {
    name: 'project',
    async artifacts() { return [{ id: 'x', payload: 'hello' }]; }
  };

  const source = new SemantikaContextSource({
    semanticPackage: {
      async ready() {},
      tags: { async search() { return [{ tag, match: 'exact' as const }]; } }
    },
    toBlock: artifact => ({
      id: artifact.id,
      title: 'Mapped explicitly',
      body: (artifact as any).payload
    })
  });

  const result = await source.retrieve({ query: 'project', limit: 1 });
  assert.equal(result[0]?.block.body, 'hello');
  assert.equal(result[0]?.score, 1);
});
