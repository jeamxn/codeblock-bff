import Keycloak from 'keycloak-js';
import { authApi } from './api';

let keycloak: Keycloak | null = null;

export async function initKeycloak(): Promise<Keycloak | null> {
  try {
    const response = await authApi.getConfig();

    if (!response.success || !response.data) {
      console.warn('Failed to get Keycloak config');
      return null;
    }

    const { url, realm, clientId } = response.data;

    if (!url || !realm || !clientId) {
      console.warn('Keycloak config is incomplete');
      return null;
    }

    keycloak = new Keycloak({
      url,
      realm,
      clientId,
    });

    const authenticated = await keycloak.init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
      checkLoginIframe: false,
    });

    if (authenticated && keycloak.token) {
      localStorage.setItem('auth_token', keycloak.token);

      // Auto refresh token
      setInterval(() => {
        keycloak?.updateToken(30).then(refreshed => {
          if (refreshed && keycloak?.token) {
            localStorage.setItem('auth_token', keycloak.token);
          }
        });
      }, 30000);
    }

    return keycloak;
  } catch (error) {
    console.error('Keycloak init error:', error);
    return null;
  }
}

export function getKeycloak(): Keycloak | null {
  return keycloak;
}

export function login(): void {
  keycloak?.login();
}

export function logout(): void {
  localStorage.removeItem('auth_token');
  keycloak?.logout();
}

export function isAuthenticated(): boolean {
  return keycloak?.authenticated ?? false;
}

export function getToken(): string | undefined {
  return keycloak?.token;
}

export function getUserInfo() {
  if (!keycloak?.tokenParsed) return null;

  return {
    id: keycloak.tokenParsed.sub,
    name: keycloak.tokenParsed.name,
    email: keycloak.tokenParsed.email,
    username: keycloak.tokenParsed.preferred_username,
  };
}
