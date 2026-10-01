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
  priority?: ContextPriority;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface ScoredContextBlock {
  block: ContextBlock;
  score: number;
  rationale?: string[];
}

export interface ContextSourceRequest {
  query: string;
  limit: number;
  hints?: Record<string, unknown>;
}

export interface ContextSource {
  retrieve(request: ContextSourceRequest): Promise<ScoredContextBlock[]>;
  add?(blocks: ContextBlock | ContextBlock[]): Promise<void>;
  delete?(id: string): Promise<void>;
  clear?(): Promise<void>;
  list?(): Promise<ContextBlock[]>;
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

export interface ContextCompressorAdapter {
  name: string;
  compress(text: string, maxTokens: number): Promise<string> | string;
}

export type TokenizerFunction = (text: string) => number;
