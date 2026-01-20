import type { ApiResponse, Block, Flow, DataSource, CreateBlockDto, CreateFlowDto, UpdateBlockDto, UpdateFlowDto } from '@codeblock-bff/shared';

const BASE_URL = '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  // Add auth token if available
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response.json();
}

// Blocks API
export const blocksApi = {
  list: (params?: { page?: number; limit?: number; category?: string; type?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.set(key, String(value));
      });
    }
    const query = searchParams.toString();
    return request<Block[]>(`/blocks${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<Block>(`/blocks/${id}`),

  create: (data: CreateBlockDto) =>
    request<Block>('/blocks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateBlockDto) =>
    request<Block>(`/blocks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ deleted: boolean }>(`/blocks/${id}`, {
      method: 'DELETE',
    }),

  createFromOpenApi: (openApiUrl: string, operationId?: string) =>
    request<Block>('/blocks/from-openapi', {
      method: 'POST',
      body: JSON.stringify({ openApiUrl, operationId }),
    }),
};

// Flows API
export const flowsApi = {
  list: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.set(key, String(value));
      });
    }
    const query = searchParams.toString();
    return request<Flow[]>(`/flows${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<Flow>(`/flows/${id}`),

  create: (data: CreateFlowDto) =>
    request<Flow>('/flows', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateFlowDto) =>
    request<Flow>(`/flows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ deleted: boolean }>(`/flows/${id}`, {
      method: 'DELETE',
    }),

  publish: (id: string) =>
    request<Flow>(`/flows/${id}/publish`, {
      method: 'POST',
    }),

  clone: (id: string, data: { name?: string; slug: string }) =>
    request<Flow>(`/flows/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Sources API
export const sourcesApi = {
  list: () => request<DataSource[]>('/sources'),

  refresh: () =>
    request<{ refreshed: boolean }>('/sources/refresh', {
      method: 'POST',
    }),

  getOperations: (sourceIndex: number) =>
    request<{ source: DataSource; operations: unknown[] }>(`/sources/${sourceIndex}/operations`),

  proxySpec: (url: string) => {
    const params = new URLSearchParams({ url });
    return request<unknown>(`/sources/proxy?${params}`);
  },
};

// Execute API
export const executeApi = {
  run: <T = unknown>(slug: string, inputs: Record<string, unknown> = {}, method: 'GET' | 'POST' = 'POST') => {
    if (method === 'GET') {
      const params = new URLSearchParams();
      Object.entries(inputs).forEach(([key, value]) => {
        params.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      });
      const query = params.toString();
      return request<T>(`/execute/${slug}${query ? `?${query}` : ''}`);
    }
    return request<T>(`/execute/${slug}`, {
      method: 'POST',
      body: JSON.stringify(inputs),
    });
  },

  test: <T = unknown>(slug: string, inputs: Record<string, unknown> = {}) =>
    request<T>(`/execute/${slug}/test`, {
      method: 'POST',
      body: JSON.stringify(inputs),
    }),

  getLogs: (slug: string) => request<unknown[]>(`/execute/${slug}/logs`),
};

// Auth API
export const authApi = {
  getConfig: () => request<{ url: string; realm: string; clientId: string }>('/auth/config'),
};
