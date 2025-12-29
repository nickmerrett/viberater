# Vibrater Backend API

Node.js + Express + PostgreSQL backend for the Vibrater development lifecycle platform.

## Quick Start

### Option 1: Docker Compose (Recommended)

From the project root:

```bash
# Copy environment file
cp .env.example .env

# Start PostgreSQL + Backend
docker-compose up -d

# Run migrations
docker-compose exec backend npm run migrate

# View logs
docker-compose logs -f backend
```

The API will be available at http://localhost:3000

### Option 2: Local Development

Requirements:
- Node.js 20+
- PostgreSQL 15+

```bash
cd vibrater-backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npm run migrate

# Start dev server
npm run dev
```

## API Endpoints

### Health Check
```
GET /health
```

### Authentication
```
POST /api/auth/register - Register new user
POST /api/auth/login - Login
POST /api/auth/refresh - Refresh access token
POST /api/auth/logout - Logout
GET  /api/auth/me - Get current user
```

### Ideas
```
GET    /api/ideas - List all ideas
GET    /api/ideas/:id - Get single idea
POST   /api/ideas - Create idea
PUT    /api/ideas/:id - Update idea
DELETE /api/ideas/:id - Delete idea
POST   /api/ideas/:id/promote - Promote idea to project
```

### Projects
```
GET    /api/projects - List all projects
GET    /api/projects/:id - Get project with tasks
POST   /api/projects - Create project
PUT    /api/projects/:id - Update project
DELETE /api/projects/:id - Delete project
POST   /api/projects/:id/start - Start project
POST   /api/projects/:id/complete - Complete project
```

### Tasks
```
GET    /api/tasks/project/:projectId - Get tasks for project
POST   /api/tasks/project/:projectId - Create task
PUT    /api/tasks/:id - Update task
DELETE /api/tasks/:id - Delete task
POST   /api/tasks/:id/start - Start task
POST   /api/tasks/:id/complete - Complete task
```

### AI (Phase 2 - Coming Soon)
```
POST /api/ai/chat - AI chat
POST /api/ai/scaffold - Scaffold project
POST /api/ai/suggest-tasks - Get AI task suggestions
POST /api/ai/debug - Debug help
GET  /api/ai/providers - List AI providers
```

### Git (Phase 3 - Coming Soon)
```
POST /api/git/init - Initialize repo
POST /api/git/clone - Clone repo
GET  /api/git/:projectId/status - Git status
POST /api/git/:projectId/commit - Commit changes
POST /api/git/:projectId/push - Push changes
POST /api/git/:projectId/pull - Pull changes
```

### Sync (Phase 5 - Coming Soon)
```
GET  /api/sync - Pull sync data
POST /api/sync - Push sync data
```

## Development

### Project Structure
```
src/
├── server.js           # Express app entry
├── config/
│   ├── database.js     # PostgreSQL connection
│   └── ai-providers.js # AI provider config
├── routes/
│   ├── auth.js         # Authentication
│   ├── ideas.js        # Ideas CRUD
│   ├── projects.js     # Projects CRUD
│   ├── tasks.js        # Tasks CRUD
│   ├── ai.js           # AI endpoints (stub)
│   ├── git.js          # Git endpoints (stub)
│   └── sync.js         # Sync endpoints (stub)
├── middleware/
│   └── auth.js         # JWT authentication
└── services/           # (Phase 2+)
```

### Database Migrations

Migrations are in `migrations/` and run sequentially.

```bash
# Run all migrations
npm run migrate

# Or with Docker
docker-compose exec backend npm run migrate
```

### Testing

```bash
# Install httpie or use curl
http POST http://localhost:3000/api/auth/register email=test@example.com password=password123 name=Test

http POST http://localhost:3000/api/auth/login email=test@example.com password=password123

# Use the accessToken from login
http GET http://localhost:3000/api/ideas "Authorization: Bearer <token>"
```

## Environment Variables

See `.env.example` for all configuration options.

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT tokens (min 32 chars)

Optional:
- `CLAUDE_API_KEY` - For Phase 2 AI features
- `OPENAI_API_KEY` - Alternative AI provider
- `OLLAMA_BASE_URL` - Local LLM option
- `CORS_ORIGIN` - Frontend URL

## Phase 1 Status

✅ Backend structure
✅ Express server
✅ Database schema
✅ Authentication (JWT)
✅ Ideas CRUD
✅ Projects CRUD
✅ Tasks CRUD
✅ Docker Compose setup
⏳ AI integration (Phase 2)
⏳ Git integration (Phase 3)
⏳ Sync (Phase 5)

## Next Steps

- **Phase 2**: Implement AI chat and code generation
- **Phase 3**: Add git repository operations
- **Phase 4**: Update frontend to use new API
- **Phase 5**: Multi-device sync
