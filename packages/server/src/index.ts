import { connectDatabase, config } from './config';
import { jsonResponse, errorResponse, handleCors, corsHeaders } from './utils/response';
import { authenticate, optionalAuth } from './middleware/auth';
import { getKeycloakClientConfig } from './config/keycloak';

// API route handlers (will be implemented)
import { handleBlocksApi } from './api/blocks';
import { handleFlowsApi } from './api/flows';
import { handleExecuteApi } from './api/execute';
import { handleSourcesApi } from './api/sources';
import { handleOpenApiDoc } from './api/openapi';

const server = Bun.serve({
  port: config.port,

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    // Add CORS headers to all responses
    const addCors = (response: Response): Response => {
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders()).forEach(([key, value]) => {
        headers.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    };

    try {
      // Health check
      if (path === '/api/ping') {
        return addCors(jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }));
      }

      // Keycloak client config (for frontend)
      if (path === '/api/auth/config') {
        return addCors(jsonResponse(getKeycloakClientConfig()));
      }

      // OpenAPI documentation
      if (path === '/openapi.json' || path === '/api/openapi.json') {
        return addCors(await handleOpenApiDoc(request));
      }

      // API routes
      if (path.startsWith('/api/blocks')) {
        return addCors(await handleBlocksApi(request, path));
      }

      if (path.startsWith('/api/flows')) {
        return addCors(await handleFlowsApi(request, path));
      }

      if (path.startsWith('/api/execute/')) {
        return addCors(await handleExecuteApi(request, path));
      }

      if (path.startsWith('/api/sources')) {
        return addCors(await handleSourcesApi(request, path));
      }

      // 404 for unknown routes
      return addCors(errorResponse('Not found', 404, 'NOT_FOUND'));

    } catch (error) {
      console.error('Server error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      return addCors(errorResponse(message, 500, 'INTERNAL_ERROR'));
    }
  },
});

// Initialize database connection
async function init() {
  try {
    await connectDatabase();
    console.log(`Server running at http://localhost:${server.port}`);
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
}

init();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  server.stop();
  process.exit(0);
});
