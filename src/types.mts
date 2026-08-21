export type ContextHistoryRole = 'user' | 'ai' | 'system' | string;

export interface ContextHistoryItem {
  role: ContextHistoryRole;
  content: string;
}

export type ContextFormat = 'markdown' | 'xml' | 'plain' | 'json';

export interface ContextRequest {
  query: string;
  taskType?: string;
  maxTokens?: number;
  maxItems?: number;
  categories?: string[];
  tags?: string[];
  history?: ContextHistoryItem[];
  hints?: Record<string, unknown>;
  output?: {
    mode?: 'rendered' | 'items' | 'both';
    format?: ContextFormat;
  };
}

export type ContextPriority = 'pinned' | 'working' | 'retrieved' | 'history';

export interface ContextBlock {
  id: string;
  title: string;
  body: string;
  category?: string;
  tags?: string[];
  priority?: ContextPriority;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface ScoredContextBlock {
  block: ContextBlock;
  score: number;
  rationale?: string[];
}

export interface ContextItem {
  id: string;
  title: string;
  content: string;
  kind?: string;
  score?: number;
  source?: string;
  priority?: ContextPriority;
  metadata?: Record<string, unknown>;
  rationale?: string[];
}

export interface ContextDiagnostics {
  strategy: string;
  format: ContextFormat;
  budget: {
    requested: number;
    used: number;
    itemsIncluded: number;
    itemsExcluded: number;
  };
  excluded: Array<{
    id: string;
    reason: 'budget' | 'maxItems' | 'filtered' | 'lowScore';
  }>;
  warnings?: string[];
}

export interface ContextResult {
  rendered?: string;
  items?: ContextItem[];
  diagnostics?: ContextDiagnostics;
}

export interface PromptContextManager {
  resolve(request: ContextRequest): Promise<ContextResult | string>;
}

export type ContextResolver =
  | PromptContextManager
  | ((request: ContextRequest) => Promise<ContextResult | string>);

export interface StoreQueryOptions {
  query: string;
  categories?: string[];
  tags?: string[];
  limit?: number;
  metadataFilter?: (metadata?: Record<string, unknown>) => boolean;
}

export interface ContextStoreAdapter {
  query(options: StoreQueryOptions): Promise<ScoredContextBlock[]>;
  add(blocks: ContextBlock | ContextBlock[]): Promise<void>;
  delete?(id: string): Promise<void>;
  clear?(): Promise<void>;
  list?(): Promise<ContextBlock[]>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
}

export interface VectorStoreAdapter {
  search(query: string, limit: number): Promise<VectorSearchResult[]>;
  embed?(text: string): Promise<number[]>;
  upsert?(id: string, text: string, metadata?: Record<string, unknown>): Promise<void>;
}

export interface ContextCompressorAdapter {
  name: string;
  compress(text: string, maxTokens: number): Promise<string> | string;
}

export type TokenizerFunction = (text: string) => number;
