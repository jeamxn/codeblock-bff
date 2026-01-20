import type { UserInfo } from '@codeblock-bff/shared';

export interface KeycloakConfig {
  authClientUri: string;  // For frontend login page
  authServerUri: string;  // For server API requests
  clientId: string;
  realm: string;
  clientSecret: string;
}

export function getKeycloakConfig(): KeycloakConfig {
  const config: KeycloakConfig = {
    authClientUri: process.env.KEYCLOAK_AUTH_CLIENT_URI || '',
    authServerUri: process.env.KEYCLOAK_AUTH_SERVER_URI || '',
    clientId: process.env.KEYCLOAK_CLIENT_ID || '',
    realm: process.env.KEYCLOAK_REALM || '',
    clientSecret: process.env.KEYCLOAK_SECRET || '',
  };

  if (!config.authServerUri || !config.clientId || !config.realm) {
    console.warn('Keycloak configuration is incomplete. Authentication may not work.');
  }

  return config;
}

// Token introspection response
interface IntrospectionResponse {
  active: boolean;
  sub?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  realm_access?: {
    roles?: string[];
  };
  resource_access?: {
    [key: string]: {
      roles?: string[];
    };
  };
}

export async function verifyToken(token: string): Promise<UserInfo | null> {
  const config = getKeycloakConfig();

  if (!config.authServerUri || !config.clientId || !config.realm) {
    console.error('Keycloak configuration is incomplete');
    return null;
  }

  const introspectUrl = `${config.authServerUri}/realms/${config.realm}/protocol/openid-connect/token/introspect`;

  try {
    const response = await fetch(introspectUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!response.ok) {
      console.error('Token introspection failed:', response.status);
      return null;
    }

    const data: IntrospectionResponse = await response.json();

    if (!data.active) {
      return null;
    }

    // Extract roles from realm_access and resource_access
    const roles: string[] = [];
    if (data.realm_access?.roles) {
      roles.push(...data.realm_access.roles);
    }
    if (data.resource_access?.[config.clientId]?.roles) {
      roles.push(...data.resource_access[config.clientId].roles);
    }

    return {
      sub: data.sub || '',
      name: data.name,
      email: data.email,
      preferred_username: data.preferred_username,
      roles,
    };
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

// Get Keycloak public key for JWT verification (alternative method)
export async function getPublicKey(): Promise<string | null> {
  const config = getKeycloakConfig();

  if (!config.authServerUri || !config.realm) {
    return null;
  }

  const certsUrl = `${config.authServerUri}/realms/${config.realm}/protocol/openid-connect/certs`;

  try {
    const response = await fetch(certsUrl);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    // Return the first key (usually RS256)
    return data.keys?.[0]?.x5c?.[0] || null;
  } catch {
    return null;
  }
}

// Frontend config (safe to expose)
export function getKeycloakClientConfig() {
  const config = getKeycloakConfig();
  return {
    url: config.authClientUri,
    realm: config.realm,
    clientId: config.clientId,
  };
}
