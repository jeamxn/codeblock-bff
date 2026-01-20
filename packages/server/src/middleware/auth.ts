import { verifyToken } from '../config/keycloak';
import type { UserInfo } from '@codeblock-bff/shared';

export interface AuthenticatedRequest extends Request {
  user?: UserInfo;
}

export type AuthMiddlewareResult =
  | { authenticated: true; user: UserInfo }
  | { authenticated: false; error: string; status: number };

export async function authenticate(request: Request): Promise<AuthMiddlewareResult> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return {
      authenticated: false,
      error: 'No authorization header',
      status: 401,
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      error: 'Invalid authorization header format',
      status: 401,
    };
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  if (!token) {
    return {
      authenticated: false,
      error: 'No token provided',
      status: 401,
    };
  }

  const user = await verifyToken(token);

  if (!user) {
    return {
      authenticated: false,
      error: 'Invalid or expired token',
      status: 401,
    };
  }

  return {
    authenticated: true,
    user,
  };
}

// Optional authentication - returns user if token is valid, null otherwise
export async function optionalAuth(request: Request): Promise<UserInfo | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) {
    return null;
  }

  return verifyToken(token);
}

// Check if user has required role
export function hasRole(user: UserInfo, role: string): boolean {
  return user.roles?.includes(role) ?? false;
}

// Check if user has any of the required roles
export function hasAnyRole(user: UserInfo, roles: string[]): boolean {
  if (!user.roles) return false;
  return roles.some(role => user.roles!.includes(role));
}

// Require specific roles middleware result
export function requireRoles(
  user: UserInfo,
  requiredRoles: string[]
): { authorized: true } | { authorized: false; error: string; status: number } {
  if (!hasAnyRole(user, requiredRoles)) {
    return {
      authorized: false,
      error: `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      status: 403,
    };
  }

  return { authorized: true };
}
