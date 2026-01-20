# CodeBlock BFF

Block-based API composition server. Combine multiple APIs into single endpoints using a visual editor.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Frontend (Vue.js + Vue Flow)                │
│   Block Editor (drag & drop) + API Test + Doc Viewer    │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                    BFF Server (Bun)                      │
│  /api/blocks, /api/flows, /api/execute/:slug            │
│  /api/sources, /openapi.json, /api/auth                 │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   ┌─────────┐        ┌─────────┐        ┌───────────┐
   │ MongoDB │        │  Redis  │        │ Notion DB │
   │ (Store) │        │ (Cache) │        │ (Sources) │
   └─────────┘        └─────────┘        └───────────┘
```

## Tech Stack

- **Runtime**: Bun
- **Backend**: Bun HTTP Server
- **Frontend**: Vue 3 + Vue Flow + Vite
- **Database**: MongoDB
- **Cache**: Redis (Bun built-in)
- **Auth**: Keycloak

## Project Structure

```
/app/
├── packages/
│   ├── server/          # Backend (Bun)
│   │   └── src/
│   │       ├── api/     # API handlers
│   │       ├── config/  # Database, Redis, Keycloak
│   │       ├── engine/  # Flow execution engine
│   │       └── utils/   # Notion integration
│   │
│   └── web/             # Frontend (Vue.js)
│       └── src/
│           ├── views/   # Pages
│           ├── stores/  # Pinia stores
│           └── lib/     # API client
│
└── shared/              # Shared types
    └── types/
```

## Getting Started

### Prerequisites

- Bun v1.0+
- MongoDB
- Redis
- Keycloak (optional)

### Environment Variables

```env
# MongoDB
MONGODB_URI=mongodb://admin:password@localhost:27017/codeblock-bff?authSource=admin

# Redis
REDIS_URL=redis://localhost:6379/

# Notion (for API sources)
NOTION_API_KEY=your-notion-api-key
NOTION_DATA_SOURCE_ID=your-database-id

# Keycloak (optional)
KEYCLOAK_AUTH_CLIENT_URI=https://keycloak.example.com
KEYCLOAK_AUTH_SERVER_URI=https://keycloak.example.com
KEYCLOAK_CLIENT_ID=your-client-id
KEYCLOAK_REALM=your-realm
KEYCLOAK_SECRET=your-secret
```

### Installation

```bash
# Install dependencies
bun install

# Run development server
bun run dev:server    # Backend on http://localhost:3003
bun run dev:web       # Frontend on http://localhost:5173

# Or run both
bun run dev
```

## Features

### Block Editor

- Visual drag-and-drop interface
- Connect blocks to create API composition flows
- Configure input mappings between blocks
- Test flows before publishing

### API Composition

- Create reusable API blocks from OpenAPI specs
- Chain multiple API calls with data transformation
- Automatic execution order via topological sort
- Error handling and retries

### Dynamic API Generation

- Published flows become callable endpoints
- Auto-generated OpenAPI documentation
- Execute flows via `/api/execute/:slug`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | /api/blocks | Block CRUD |
| GET/POST | /api/flows | Flow CRUD |
| POST | /api/flows/:id/publish | Publish flow |
| ALL | /api/execute/:slug | Execute flow |
| GET | /api/sources | List OpenAPI sources |
| GET | /openapi.json | BFF OpenAPI doc |

## License

MIT
