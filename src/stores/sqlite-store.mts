import type {
  ContextBlock,
  ContextPriority,
  ContextStoreAdapter,
  ScoredContextBlock,
  StoreQueryOptions
} from '../types.mjs';

export interface SqliteStoreOptions {
  filename?: string;
  inMemory?: boolean;
}

interface SqliteRow {
  id: string;
  title: string;
  body: string;
  category: string | null;
  tags: string | null;
  priority: string | null;
  source: string | null;
  metadata: string | null;
  score?: number;
}

interface BunDatabase {
  run(sql: string): void;
  prepare(sql: string): {
    run(params?: Record<string, unknown> | unknown): void;
    all(params?: Record<string, unknown> | unknown): SqliteRow[];
  };
  transaction<T extends (...args: any[]) => any>(fn: T): T;
}

export class BunSqliteContextStore implements ContextStoreAdapter {
  private db?: BunDatabase;
  private isAvailable: boolean = false;

  constructor(options: SqliteStoreOptions = {}) {
    try {
      // Dynamic require / import for bun:sqlite
      // @ts-ignore
      const { Database } = require('bun:sqlite');
      const target = options.inMemory || !options.filename ? ':memory:' : options.filename;
      this.db = new Database(target) as BunDatabase;
      this.initSchema();
      this.isAvailable = true;
    } catch {
      this.isAvailable = false;
    }
  }

  private initSchema(): void {
    if (!this.db) return;
    this.db.run('PRAGMA journal_mode = WAL;');
    this.db.run(`
      CREATE TABLE IF NOT EXISTS context_blocks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        category TEXT,
        tags TEXT,
        priority TEXT,
        source TEXT,
        metadata TEXT
      );
    `);
    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS context_fts USING fts5(
        id UNINDEXED,
        title,
        body,
        category,
        tags,
        tokenize='porter unicode61'
      );
    `);
  }

  async add(blocks: ContextBlock | ContextBlock[]): Promise<void> {
    if (!this.isAvailable || !this.db) return;
    const list = Array.isArray(blocks) ? blocks : [blocks];

    const insertBlock = this.db.prepare(`
      INSERT OR REPLACE INTO context_blocks (id, title, body, category, tags, priority, source, metadata)
      VALUES ($id, $title, $body, $category, $tags, $priority, $source, $metadata);
    `);

    const deleteFts = this.db.prepare(`DELETE FROM context_fts WHERE id = $id;`);
    const insertFts = this.db.prepare(`
      INSERT INTO context_fts (id, title, body, category, tags)
      VALUES ($id, $title, $body, $category, $tags);
    `);

    const transaction = this.db.transaction((items: ContextBlock[]) => {
      for (const b of items) {
        const tagsStr = (b.tags ?? []).join(' ');
        const metadataStr = b.metadata ? JSON.stringify(b.metadata) : null;

        insertBlock.run({
          $id: b.id,
          $title: b.title,
          $body: b.body,
          $category: b.category ?? null,
          $tags: tagsStr,
          $priority: b.priority ?? 'retrieved',
          $source: b.source ?? null,
          $metadata: metadataStr
        });

        deleteFts.run({ $id: b.id });
        insertFts.run({
          $id: b.id,
          $title: b.title,
          $body: b.body,
          $category: b.category ?? '',
          $tags: tagsStr
        });
      }
    });

    transaction(list);
  }

  async delete(id: string): Promise<void> {
    if (!this.isAvailable || !this.db) return;
    this.db.prepare(`DELETE FROM context_blocks WHERE id = ?`).run(id);
    this.db.prepare(`DELETE FROM context_fts WHERE id = ?`).run(id);
  }

  async clear(): Promise<void> {
    if (!this.isAvailable || !this.db) return;
    this.db.run(`DELETE FROM context_blocks;`);
    this.db.run(`DELETE FROM context_fts;`);
  }

  async list(): Promise<ContextBlock[]> {
    if (!this.isAvailable || !this.db) return [];
    const rows = this.db.prepare(`SELECT * FROM context_blocks`).all();
    return rows.map(r => this.rowToBlock(r));
  }

  async query(options: StoreQueryOptions): Promise<ScoredContextBlock[]> {
    if (!this.isAvailable || !this.db) return [];
    const { query, categories, tags, limit = 20, metadataFilter } = options;

    const cleanQuery = query.replace(/[^\w\s]/g, ' ').trim();
    if (!cleanQuery && (!categories || categories.length === 0) && (!tags || tags.length === 0)) {
      return [];
    }

    let rows: SqliteRow[] = [];

    if (cleanQuery) {
      const ftsQuery = cleanQuery.split(/\s+/).map(term => `"${term}"*`).join(' OR ');
      try {
        const stmt = this.db.prepare(`
          SELECT b.*, -bm25(f) AS score
          FROM context_fts f
          JOIN context_blocks b ON f.id = b.id
          WHERE context_fts MATCH $match
          ORDER BY score DESC
          LIMIT $limit;
        `);
        rows = stmt.all({ $match: ftsQuery, $limit: limit * 2 });
      } catch {
        rows = this.db.prepare(`SELECT *, 1.0 AS score FROM context_blocks LIMIT $limit;`).all({ $limit: limit * 2 });
      }
    } else {
      rows = this.db.prepare(`SELECT *, 1.0 AS score FROM context_blocks LIMIT $limit;`).all({ $limit: limit * 2 });
    }

    const results: ScoredContextBlock[] = [];
    for (const r of rows) {
      const block = this.rowToBlock(r);

      if (categories && categories.length > 0) {
        if (!block.category || !categories.includes(block.category)) {
          continue;
        }
      }

      if (tags && tags.length > 0) {
        const blockTags = block.tags ?? [];
        if (!tags.some(t => blockTags.includes(t))) {
          continue;
        }
      }

      if (metadataFilter && !metadataFilter(block.metadata)) {
        continue;
      }

      results.push({
        block,
        score: Math.max(0.01, Number(r.score) || 1.0),
        rationale: [`fts5(score:${(r.score || 0).toFixed(2)})`]
      });
    }

    return results.slice(0, limit);
  }

  private rowToBlock(row: SqliteRow): ContextBlock {
    let metadata: Record<string, unknown> | undefined;
    if (row.metadata) {
      try {
        metadata = JSON.parse(row.metadata);
      } catch {}
    }

    return {
      id: row.id,
      title: row.title,
      body: row.body,
      category: row.category ?? undefined,
      tags: row.tags ? row.tags.split(' ').filter(Boolean) : [],
      priority: (row.priority as ContextPriority) ?? 'retrieved',
      source: row.source ?? undefined,
      metadata
    };
  }
}
