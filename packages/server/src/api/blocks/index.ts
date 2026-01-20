import { ObjectId } from 'mongodb';
import { getDatabase, COLLECTIONS } from '../../config/database';
import { cacheService } from '../../config/redis';
import { authenticate } from '../../middleware/auth';
import { jsonResponse, errorResponse, paginatedResponse } from '../../utils/response';
import type { Block, CreateBlockDto, UpdateBlockDto } from '@codeblock-bff/shared';

export async function handleBlocksApi(request: Request, path: string): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  // Extract block ID from path if present
  const pathParts = path.split('/').filter(Boolean);
  const blockId = pathParts.length > 2 ? pathParts[2] : null;

  // Special routes
  if (blockId === 'from-openapi' && method === 'POST') {
    return createBlockFromOpenApi(request);
  }

  // CRUD operations
  switch (method) {
    case 'GET':
      if (blockId) {
        return getBlock(blockId);
      }
      return listBlocks(url);

    case 'POST':
      return createBlock(request);

    case 'PUT':
      if (!blockId) {
        return errorResponse('Block ID required', 400);
      }
      return updateBlock(blockId, request);

    case 'DELETE':
      if (!blockId) {
        return errorResponse('Block ID required', 400);
      }
      return deleteBlock(blockId);

    default:
      return errorResponse('Method not allowed', 405);
  }
}

async function listBlocks(url: URL): Promise<Response> {
  const db = getDatabase();
  const collection = db.collection<Block>(COLLECTIONS.BLOCKS);

  // Pagination
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const skip = (page - 1) * limit;

  // Filters
  const filter: Record<string, unknown> = {};
  const category = url.searchParams.get('category');
  const type = url.searchParams.get('type');
  const search = url.searchParams.get('search');

  if (category) filter.category = category;
  if (type) filter.type = type;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  // Sort
  const sortField = url.searchParams.get('sort') || 'createdAt';
  const sortOrder = url.searchParams.get('order') === 'asc' ? 1 : -1;

  const [blocks, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return paginatedResponse(blocks, total, page, limit);
}

async function getBlock(blockId: string): Promise<Response> {
  // Check cache first
  const cached = await cacheService.getBlock(blockId);
  if (cached) {
    return jsonResponse(cached);
  }

  const db = getDatabase();
  const collection = db.collection<Block>(COLLECTIONS.BLOCKS);

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(blockId);
  } catch {
    return errorResponse('Invalid block ID', 400);
  }

  const block = await collection.findOne({ _id: objectId });

  if (!block) {
    return errorResponse('Block not found', 404);
  }

  // Cache the result
  await cacheService.setBlock(blockId, block);

  return jsonResponse(block);
}

async function createBlock(request: Request): Promise<Response> {
  // Authentication required
  const authResult = await authenticate(request);
  if (!authResult.authenticated) {
    return errorResponse(authResult.error, authResult.status);
  }

  let body: CreateBlockDto;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  // Validation
  if (!body.name || !body.type || !body.source) {
    return errorResponse('Missing required fields: name, type, source', 400);
  }

  const db = getDatabase();
  const collection = db.collection(COLLECTIONS.BLOCKS);

  const block: Omit<Block, '_id'> = {
    name: body.name,
    description: body.description,
    type: body.type,
    source: body.source,
    inputs: body.inputs || [],
    outputs: body.outputs || [],
    category: body.category,
    tags: body.tags,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: authResult.user.sub,
  };

  const result = await collection.insertOne(block);

  return jsonResponse(
    { ...block, _id: result.insertedId },
    201
  );
}

async function updateBlock(blockId: string, request: Request): Promise<Response> {
  // Authentication required
  const authResult = await authenticate(request);
  if (!authResult.authenticated) {
    return errorResponse(authResult.error, authResult.status);
  }

  let body: UpdateBlockDto;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(blockId);
  } catch {
    return errorResponse('Invalid block ID', 400);
  }

  const db = getDatabase();
  const collection = db.collection(COLLECTIONS.BLOCKS);

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
    return errorResponse('Block not found', 404);
  }

  // Invalidate cache
  await cacheService.invalidateBlock(blockId);

  return jsonResponse(result);
}

async function deleteBlock(blockId: string): Promise<Response> {
  // Authentication required - handled by caller

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(blockId);
  } catch {
    return errorResponse('Invalid block ID', 400);
  }

  const db = getDatabase();
  const collection = db.collection(COLLECTIONS.BLOCKS);

  const result = await collection.deleteOne({ _id: objectId });

  if (result.deletedCount === 0) {
    return errorResponse('Block not found', 404);
  }

  // Invalidate cache
  await cacheService.invalidateBlock(blockId);

  return jsonResponse({ deleted: true });
}

async function createBlockFromOpenApi(request: Request): Promise<Response> {
  // Authentication required
  const authResult = await authenticate(request);
  if (!authResult.authenticated) {
    return errorResponse(authResult.error, authResult.status);
  }

  let body: { openApiUrl: string; operationId?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  if (!body.openApiUrl) {
    return errorResponse('openApiUrl is required', 400);
  }

  // TODO: Implement OpenAPI parsing and block generation
  // This will fetch the OpenAPI spec, parse it, and create blocks

  return errorResponse('Not implemented yet', 501);
}
