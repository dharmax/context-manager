const mod = await import('../dist/index.mjs');

for (const name of [
  'createContextManager',
  'createMemorySource',
  'MemoryContextSource',
  'SemantikaContextSource'
]) {
  if (!(name in mod)) throw new Error(`Missing built export: ${name}`);
}
