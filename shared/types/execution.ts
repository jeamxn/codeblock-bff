export type ExecutionStatus = 'success' | 'failure' | 'partial';

export interface BlockExecutionRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface BlockExecutionResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface BlockExecutionError {
  message: string;
  code?: string;
}

export interface BlockExecution {
  blockId: string;
  blockName: string;
  status: ExecutionStatus | 'skipped';
  request?: BlockExecutionRequest;
  response?: BlockExecutionResponse;
  error?: BlockExecutionError;
  durationMs: number;
}

export interface ExecutionRequest {
  inputs: Record<string, unknown>;
  headers?: Record<string, string>;
  ip?: string;
  userAgent?: string;
}

export interface ExecutionResult {
  status: ExecutionStatus;
  outputs?: Record<string, unknown>;
  error?: {
    message: string;
    blockId?: string;
    stack?: string;
  };
}

export interface ExecutionPerformance {
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}

export interface ExecutionLog {
  _id?: string;
  flowId: string;
  flowVersion: number;
  request: ExecutionRequest;
  result: ExecutionResult;
  blockExecutions: BlockExecution[];
  performance: ExecutionPerformance;
}

export interface ExecutionContext {
  flowId: string;
  inputs: Record<string, unknown>;
  variables: Record<string, unknown>;
  blockResults: Map<string, BlockExecutionResult>;
}

export interface BlockExecutionResult {
  status: ExecutionStatus;
  outputs?: Record<string, unknown>;
  rawResponse?: {
    statusCode: number;
    data: unknown;
    headers: Record<string, string>;
  };
  error?: BlockExecutionError;
}
