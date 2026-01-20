import { getDatabase, COLLECTIONS } from '../../config/database';
import { cacheService } from '../../config/redis';
import { jsonResponse, errorResponse } from '../../utils/response';
import type { Flow, ExecutionLog, ExecutionContext, BlockExecutionResult } from '@codeblock-bff/shared';

export async function handleExecuteApi(request: Request, path: string): Promise<Response> {
  // Extract slug from path: /api/execute/:slug
  const pathParts = path.split('/').filter(Boolean);
  const slug = pathParts[2];

  if (!slug) {
    return errorResponse('Flow slug required', 400);
  }

  // Check for test mode
  const isTest = pathParts[3] === 'test';

  // Check for logs request
  if (pathParts[3] === 'logs') {
    return getExecutionLogs(slug);
  }

  return executeFlow(slug, request, isTest);
}

async function executeFlow(slug: string, request: Request, isTest: boolean): Promise<Response> {
  const startTime = Date.now();

  // Get flow (cache first)
  let flow = await cacheService.getFlowBySlug(slug) as Flow | null;

  if (!flow) {
    const db = getDatabase();
    const collection = db.collection<Flow>(COLLECTIONS.FLOWS);
    flow = await collection.findOne({ slug, status: 'published' });

    if (flow) {
      await cacheService.setFlowBySlug(slug, flow);
    }
  }

  if (!flow) {
    return errorResponse('Flow not found or not published', 404);
  }

  // Parse inputs from request
  let inputs: Record<string, unknown> = {};

  if (request.method === 'GET') {
    // Get inputs from query parameters
    const url = new URL(request.url);
    url.searchParams.forEach((value, key) => {
      // Try to parse JSON values
      try {
        inputs[key] = JSON.parse(value);
      } catch {
        inputs[key] = value;
      }
    });
  } else {
    // Get inputs from body
    try {
      inputs = await request.json();
    } catch {
      // Empty body is OK for some flows
    }
  }

  // Validate required inputs
  for (const input of flow.inputs) {
    if (input.required && inputs[input.name] === undefined) {
      return errorResponse(`Missing required input: ${input.name}`, 400);
    }
  }

  // Apply default values
  for (const input of flow.inputs) {
    if (inputs[input.name] === undefined && input.defaultValue !== undefined) {
      inputs[input.name] = input.defaultValue;
    }
  }

  try {
    // Execute the flow
    const result = await runFlowExecution(flow, inputs, isTest);

    const endTime = Date.now();

    // Log execution (async, don't wait)
    if (!isTest) {
      logExecution(flow, inputs, result, startTime, endTime, request).catch(console.error);
    }

    if (result.error) {
      return errorResponse(result.error.message, 500, 'EXECUTION_ERROR');
    }

    return jsonResponse(result.outputs || {});

  } catch (error) {
    console.error('Flow execution error:', error);
    const message = error instanceof Error ? error.message : 'Execution failed';
    return errorResponse(message, 500, 'EXECUTION_ERROR');
  }
}

async function runFlowExecution(
  flow: Flow,
  inputs: Record<string, unknown>,
  isTest: boolean
): Promise<{ outputs?: Record<string, unknown>; error?: { message: string; blockId?: string } }> {
  // Initialize execution context
  const context: ExecutionContext = {
    flowId: flow._id || '',
    inputs,
    variables: {},
    blockResults: new Map(),
  };

  // Get execution order (topological sort)
  const executionOrder = topologicalSort(flow.blocks, flow.connections);

  // Execute blocks in order
  for (const blockId of executionOrder) {
    const flowBlock = flow.blocks.find(b => b.id === blockId);
    if (!flowBlock) continue;

    try {
      // Resolve input mappings
      const blockInputs = resolveInputMappings(flowBlock.inputMappings, context);

      // Execute the block
      const result = await executeBlock(flowBlock.blockId, blockInputs, flowBlock.config, isTest);

      // Store result
      context.blockResults.set(blockId, result);

      // Check for errors
      if (result.error && !flowBlock.config?.continueOnError) {
        return {
          error: {
            message: result.error.message,
            blockId,
          },
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Block execution failed';
      if (!flowBlock.config?.continueOnError) {
        return {
          error: {
            message,
            blockId,
          },
        };
      }
    }
  }

  // Build outputs
  const outputs: Record<string, unknown> = {};
  for (const output of flow.outputs) {
    const blockResult = context.blockResults.get(output.sourceBlockId);
    if (blockResult?.outputs) {
      outputs[output.name] = blockResult.outputs[output.sourceOutput];
    }
  }

  return { outputs };
}

async function executeBlock(
  blockId: string,
  inputs: Record<string, unknown>,
  config?: { timeout?: number; retryCount?: number },
  isTest: boolean = false
): Promise<BlockExecutionResult> {
  // Get block definition
  let block = await cacheService.getBlock(blockId);

  if (!block) {
    const db = getDatabase();
    const collection = db.collection(COLLECTIONS.BLOCKS);
    const { ObjectId } = await import('mongodb');
    block = await collection.findOne({ _id: new ObjectId(blockId) });

    if (block) {
      await cacheService.setBlock(blockId, block);
    }
  }

  if (!block) {
    return {
      status: 'failure',
      error: { message: `Block not found: ${blockId}` },
    };
  }

  // For test mode, return mock data
  if (isTest) {
    return {
      status: 'success',
      outputs: { _test: true, blockId },
    };
  }

  // Build request based on block type
  if (block.type === 'api_call') {
    return executeApiCall(block, inputs, config);
  }

  if (block.type === 'transform') {
    return executeTransform(block, inputs);
  }

  return {
    status: 'failure',
    error: { message: `Unsupported block type: ${block.type}` },
  };
}

async function executeApiCall(
  block: any,
  inputs: Record<string, unknown>,
  config?: { timeout?: number }
): Promise<BlockExecutionResult> {
  const { source } = block;

  // Build URL with path parameters
  let url = `${source.serverUrl || ''}${source.path}`;
  const queryParams = new URLSearchParams();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: unknown = undefined;

  for (const input of block.inputs) {
    const value = inputs[input.name];
    if (value === undefined) continue;

    switch (input.in) {
      case 'path':
        url = url.replace(`{${input.name}}`, encodeURIComponent(String(value)));
        break;
      case 'query':
        queryParams.set(input.name, String(value));
        break;
      case 'header':
        headers[input.name] = String(value);
        break;
      case 'body':
        body = value;
        break;
    }
  }

  if (queryParams.toString()) {
    url += `?${queryParams.toString()}`;
  }

  try {
    const response = await fetch(url, {
      method: source.method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: config?.timeout ? AbortSignal.timeout(config.timeout) : undefined,
    });

    const data = await response.json();

    // Extract outputs using JSONPath
    const outputs: Record<string, unknown> = {};
    for (const output of block.outputs) {
      outputs[output.name] = extractJsonPath(data, output.path);
    }

    return {
      status: response.ok ? 'success' : 'failure',
      outputs,
      rawResponse: {
        statusCode: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'API call failed';
    return {
      status: 'failure',
      error: { message },
    };
  }
}

async function executeTransform(
  block: any,
  inputs: Record<string, unknown>
): Promise<BlockExecutionResult> {
  // TODO: Implement data transformation logic
  return {
    status: 'success',
    outputs: inputs,
  };
}

// Topological sort for execution order
function topologicalSort(blocks: Flow['blocks'], connections: Flow['connections']): string[] {
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize
  for (const block of blocks) {
    graph.set(block.id, []);
    inDegree.set(block.id, 0);
  }

  // Build graph
  for (const conn of connections) {
    graph.get(conn.fromBlockId)?.push(conn.toBlockId);
    inDegree.set(conn.toBlockId, (inDegree.get(conn.toBlockId) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: string[] = [];

  for (const [blockId, degree] of inDegree) {
    if (degree === 0) queue.push(blockId);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    for (const next of graph.get(current) || []) {
      const newDegree = (inDegree.get(next) || 0) - 1;
      inDegree.set(next, newDegree);
      if (newDegree === 0) queue.push(next);
    }
  }

  return result;
}

// Resolve input mappings
function resolveInputMappings(
  mappings: Flow['blocks'][0]['inputMappings'],
  context: ExecutionContext
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const mapping of mappings) {
    switch (mapping.source.type) {
      case 'flow_input':
        result[mapping.targetInput] = context.inputs[mapping.source.name || ''];
        break;
      case 'block_output':
        const blockResult = context.blockResults.get(mapping.source.blockId || '');
        if (blockResult?.outputs) {
          result[mapping.targetInput] = blockResult.outputs[mapping.source.outputName || ''];
        }
        break;
      case 'constant':
        result[mapping.targetInput] = mapping.source.value;
        break;
      case 'expression':
        // TODO: Implement expression evaluation
        result[mapping.targetInput] = mapping.source.expression;
        break;
    }
  }

  return result;
}

// Simple JSONPath extractor
function extractJsonPath(data: unknown, path: string): unknown {
  if (!path || path === '$') return data;

  const parts = path.replace(/^\$\.?/, '').split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    // Handle array index
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = (current as Record<string, unknown>)[key];
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)];
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

// Log execution
async function logExecution(
  flow: Flow,
  inputs: Record<string, unknown>,
  result: { outputs?: Record<string, unknown>; error?: { message: string; blockId?: string } },
  startTime: number,
  endTime: number,
  request: Request
): Promise<void> {
  const db = getDatabase();
  const collection = db.collection<ExecutionLog>(COLLECTIONS.EXECUTION_LOGS);

  const log: Omit<ExecutionLog, '_id'> = {
    flowId: flow._id || '',
    flowVersion: flow.version,
    request: {
      inputs,
      headers: Object.fromEntries(request.headers.entries()),
      ip: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    },
    result: {
      status: result.error ? 'failure' : 'success',
      outputs: result.outputs,
      error: result.error,
    },
    blockExecutions: [], // TODO: Collect block execution details
    performance: {
      startedAt: new Date(startTime),
      completedAt: new Date(endTime),
      durationMs: endTime - startTime,
    },
  };

  await collection.insertOne(log);
}

async function getExecutionLogs(slug: string): Promise<Response> {
  const db = getDatabase();
  const flowCollection = db.collection<Flow>(COLLECTIONS.FLOWS);
  const logCollection = db.collection<ExecutionLog>(COLLECTIONS.EXECUTION_LOGS);

  const flow = await flowCollection.findOne({ slug });
  if (!flow) {
    return errorResponse('Flow not found', 404);
  }

  const logs = await logCollection
    .find({ flowId: flow._id?.toString() })
    .sort({ 'performance.startedAt': -1 })
    .limit(100)
    .toArray();

  return jsonResponse(logs);
}
