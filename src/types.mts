export interface ContextHistoryItem {
  role: string;
  content: string;
}

export interface ContextRequest {
  query: string;
  taskType?: string;
  maxTokens?: number;
  maxItems?: number;
  categories?: string[];
  history?: ContextHistoryItem[];
  hints?: {
    filePaths?: string[];
    symbolNames?: string[];
    sources?: string[];
    preferDense?: boolean;
  };
  output?: {
    mode?: 'rendered' | 'items' | 'both';
    format?: 'markdown' | 'plain';
  };
}

export interface ContextItem {
  id: string;
  kind: 'guideline' | 'knowledge' | 'history' | 'file' | 'symbol' | 'note' | 'custom';
  title: string;
  content: string;
  score?: number;
  source?: string;
  metadata?: Record<string, unknown>;
  rationale?: string[];
}

export interface ContextResult {
  rendered?: string;
  items?: ContextItem[];
  diagnostics?: {
    strategy: string;
    budget?: {
      requested?: number;
      used?: number;
    };
    excluded?: Array<{
      id: string;
      reason: string;
    }>;
    warnings?: string[];
  };
}

export interface ContextBlock {
  id: string;
  category: string;
  tags: string[];
  title: string;
  body: string;
}

export interface ContextStore {
  query(text: string, categories: string[]): Promise<ContextBlock[]>;
  add?(block: ContextBlock): Promise<void>;
  list?(): Promise<ContextBlock[]>;
}
