export type FlowStatus = 'draft' | 'published' | 'archived';

export type MappingSourceType = 'flow_input' | 'block_output' | 'constant' | 'expression';

export interface MappingSource {
  type: MappingSourceType;
  name?: string;           // for flow_input
  blockId?: string;        // for block_output
  outputName?: string;     // for block_output
  value?: unknown;         // for constant
  expression?: string;     // for expression
}

export interface InputMapping {
  targetInput: string;
  source: MappingSource;
}

export interface FlowBlockConfig {
  timeout?: number;
  retryCount?: number;
  continueOnError?: boolean;
}

export interface FlowBlock {
  id: string;
  blockId: string;
  position: {
    x: number;
    y: number;
  };
  inputMappings: InputMapping[];
  config?: FlowBlockConfig;
}

export interface Connection {
  id: string;
  fromBlockId: string;
  toBlockId: string;
  condition?: {
    expression: string;
  };
}

export interface FlowInputDefinition {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  in?: 'path' | 'query' | 'header' | 'body';
}

export interface FlowOutputDefinition {
  name: string;
  type: string;
  description?: string;
  sourceBlockId: string;
  sourceOutput: string;
}

export interface FlowConfig {
  timeout?: number;
  parallel?: boolean;
  errorHandling?: 'stop' | 'continue' | 'rollback';
}

export interface Flow {
  _id?: string;
  name: string;
  description?: string;
  slug: string;
  version: number;
  blocks: FlowBlock[];
  connections: Connection[];
  inputs: FlowInputDefinition[];
  outputs: FlowOutputDefinition[];
  config: FlowConfig;
  status: FlowStatus;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  publishedAt?: Date;
  createdBy?: string;
}

export interface CreateFlowDto {
  name: string;
  description?: string;
  slug: string;
  blocks?: FlowBlock[];
  connections?: Connection[];
  inputs?: FlowInputDefinition[];
  outputs?: FlowOutputDefinition[];
  config?: FlowConfig;
  tags?: string[];
}

export interface UpdateFlowDto extends Partial<CreateFlowDto> {}
