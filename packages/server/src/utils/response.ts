import type { ApiResponse } from '@codeblock-bff/shared';

export function jsonResponse<T>(
  data: T,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  const response: ApiResponse<T> = {
    success: status >= 200 && status < 300,
    data,
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function errorResponse(
  message: string,
  status: number = 400,
  code: string = 'ERROR'
): Response {
  const response: ApiResponse<null> = {
    success: false,
    error: {
      code,
      message,
    },
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): Response {
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    meta: {
      total,
      page,
      limit,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// CORS headers for development
export function corsHeaders(origin: string = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCors(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }
  return null;
}
