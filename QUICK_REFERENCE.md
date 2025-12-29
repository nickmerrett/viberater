# Vibrater Quick Reference

Quick commands and API examples for daily use.

## Docker Compose Commands

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop everything
docker-compose down

# Rebuild backend
docker-compose build backend

# Run migrations
docker-compose exec backend npm run migrate

# Access PostgreSQL
docker-compose exec postgres psql -U vibrater -d vibrater

# Fresh start (delete all data)
docker-compose down -v
```

## Kubernetes Commands

```bash
# Deploy/update
kubectl apply -k k8s/

# View status
kubectl get pods -n vibrater
kubectl get svc -n vibrater
kubectl get ingress -n vibrater

# Logs
kubectl logs -n vibrater -l app=vibrater-backend -f

# Restart
kubectl rollout restart deployment/vibrater-backend -n vibrater

# Delete everything
kubectl delete -k k8s/

# Port forward for testing
kubectl port-forward -n vibrater svc/vibrater-backend-service 3000:80
```

## API Examples (curl)

### Authentication

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login (save the accessToken!)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Set token variable
export TOKEN="your-access-token-here"

# Get current user
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Ideas

```bash
# Create idea
curl -X POST http://localhost:3000/api/ideas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Build a music visualizer",
    "summary": "WebGL visualizer that reacts to audio",
    "vibe": ["trippy", "visual", "music"],
    "excitement": 8,
    "complexity": "weekend",
    "techStack": ["WebGL", "Web Audio API", "Canvas"]
  }'

# List all ideas
curl http://localhost:3000/api/ideas \
  -H "Authorization: Bearer $TOKEN"

# Get single idea
curl http://localhost:3000/api/ideas/{ID} \
  -H "Authorization: Bearer $TOKEN"

# Update idea
curl -X PUT http://localhost:3000/api/ideas/{ID} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"excitement": 9}'

# Delete idea
curl -X DELETE http://localhost:3000/api/ideas/{ID} \
  -H "Authorization: Bearer $TOKEN"

# Promote to project
curl -X POST http://localhost:3000/api/ideas/{ID}/promote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"projectTitle": "Music Visualizer Project"}'
```

### Projects

```bash
# Create project
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Audio Visualizer",
    "description": "Real-time music visualizer with WebGL",
    "techStack": ["React", "WebGL", "Web Audio API"],
    "vibe": ["trippy", "visual"],
    "excitement": 9
  }'

# List all projects
curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN"

# Get project details (includes tasks)
curl http://localhost:3000/api/projects/{ID} \
  -H "Authorization: Bearer $TOKEN"

# Update project
curl -X PUT http://localhost:3000/api/projects/{ID} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "in-progress", "completionPercent": 25}'

# Start project
curl -X POST http://localhost:3000/api/projects/{ID}/start \
  -H "Authorization: Bearer $TOKEN"

# Complete project
curl -X POST http://localhost:3000/api/projects/{ID}/complete \
  -H "Authorization: Bearer $TOKEN"

# Delete project
curl -X DELETE http://localhost:3000/api/projects/{ID} \
  -H "Authorization: Bearer $TOKEN"
```

### Tasks

```bash
# Create task
curl -X POST http://localhost:3000/api/tasks/project/{PROJECT_ID} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Set up WebGL canvas",
    "description": "Initialize WebGL context and shaders",
    "priority": "high",
    "estimatedMinutes": 120
  }'

# List tasks for project
curl http://localhost:3000/api/tasks/project/{PROJECT_ID} \
  -H "Authorization: Bearer $TOKEN"

# Update task
curl -X PUT http://localhost:3000/api/tasks/{TASK_ID} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "in-progress"}'

# Start task
curl -X POST http://localhost:3000/api/tasks/{TASK_ID}/start \
  -H "Authorization: Bearer $TOKEN"

# Complete task
curl -X POST http://localhost:3000/api/tasks/{TASK_ID}/complete \
  -H "Authorization: Bearer $TOKEN"

# Delete task
curl -X DELETE http://localhost:3000/api/tasks/{TASK_ID} \
  -H "Authorization: Bearer $TOKEN"
```

## API Examples (httpie)

Install: `brew install httpie` or `sudo apt install httpie`

```bash
# Register
http POST localhost:3000/api/auth/register email=test@example.com password=password123 name="Test User"

# Login
http POST localhost:3000/api/auth/login email=test@example.com password=password123

# Set token
export TOKEN="your-token"

# Create idea
http POST localhost:3000/api/ideas \
  "Authorization: Bearer $TOKEN" \
  title="Cool project idea" \
  summary="Build something awesome" \
  excitement:=9 \
  vibe:='["trippy", "visual"]' \
  techStack:='["React", "WebGL"]'

# List ideas
http localhost:3000/api/ideas "Authorization: Bearer $TOKEN"

# Create project
http POST localhost:3000/api/projects \
  "Authorization: Bearer $TOKEN" \
  title="My Project" \
  description="Project description" \
  excitement:=8

# Create task
http POST localhost:3000/api/tasks/project/{PROJECT_ID} \
  "Authorization: Bearer $TOKEN" \
  title="First task" \
  priority=high \
  estimatedMinutes:=60
```

## Database Queries

```bash
# Connect to database
docker-compose exec postgres psql -U vibrater -d vibrater

# Or in Kubernetes
kubectl exec -it -n vibrater <postgres-pod> -- psql -U vibrater -d vibrater
```

Useful queries:
```sql
-- List all tables
\dt

-- Count users
SELECT COUNT(*) FROM users;

-- View all ideas
SELECT id, title, status, excitement FROM ideas;

-- View projects with task counts
SELECT
  p.id,
  p.title,
  p.status,
  COUNT(t.id) as task_count
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
GROUP BY p.id;

-- View user's recent activity
SELECT
  'idea' as type,
  title,
  created_at
FROM ideas WHERE user_id = 'USER_ID'
UNION ALL
SELECT
  'project' as type,
  title,
  created_at
FROM projects WHERE user_id = 'USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

## Building Container Image

```bash
cd vibrater-backend

# Build
./build-and-push.sh ghcr.io/yourusername v1.0.0

# Or manually
docker build -t your-registry/vibrater-backend:latest .
docker push your-registry/vibrater-backend:latest
```

## Environment Variables

```bash
# Copy example
cp .env.example .env

# Edit (use your favorite editor)
nano .env
# or
vim .env
# or
code .env
```

Required variables:
- `DATABASE_PASSWORD` - PostgreSQL password
- `JWT_SECRET` - Secret for JWT tokens (min 32 chars)

Optional (Phase 2+):
- `CLAUDE_API_KEY` - For AI features
- `OPENAI_API_KEY` - Alternative AI provider
- `OLLAMA_BASE_URL` - Local LLM

## Troubleshooting

### Port already in use

```bash
# Find process on port 3000
sudo lsof -i :3000
# or
sudo netstat -tulpn | grep 3000

# Kill it
sudo kill -9 <PID>
```

### Database connection failed

```bash
# Check PostgreSQL is running
docker-compose ps
# or
kubectl get pods -n vibrater -l app=postgres

# Restart it
docker-compose restart postgres
# or
kubectl rollout restart statefulset/postgres -n vibrater
```

### Migrations failed

```bash
# Re-run migrations
docker-compose exec backend npm run migrate

# Or fresh start (WARNING: deletes all data!)
docker-compose down -v
docker-compose up -d
docker-compose exec backend npm run migrate
```

## File Locations

- **Main docs:** `ARCHITECTURE.md`, `GETTING_STARTED.md`, `PROJECT_STATUS.md`
- **Backend code:** `vibrater-backend/src/`
- **Database schema:** `vibrater-backend/migrations/001_initial_schema.sql`
- **Docker config:** `docker-compose.yml`
- **Kubernetes config:** `k8s/`
- **Environment:** `.env` (created from `.env.example`)

## Next Steps

1. **Start backend:** `docker-compose up -d`
2. **Run migrations:** `docker-compose exec backend npm run migrate`
3. **Test API:** Use curl/httpie examples above
4. **Read full docs:** `GETTING_STARTED.md`

## Support

- 📖 Full architecture: `ARCHITECTURE.md`
- 🚀 Setup guide: `GETTING_STARTED.md`
- 📊 Project status: `PROJECT_STATUS.md`
- 🐳 Docker setup: `docker-compose.yml`
- ☸️ Kubernetes: `k8s/README.md`

**Happy building! 🚀**
