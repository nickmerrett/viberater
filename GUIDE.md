# Vibrater User Guide

Complete guide for installation, usage, and API reference.

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Common Commands](#common-commands)
4. [API Reference](#api-reference)
5. [Troubleshooting](#troubleshooting)

---

## Installation

### Prerequisites

Choose one of these setups:

**Option A: Docker (Recommended)**
- Docker 20+ and Docker Compose
- 2GB RAM minimum
- 5GB disk space

**Option B: Local Development**
- Node.js 20+
- PostgreSQL 15+ or SQLite3
- 2GB RAM minimum

### Installing Docker

**macOS:**
```bash
brew install --cask docker
# Or download Docker Desktop from docker.com
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Log out and back in
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install docker docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Log out and back in
```

### Installing Node.js (Alternative)

**Using nvm (recommended):**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

**Package manager:**
```bash
# macOS
brew install node

# Ubuntu
sudo apt install nodejs npm

# Fedora
sudo dnf install nodejs npm
```

---

## Quick Start

### Docker Compose Setup (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/nickmerrett/viberater.git
cd viberater

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env and add your API keys
nano .env
# Add: CLAUDE_API_KEY=sk-ant-...
#      OPENAI_API_KEY=sk-...

# 4. Start the application (uses SQLite by default)
docker compose up -d

# 5. Run database migrations
docker compose exec backend npm run migrate

# 6. Open in browser
open http://localhost:8080
```

**Using PostgreSQL instead:**
```bash
# Start with PostgreSQL
docker compose --profile postgres up -d

# Run migrations
docker compose exec backend npm run migrate
```

### Local Development Setup

**Backend:**
```bash
cd vibrater-backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your API keys and database settings
nano .env

# Run migrations
npm run migrate

# Start development server
npm run dev
```

**Frontend:**
```bash
cd vibrater

# Install dependencies
npm install

# Start development server
npm run dev

# Access at http://localhost:5173
```

---

## Common Commands

### Docker Compose

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend

# Rebuild after code changes
docker compose build backend
docker compose up -d

# Run migrations
docker compose exec backend npm run migrate

# Access backend shell
docker compose exec backend sh

# Database migration from PostgreSQL to SQLite
docker compose exec backend npm run migrate:pg-to-sqlite

# Fresh start (delete all data)
docker compose down -v
```

### Development

```bash
# Backend development
cd vibrater-backend
npm run dev           # Start with hot reload
npm run migrate       # Run database migrations
npm test              # Run tests

# Frontend development
cd vibrater
npm run dev           # Start dev server
npm run build         # Build for production
npm run preview       # Preview production build
```

### Database Operations

**SQLite:**
```bash
# Backup
cp vibrater-backend/storage/vibrater.db backups/vibrater-$(date +%Y%m%d).db

# View database
sqlite3 vibrater-backend/storage/vibrater.db
.tables
.schema ideas
SELECT * FROM ideas LIMIT 10;
.quit
```

**PostgreSQL:**
```bash
# Access database
docker compose exec postgres psql -U vibrater -d vibrater

# Backup
docker compose exec postgres pg_dump -U vibrater vibrater > backup.sql

# Restore
docker compose exec -i postgres psql -U vibrater vibrater < backup.sql

# Common queries
docker compose exec postgres psql -U vibrater -d vibrater -c "SELECT COUNT(*) FROM ideas;"
```

### Kubernetes

```bash
# Deploy application
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/backend-deployment-sqlite.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# View status
kubectl get pods -n vibrater
kubectl get svc -n vibrater
kubectl get ingress -n vibrater

# View logs
kubectl logs -f deployment/vibrater-backend -n vibrater
kubectl logs -f deployment/vibrater-frontend -n vibrater

# Restart services
kubectl rollout restart deployment/vibrater-backend -n vibrater

# Port forwarding for testing
kubectl port-forward svc/vibrater-backend-service 3000:80 -n vibrater

# Delete everything
kubectl delete namespace vibrater
```

---

## API Reference

Base URL: `http://localhost:8080/api` (or your production domain)

### Authentication

**Register**
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "yourpassword",
  "name": "Your Name"
}
```

**Login**
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "yourpassword"
}

Response:
{
  "user": { "id": "...", "email": "...", "name": "..." },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**Get Current User**
```bash
GET /api/auth/me
Authorization: Bearer {accessToken}
```

**Refresh Token**
```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

### Ideas

**Create Idea**
```bash
POST /api/ideas
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "My Awesome Idea",
  "summary": "A brief description",
  "tags": ["web", "ai"],
  "vibe": ["creative", "technical"],
  "excitement": 8,
  "complexity": "weekend"
}
```

**Get All Ideas**
```bash
GET /api/ideas
Authorization: Bearer {accessToken}

Optional query params:
?status=idea          # Filter by status
?archived=false       # Show only active ideas
```

**Get Single Idea**
```bash
GET /api/ideas/:id
Authorization: Bearer {accessToken}
```

**Update Idea**
```bash
PUT /api/ideas/:id
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "Updated title",
  "tags": ["updated", "tags"],
  "archived": false
}
```

**Delete Idea**
```bash
DELETE /api/ideas/:id
Authorization: Bearer {accessToken}
```

### Projects

**Create Project**
```bash
POST /api/projects
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "My Project",
  "description": "Project description",
  "origin_idea_id": "idea-uuid",
  "tech_stack": ["react", "node"],
  "excitement": 9
}
```

**Get All Projects**
```bash
GET /api/projects
Authorization: Bearer {accessToken}
```

**Update Project**
```bash
PUT /api/projects/:id
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "status": "in-progress",
  "completion_percent": 50
}
```

### Tasks

**Create Task**
```bash
POST /api/tasks
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "project_id": "project-uuid",
  "title": "Implement feature X",
  "description": "Details...",
  "priority": "high",
  "sort_order": 1
}
```

**Update Task**
```bash
PUT /api/tasks/:id
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "status": "completed",
  "actual_minutes": 120
}
```

**Get Project Tasks**
```bash
GET /api/tasks/project/:projectId
Authorization: Bearer {accessToken}
```

### AI Integration

**Transcribe Audio**
```bash
POST /api/ai/transcribe
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "audio": "base64-encoded-audio-data",
  "mimeType": "audio/webm"
}

Response:
{
  "transcript": "spoken text...",
  "title": "Auto-generated title",
  "summary": "Cleaned up summary",
  "tags": ["auto", "generated", "tags"]
}
```

**Chat/Refine Idea**
```bash
POST /api/ai/chat
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Tell me about my idea..." }
  ],
  "provider": "claude",
  "model": "claude-3-5-sonnet-20240620"
}
```

**Get Available AI Providers**
```bash
GET /api/ai/providers
Authorization: Bearer {accessToken}

Response:
{
  "providers": {
    "claude": {
      "name": "Claude",
      "available": true,
      "models": ["claude-3-5-sonnet-20240620", ...]
    },
    "openai": { ... },
    "ollama": { ... }
  }
}
```

### Example: Complete Workflow

```bash
# 1. Register/Login
TOKEN=$(curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass"}' | jq -r '.accessToken')

# 2. Create an idea
IDEA_ID=$(curl -X POST http://localhost:8080/api/ideas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Build a PWA",
    "summary":"Offline-first progressive web app",
    "tags":["pwa","react"],
    "excitement":9
  }' | jq -r '.id')

# 3. Get all ideas
curl http://localhost:8080/api/ideas \
  -H "Authorization: Bearer $TOKEN"

# 4. Update idea
curl -X PUT http://localhost:8080/api/ideas/$IDEA_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tags":["pwa","react","offline"]}'

# 5. Create a project from idea
PROJECT_ID=$(curl -X POST http://localhost:8080/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\":\"PWA Project\",
    \"origin_idea_id\":\"$IDEA_ID\"
  }" | jq -r '.id')

# 6. Add a task
curl -X POST http://localhost:8080/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\":\"$PROJECT_ID\",
    \"title\":\"Setup service worker\",
    \"priority\":\"high\"
  }"
```

---

## Troubleshooting

### Common Issues

**"Connection refused" errors:**
```bash
# Check if services are running
docker compose ps

# Check logs
docker compose logs backend

# Restart services
docker compose restart backend
```

**Database migration errors:**
```bash
# Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up -d
docker compose exec backend npm run migrate
```

**SQLite "database locked" errors:**
- SQLite only supports single writer
- Reduce backend replicas to 1
- Or switch to PostgreSQL for concurrent access

**PWA not installing:**
- PWA requires HTTPS (except localhost)
- Check manifest.json is being served
- Check service worker registration in DevTools

**Voice input not working:**
```bash
# Check browser permissions
# Chrome: Settings → Privacy → Site Settings → Microphone

# Check API keys in .env
docker compose exec backend printenv | grep API_KEY

# Check backend logs
docker compose logs -f backend
```

**Tags showing as strings instead of arrays:**
```bash
# This is a data migration issue
# Re-run the migration script
docker compose exec backend npm run migrate:pg-to-sqlite
```

### Getting Help

1. Check logs: `docker compose logs -f`
2. Check `/health` endpoint: `curl http://localhost:8080/health`
3. Verify environment variables are set
4. Check [GitHub Issues](https://github.com/nickmerrett/viberater/issues)

### Performance Tips

**SQLite:**
- Keep database < 1GB for best performance
- Single backend instance only
- Run VACUUM periodically
- Use persistent volume for /storage

**PostgreSQL:**
- Scale backend replicas for more throughput
- Configure connection pool size
- Regular VACUUM ANALYZE
- Monitor slow queries

---

## Additional Resources

- [Technical Documentation](DOCS.md) - Architecture, database, deployment
- [Project Status](PROJECT_STATUS.md) - Features and roadmap
- [Kubernetes Guide](k8s/README.md) - K8s deployment details
- [PWA Details](vibrater/PWA_SETUP.md) - Offline functionality

