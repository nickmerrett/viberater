# Getting Started with Vibrater V2

Welcome! You've just completed **Phase 1** of the Vibrater backend. Here's how to get everything running.

## What's Been Built

✅ **Backend API** (Node.js + Express + PostgreSQL)
- Authentication with JWT
- Ideas CRUD endpoints
- Projects CRUD endpoints
- Tasks CRUD endpoints
- Database schema with migrations
- Docker Compose setup
- Stub routes for AI, Git, and Sync (Phase 2-5)

✅ **Frontend PWA** (V1 - existing)
- Idea capture with voice input
- Conversational interface
- Offline-first with localStorage

## Prerequisites

You need to install:

1. **Docker & Docker Compose** (recommended) OR
2. **Node.js 20+** and **PostgreSQL 15+**

### Installing Docker (Recommended)

**Fedora/RHEL:**
```bash
sudo dnf install docker docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Log out and back in for group changes
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Log out and back in
```

**macOS:**
```bash
brew install --cask docker
# Or download Docker Desktop from docker.com
```

### Installing Node.js (Alternative)

**Using nvm (recommended):**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

**Or package manager:**
```bash
# Fedora
sudo dnf install nodejs npm

# Ubuntu
sudo apt install nodejs npm
```

## Quick Start

### Option 1: Docker Compose (Recommended!)

**Complete stack with frontend, backend, and database:**

```bash
# 1. Make sure you're in the project root
cd /var/home/nmerrett/Documents/viberater

# 2. Environment is already set up (.env file exists)
#    Edit if you want to change settings:
nano .env

# 3. Start everything (PostgreSQL + Backend + Frontend + Nginx)
docker-compose up -d

# 4. Wait for services to be ready (30 seconds)
sleep 30

# 5. Run database migrations
docker-compose exec backend npm run migrate

# 6. Check that it's working
curl http://localhost:8080/health

# 7. View logs
docker-compose logs -f
```

**Your complete app is now running at http://localhost:8080** 🎉

This includes:
- Frontend (PWA) at http://localhost:8080
- Backend API at http://localhost:8080/api
- PostgreSQL database (internal)
- Nginx gateway (routing)

### Option 2: Local Development (Without Docker)

```bash
# 1. Install dependencies
cd vibrater-backend
npm install

# 2. Set up PostgreSQL
sudo -u postgres psql
CREATE DATABASE vibrater;
CREATE USER vibrater WITH PASSWORD 'vibrater_dev_password';
GRANT ALL PRIVILEGES ON DATABASE vibrater TO vibrater;
\q

# 3. Edit .env file
cd ..
nano .env
# Make sure DATABASE_URL matches your local PostgreSQL

# 4. Run migrations
cd vibrater-backend
npm run migrate

# 5. Start the server
npm run dev
```

## Testing the API

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-24T...",
  "environment": "development"
}
```

### 2. Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

Save the `accessToken` from the response!

### 3. Create an Idea

```bash
curl -X POST http://localhost:3000/api/ideas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "Build a music visualizer",
    "summary": "WebGL visualizer that reacts to music",
    "vibe": ["trippy", "visual"],
    "excitement": 8,
    "complexity": "weekend",
    "techStack": ["WebGL", "Web Audio API"]
  }'
```

### 4. Get All Ideas

```bash
curl http://localhost:3000/api/ideas \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 5. Promote Idea to Project

```bash
curl -X POST "http://localhost:3000/api/ideas/IDEA_ID/promote" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "projectTitle": "Audio Visualizer Project"
  }'
```

### 6. Create Tasks

```bash
curl -X POST "http://localhost:3000/api/tasks/project/PROJECT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "Set up WebGL canvas",
    "description": "Initialize WebGL context",
    "priority": "high",
    "estimatedMinutes": 60
  }'
```

## Using httpie (Better than curl)

Install httpie for easier API testing:

```bash
# Fedora
sudo dnf install httpie

# Ubuntu
sudo apt install httpie

# macOS
brew install httpie
```

Then:

```bash
# Register
http POST localhost:3000/api/auth/register email=test@example.com password=password123 name="Test User"

# Login
http POST localhost:3000/api/auth/login email=test@example.com password=password123

# Set token (bash)
export TOKEN="your-access-token-here"

# Create idea
http POST localhost:3000/api/ideas "Authorization: Bearer $TOKEN" title="Cool idea" excitement:=9

# List ideas
http localhost:3000/api/ideas "Authorization: Bearer $TOKEN"
```

## Running the Frontend PWA

The V1 PWA still works! It uses localStorage (no backend integration yet).

```bash
cd vibrater
python3 -m http.server 8000
```

Open http://localhost:8000

**Note:** Frontend will be updated in Phase 4 to use the new backend API.

## Project Status

### ✅ Phase 1: Backend Setup (COMPLETE!)
- [x] Backend structure
- [x] Express server
- [x] Database schema
- [x] Authentication (JWT)
- [x] Ideas CRUD
- [x] Projects CRUD
- [x] Tasks CRUD
- [x] Docker Compose

### 🔄 Phase 2: AI Integration (Next!)
- [ ] Claude API provider
- [ ] OpenAI API provider
- [ ] Ollama provider (local)
- [ ] AI chat endpoint
- [ ] Code scaffolding
- [ ] Task suggestions
- [ ] Debug assistance

### ⏳ Phase 3: Git Integration
- [ ] Git service
- [ ] Init/clone repositories
- [ ] Commit/push/pull
- [ ] Git status and diff

### ⏳ Phase 4: Frontend Updates
- [ ] Auth UI
- [ ] Project management UI
- [ ] Task management UI
- [ ] AI chat interface
- [ ] Code viewer

### ⏳ Phase 5: Sync & Polish
- [ ] Multi-device sync
- [ ] Conflict resolution
- [ ] Offline support
- [ ] Performance optimization

### ⏳ Phase 6: Deployment
- [ ] Production Docker setup
- [ ] Nginx configuration
- [ ] SSL certificates
- [ ] Database backups
- [ ] Monitoring

## Useful Commands

```bash
# Stop services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Rebuild backend after code changes
docker-compose build backend
docker-compose up -d backend

# View logs
docker-compose logs -f

# Access PostgreSQL
docker-compose exec postgres psql -U vibrater -d vibrater

# Run a command in backend container
docker-compose exec backend npm run migrate

# Clean everything
docker-compose down -v
docker system prune -a
```

## Troubleshooting

### Port already in use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Or port 5432 (PostgreSQL)
sudo lsof -i :5432

# Kill the process
sudo kill -9 <PID>
```

### Database connection failed

```bash
# Check PostgreSQL is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Migrations failed

```bash
# Connect to database and check tables
docker-compose exec postgres psql -U vibrater -d vibrater
\dt

# Drop all tables and re-run migrations (WARNING: deletes data!)
docker-compose exec postgres psql -U vibrater -d vibrater -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker-compose exec backend npm run migrate
```

### Permission denied on storage directory

```bash
# Fix permissions
sudo chown -R $USER:$USER vibrater-backend/storage
sudo chown -R $USER:$USER vibrater-backend/logs
```

## Next Steps

Now that Phase 1 is complete, you have a few options:

### Option A: Continue with Phase 2 (AI Integration)

Start building the AI coding companion:
- Set up Claude API (you'll need an API key from anthropic.com)
- Implement chat endpoint with streaming
- Add code generation
- Add debugging assistance

### Option B: Update Frontend First

Update the PWA to use the new backend:
- Add login/register screens
- Connect ideas to API instead of localStorage
- Add project and task management UI
- Test full flow

### Option C: Deploy Phase 1

Get the current backend deployed:
- Set up a VPS (Hetzner, DigitalOcean, etc.)
- Configure domain and SSL
- Deploy with Docker Compose
- Set up backups

## Getting Help

- **Architecture**: See `ARCHITECTURE.md` for full system design
- **API Docs**: See `vibrater-backend/README.md`
- **Backend Code**: Check `vibrater-backend/src/`

## Ready to Continue?

When you're ready to start Phase 2, let me know and we'll begin implementing the AI integration!

**Great work completing Phase 1! 🚀**
