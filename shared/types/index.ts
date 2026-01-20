export * from './block';
export * from './flow';
export * from './execution';

// Data source type (from Notion)
export interface DataSource {
  title: string;
  description: string;
  url: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Pagination
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// User info from Keycloak
export interface UserInfo {
  sub: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  roles?: string[];
}
