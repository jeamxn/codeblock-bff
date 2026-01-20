import { getDatabase, COLLECTIONS } from '../../config/database';
import type { Flow } from '@codeblock-bff/shared';

export async function handleOpenApiDoc(request: Request): Promise<Response> {
  const openApiDoc = await generateOpenApiDoc();

  return new Response(JSON.stringify(openApiDoc, null, 2), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function generateOpenApiDoc(): Promise<OpenApiDocument> {
  const db = getDatabase();
  const collection = db.collection<Flow>(COLLECTIONS.FLOWS);

  // Get all published flows
  const flows = await collection
    .find({ status: 'published' })
    .toArray();

  // Base document
  const doc: OpenApiDocument = {
    openapi: '3.0.0',
    info: {
      title: 'BFF API',
      description: 'Block-based API composition server. Combine multiple APIs into single endpoints.',
      version: '1.0.0',
    },
    servers: [
      {
        url: process.env.BASE_URL || 'http://localhost:3003',
        description: 'BFF Server',
      },
    ],
    paths: {
      '/api/ping': {
        get: {
          operationId: 'healthCheck',
          summary: 'Health check',
          tags: ['System'],
          responses: {
            '200': {
              description: 'Server is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          status: { type: 'string' },
                          timestamp: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/blocks': {
        get: {
          operationId: 'listBlocks',
          summary: 'List all blocks',
          tags: ['Blocks'],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'type', in: 'query', schema: { type: 'string' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'List of blocks',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BlockListResponse' },
                },
              },
            },
          },
        },
        post: {
          operationId: 'createBlock',
          summary: 'Create a new block',
          tags: ['Blocks'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateBlockDto' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Block created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BlockResponse' },
                },
              },
            },
          },
        },
      },
      '/api/flows': {
        get: {
          operationId: 'listFlows',
          summary: 'List all flows',
          tags: ['Flows'],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'published', 'archived'] } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'List of flows',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/FlowListResponse' },
                },
              },
            },
          },
        },
        post: {
          operationId: 'createFlow',
          summary: 'Create a new flow',
          tags: ['Flows'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateFlowDto' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Flow created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/FlowResponse' },
                },
              },
            },
          },
        },
      },
      '/api/sources': {
        get: {
          operationId: 'listSources',
          summary: 'List OpenAPI sources from Notion',
          tags: ['Sources'],
          responses: {
            '200': {
              description: 'List of OpenAPI sources',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/DataSource' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Keycloak JWT token',
        },
      },
      schemas: {
        DataSource: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            url: { type: 'string' },
          },
        },
        Block: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['api_call', 'transform', 'condition', 'loop', 'aggregate', 'custom'] },
            source: { $ref: '#/components/schemas/BlockSource' },
            inputs: { type: 'array', items: { $ref: '#/components/schemas/InputDefinition' } },
            outputs: { type: 'array', items: { $ref: '#/components/schemas/OutputDefinition' } },
            category: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        BlockSource: {
          type: 'object',
          properties: {
            openApiUrl: { type: 'string' },
            operationId: { type: 'string' },
            path: { type: 'string' },
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
            serverUrl: { type: 'string' },
          },
        },
        InputDefinition: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            in: { type: 'string', enum: ['path', 'query', 'header', 'body'] },
            required: { type: 'boolean' },
            description: { type: 'string' },
          },
        },
        OutputDefinition: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            path: { type: 'string' },
            description: { type: 'string' },
          },
        },
        CreateBlockDto: {
          type: 'object',
          required: ['name', 'type', 'source'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string' },
            source: { $ref: '#/components/schemas/BlockSource' },
            inputs: { type: 'array', items: { $ref: '#/components/schemas/InputDefinition' } },
            outputs: { type: 'array', items: { $ref: '#/components/schemas/OutputDefinition' } },
            category: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        BlockResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: '#/components/schemas/Block' },
          },
        },
        BlockListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { $ref: '#/components/schemas/Block' } },
            meta: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                page: { type: 'integer' },
                limit: { type: 'integer' },
              },
            },
          },
        },
        Flow: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            slug: { type: 'string' },
            version: { type: 'integer' },
            status: { type: 'string', enum: ['draft', 'published', 'archived'] },
            blocks: { type: 'array', items: { type: 'object' } },
            connections: { type: 'array', items: { type: 'object' } },
            inputs: { type: 'array', items: { type: 'object' } },
            outputs: { type: 'array', items: { type: 'object' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateFlowDto: {
          type: 'object',
          required: ['name', 'slug'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            slug: { type: 'string' },
            blocks: { type: 'array', items: { type: 'object' } },
            connections: { type: 'array', items: { type: 'object' } },
            inputs: { type: 'array', items: { type: 'object' } },
            outputs: { type: 'array', items: { type: 'object' } },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        FlowResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: '#/components/schemas/Flow' },
          },
        },
        FlowListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { $ref: '#/components/schemas/Flow' } },
            meta: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                page: { type: 'integer' },
                limit: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  };

  // Add dynamic flow execution endpoints
  for (const flow of flows) {
    const pathKey = `/api/execute/${flow.slug}`;
    doc.paths[pathKey] = generateFlowEndpoint(flow);
  }

  return doc;
}

function generateFlowEndpoint(flow: Flow): PathItem {
  const hasBodyInput = flow.inputs.some(i => i.in === 'body');
  const method = hasBodyInput ? 'post' : 'get';

  const parameters = flow.inputs
    .filter(i => i.in !== 'body')
    .map(i => ({
      name: i.name,
      in: i.in || 'query',
      required: i.required,
      description: i.description,
      schema: { type: i.type || 'string' },
    }));

  const operation: Operation = {
    operationId: `execute_${flow.slug}`,
    summary: flow.name,
    description: flow.description,
    tags: ['Execute', ...(flow.tags || [])],
    parameters,
    responses: {
      '200': {
        description: 'Execution result',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
              },
            },
          },
        },
      },
    },
  };

  if (hasBodyInput) {
    const bodyInput = flow.inputs.find(i => i.in === 'body');
    operation.requestBody = {
      required: bodyInput?.required || false,
      content: {
        'application/json': {
          schema: { type: 'object' },
        },
      },
    };
  }

  return { [method]: operation };
}

// TypeScript types for OpenAPI
interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, PathItem>;
  components: {
    securitySchemes: Record<string, SecurityScheme>;
    schemas: Record<string, Schema>;
  };
}

interface PathItem {
  [method: string]: Operation;
}

interface Operation {
  operationId: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: {
    required?: boolean;
    content: Record<string, { schema: Schema }>;
  };
  responses: Record<string, {
    description: string;
    content?: Record<string, { schema: Schema }>;
  }>;
  security?: Array<Record<string, string[]>>;
}

interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema: Schema;
}

interface Schema {
  type?: string;
  format?: string;
  enum?: string[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  $ref?: string;
  default?: unknown;
}

interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  description?: string;
}
