import { ObjectId } from 'mongodb';
import { getDatabase, COLLECTIONS } from '../../config/database';
import { cacheService } from '../../config/redis';
import { authenticate } from '../../middleware/auth';
import { jsonResponse, errorResponse, paginatedResponse } from '../../utils/response';
import type { Flow, CreateFlowDto, UpdateFlowDto } from '@codeblock-bff/shared';

export async function handleFlowsApi(request: Request, path: string): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  // Extract flow ID from path if present
  const pathParts = path.split('/').filter(Boolean);
  const flowId = pathParts.length > 2 ? pathParts[2] : null;
  const action = pathParts.length > 3 ? pathParts[3] : null;

  // Special actions
  if (flowId && action === 'publish' && method === 'POST') {
    return publishFlow(flowId, request);
  }

  if (flowId && action === 'clone' && method === 'POST') {
    return cloneFlow(flowId, request);
  }

  if (flowId && action === 'versions' && method === 'GET') {
    return getFlowVersions(flowId);
  }

  // CRUD operations
  switch (method) {
    case 'GET':
      if (flowId) {
        return getFlow(flowId);
      }
      return listFlows(url);

    case 'POST':
      return createFlow(request);

    case 'PUT':
      if (!flowId) {
        return errorResponse('Flow ID required', 400);
      }
      return updateFlow(flowId, request);

    case 'DELETE':
      if (!flowId) {
        return errorResponse('Flow ID required', 400);
      }
      return deleteFlow(flowId, request);

    default:
      return errorResponse('Method not allowed', 405);
  }
}

async function listFlows(url: URL): Promise<Response> {
  const db = getDatabase();
  const collection = db.collection<Flow>(COLLECTIONS.FLOWS);

  // Pagination
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const skip = (page - 1) * limit;

  // Filters
  const filter: Record<string, unknown> = {};
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');

  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
    ];
  }

  // Sort
  const sortField = url.searchParams.get('sort') || 'updatedAt';
  const sortOrder = url.searchParams.get('order') === 'asc' ? 1 : -1;

  const [flows, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return paginatedResponse(flows, total, page, limit);
}

async function getFlow(flowId: string): Promise<Response> {
  // Check cache first
  const cached = await cacheService.getFlow(flowId);
  if (cached) {
    return jsonResponse(cached);
  }

  const db = getDatabase();
  const collection = db.collection<Flow>(COLLECTIONS.FLOWS);

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(flowId);
  } catch {
    return errorResponse('Invalid flow ID', 400);
  }

  const flow = await collection.findOne({ _id: objectId });

  if (!flow) {
    return errorResponse('Flow not found', 404);
  }

  // Cache the result
  await cacheService.setFlow(flowId, flow);

  return jsonResponse(flow);
}

async function createFlow(request: Request): Promise<Response> {
  // Authentication required
  const authResult = await authenticate(request);
  if (!authResult.authenticated) {
    return errorResponse(authResult.error, authResult.status);
  }

  let body: CreateFlowDto;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  // Validation
  if (!body.name || !body.slug) {
    return errorResponse('Missing required fields: name, slug', 400);
  }

  // Validate slug format (URL-safe)
  if (!/^[a-z0-9-]+$/.test(body.slug)) {
    return errorResponse('Slug must be lowercase alphanumeric with hyphens only', 400);
  }

  const db = getDatabase();
  const collection = db.collection(COLLECTIONS.FLOWS);

  // Check for duplicate slug
  const existing = await collection.findOne({ slug: body.slug });
  if (existing) {
    return errorResponse('A flow with this slug already exists', 409);
  }

  const flow: Omit<Flow, '_id'> = {
    name: body.name,
    description: body.description,
    slug: body.slug,
    version: 1,
    blocks: body.blocks || [],
    connections: body.connections || [],
    inputs: body.inputs || [],
    outputs: body.outputs || [],
    config: body.config || {},
    status: 'draft',
    tags: body.tags,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: authResult.user.sub,
  };

  const result = await collection.insertOne(flow);

  return jsonResponse(
    { ...flow, _id: result.insertedId },
    201
  );
}

async function updateFlow(flowId: string, request: Request): Promise<Response> {
  // Authentication required
  const authResult = await authenticate(request);
  if (!authResult.authenticated) {
    return errorResponse(authResult.error, authResult.status);
  }

  let body: UpdateFlowDto;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(flowId);
  } catch {
    return errorResponse('Invalid flow ID', 400);
  }

  const db = getDatabase();
  const collection = db.collection<Flow>(COLLECTIONS.FLOWS);

  // Get current flow to check slug change
  const currentFlow = await collection.findOne({ _id: objectId });
  if (!currentFlow) {
    return errorResponse('Flow not found', 404);
  }

  // If slug is being changed, check for duplicates
  if (body.slug && body.slug !== currentFlow.slug) {
    if (!/^[a-z0-9-]+$/.test(body.slug)) {
      return errorResponse('Slug must be lowercase alphanumeric with hyphens only', 400);
    }

    const existing = await collection.findOne({ slug: body.slug });
    if (existing) {
      return errorResponse('A flow with this slug already exists', 409);
    }
  }

  const updateData: Record<string, unknown> = {
    ...body,
    updatedAt: new Date(),
  };

  const result = await collection.findOneAndUpdate(
    { _id: objectId },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  if (!result) {
    return errorResponse('Flow not found', 404);
  }

  // Invalidate cache
  await cacheService.invalidateFlow(flowId, currentFlow.slug);
  if (body.slug && body.slug !== currentFlow.slug) {
    await cacheService.invalidateFlow(flowId, body.slug);
  }

  return jsonResponse(result);
}

async function deleteFlow(flowId: string, request: Request): Promise<Response> {
  // Authentication required
  const authResult = await authenticate(request);
  if (!authResult.authenticated) {
    return errorResponse(authResult.error, authResult.status);
  }

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(flowId);
  } catch {
    return errorResponse('Invalid flow ID', 400);
  }

  const db = getDatabase();
  const collection = db.collection<Flow>(COLLECTIONS.FLOWS);

  // Get flow to get slug for cache invalidation
  const flow = await collection.findOne({ _id: objectId });
  if (!flow) {
    return errorResponse('Flow not found', 404);
  }

  await collection.deleteOne({ _id: objectId });

  // Invalidate cache
  await cacheService.invalidateFlow(flowId, flow.slug);

  return jsonResponse({ deleted: true });
}

async function publishFlow(flowId: string, request: Request): Promise<Response> {
  // Authentication required
  const authResult = await authenticate(request);
  if (!authResult.authenticated) {
    return errorResponse(authResult.error, authResult.status);
  }

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(flowId);
  } catch {
    return errorResponse('Invalid flow ID', 400);
  }

  const db = getDatabase();
  const collection = db.collection<Flow>(COLLECTIONS.FLOWS);

  const result = await collection.findOneAndUpdate(
    { _id: objectId },
    {
      $set: {
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
      },
      $inc: { version: 1 },
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return errorResponse('Flow not found', 404);
  }

  // Invalidate cache
  await cacheService.invalidateFlow(flowId, result.slug);

  return jsonResponse(result);
}

async function cloneFlow(flowId: string, request: Request): Promise<Response> {
  // Authentication required
  const authResult = await authenticate(request);
  if (!authResult.authenticated) {
    return errorResponse(authResult.error, authResult.status);
  }

  let body: { name?: string; slug: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  if (!body.slug) {
    return errorResponse('slug is required for cloning', 400);
  }

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(flowId);
  } catch {
    return errorResponse('Invalid flow ID', 400);
  }

  const db = getDatabase();
  const collection = db.collection<Flow>(COLLECTIONS.FLOWS);

  const sourceFlow = await collection.findOne({ _id: objectId });
  if (!sourceFlow) {
    return errorResponse('Flow not found', 404);
  }

  // Check for duplicate slug
  const existing = await collection.findOne({ slug: body.slug });
  if (existing) {
    return errorResponse('A flow with this slug already exists', 409);
  }

  const clonedFlow: Omit<Flow, '_id'> = {
    name: body.name || `${sourceFlow.name} (Copy)`,
    description: sourceFlow.description,
    slug: body.slug,
    version: 1,
    blocks: sourceFlow.blocks,
    connections: sourceFlow.connections,
    inputs: sourceFlow.inputs,
    outputs: sourceFlow.outputs,
    config: sourceFlow.config,
    status: 'draft',
    tags: sourceFlow.tags,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: authResult.user.sub,
  };

  const result = await collection.insertOne(clonedFlow);

  return jsonResponse(
    { ...clonedFlow, _id: result.insertedId },
    201
  );
}

async function getFlowVersions(flowId: string): Promise<Response> {
  // TODO: Implement version history
  // This would require storing version history in a separate collection
  return errorResponse('Not implemented yet', 501);
}
