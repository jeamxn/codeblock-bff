import { cacheService } from '../../config/redis';
import { jsonResponse, errorResponse } from '../../utils/response';
import { getSortedData, resetCache } from '../../utils/notion/getSortedData';

export async function handleSourcesApi(request: Request, path: string): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  const pathParts = path.split('/').filter(Boolean);
  const sourceId = pathParts.length > 2 ? pathParts[2] : null;
  const action = pathParts.length > 3 ? pathParts[3] : null;

  // Refresh sources
  if (sourceId === 'refresh' && method === 'POST') {
    resetCache();
    return jsonResponse({ refreshed: true });
  }

  // Proxy for fetching OpenAPI specs
  if (sourceId === 'proxy' && method === 'GET') {
    return proxyOpenApiSpec(url);
  }

  // Get operations from a specific source
  if (sourceId && action === 'operations') {
    return getSourceOperations(sourceId);
  }

  // List sources
  if (method === 'GET') {
    return listSources();
  }

  return errorResponse('Method not allowed', 405);
}

async function listSources(): Promise<Response> {
  try {
    const sources = await getSortedData();
    return jsonResponse(sources);
  } catch (error) {
    console.error('Failed to fetch sources:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch sources';
    return errorResponse(message, 500);
  }
}

async function proxyOpenApiSpec(url: URL): Promise<Response> {
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return errorResponse('url parameter is required', 400);
  }

  // Check cache
  const cached = await cacheService.getOpenApiSpec(targetUrl);
  if (cached) {
    return jsonResponse(cached);
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json, application/yaml, text/yaml, */*',
      },
    });

    if (!response.ok) {
      return errorResponse(`Failed to fetch OpenAPI spec: ${response.status}`, response.status);
    }

    const contentType = response.headers.get('content-type') || '';
    let spec: unknown;

    if (contentType.includes('yaml') || targetUrl.endsWith('.yaml') || targetUrl.endsWith('.yml')) {
      // For YAML, return as text and let the client parse
      const text = await response.text();
      return new Response(text, {
        headers: {
          'Content-Type': 'text/yaml',
        },
      });
    } else {
      spec = await response.json();
    }

    // Cache the spec
    await cacheService.setOpenApiSpec(targetUrl, spec);

    return jsonResponse(spec);
  } catch (error) {
    console.error('Failed to proxy OpenAPI spec:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch OpenAPI spec';
    return errorResponse(message, 500);
  }
}

async function getSourceOperations(sourceId: string): Promise<Response> {
  // sourceId is the index in the sources list
  const index = parseInt(sourceId, 10);
  if (isNaN(index)) {
    return errorResponse('Invalid source ID', 400);
  }

  try {
    const sources = await getSortedData();
    const source = sources[index];

    if (!source) {
      return errorResponse('Source not found', 404);
    }

    // Fetch the OpenAPI spec
    const response = await fetch(source.url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return errorResponse(`Failed to fetch OpenAPI spec: ${response.status}`, response.status);
    }

    const spec = await response.json() as OpenApiSpec;

    // Extract operations
    const operations = extractOperations(spec, source.url);

    return jsonResponse({
      source,
      operations,
    });
  } catch (error) {
    console.error('Failed to get source operations:', error);
    const message = error instanceof Error ? error.message : 'Failed to get operations';
    return errorResponse(message, 500);
  }
}

interface OpenApiSpec {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    description?: string;
  };
  servers?: Array<{ url: string }>;
  paths?: Record<string, Record<string, OperationObject>>;
}

interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema?: object;
    description?: string;
  }>;
  requestBody?: {
    content?: Record<string, { schema?: object }>;
    required?: boolean;
  };
  responses?: Record<string, {
    description?: string;
    content?: Record<string, { schema?: object }>;
  }>;
}

interface ExtractedOperation {
  operationId: string;
  path: string;
  method: string;
  summary?: string;
  description?: string;
  parameters: Array<{
    name: string;
    in: string;
    required: boolean;
    type: string;
    description?: string;
  }>;
  requestBody?: {
    required: boolean;
    schema?: object;
  };
  responses: Array<{
    statusCode: string;
    description?: string;
    schema?: object;
  }>;
}

function extractOperations(spec: OpenApiSpec, sourceUrl: string): ExtractedOperation[] {
  const operations: ExtractedOperation[] = [];

  if (!spec.paths) return operations;

  const serverUrl = spec.servers?.[0]?.url || '';

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
        const op = operation as OperationObject;

        const extractedOp: ExtractedOperation = {
          operationId: op.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          path,
          method: method.toUpperCase(),
          summary: op.summary,
          description: op.description,
          parameters: (op.parameters || []).map(p => ({
            name: p.name,
            in: p.in,
            required: p.required || false,
            type: getSchemaType(p.schema),
            description: p.description,
          })),
          responses: Object.entries(op.responses || {}).map(([code, res]) => ({
            statusCode: code,
            description: res.description,
            schema: res.content?.['application/json']?.schema,
          })),
        };

        if (op.requestBody) {
          extractedOp.requestBody = {
            required: op.requestBody.required || false,
            schema: op.requestBody.content?.['application/json']?.schema,
          };
        }

        operations.push(extractedOp);
      }
    }
  }

  return operations;
}

function getSchemaType(schema?: object): string {
  if (!schema) return 'string';
  const s = schema as Record<string, unknown>;
  return (s.type as string) || 'object';
}
