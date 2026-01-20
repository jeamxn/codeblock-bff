export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type BlockType =
  | 'api_call'      // API 호출 블럭
  | 'transform'     // 데이터 변환 블럭
  | 'condition'     // 조건 분기 블럭
  | 'loop'          // 반복 블럭
  | 'aggregate'     // 데이터 집계 블럭
  | 'custom';       // 커스텀 블럭

export interface InputDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  in: 'path' | 'query' | 'header' | 'body';
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  schema?: object;
}

export interface OutputDefinition {
  name: string;
  type: string;
  path: string; // JSONPath
  description?: string;
}

export interface BlockSource {
  openApiUrl: string;
  operationId: string;
  path: string;
  method: HttpMethod;
  serverUrl?: string;
}

export interface Block {
  _id?: string;
  name: string;
  description?: string;
  type: BlockType;
  source: BlockSource;
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
  category?: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}

export interface CreateBlockDto {
  name: string;
  description?: string;
  type: BlockType;
  source: BlockSource;
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
  category?: string;
  tags?: string[];
}

export interface UpdateBlockDto extends Partial<CreateBlockDto> {}
