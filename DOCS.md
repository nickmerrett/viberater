# Vibrater Documentation

Complete technical documentation for architecture, database, and deployment.

## Table of Contents

1. [Architecture](#architecture)
2. [Database Configuration](#database-configuration)
3. [Deployment](#deployment)
4. [API Reference](#api-reference)

---

## Architecture

### System Overview

Vibrater is a full-stack Progressive Web App for capturing and managing project ideas with AI assistance.

**Tech Stack:**

**Frontend**
- React 18 + Vite
- Tailwind CSS for styling
- Zustand for state management
- Workbox for PWA/offline support
- Service Worker for offline-first functionality

**Backend**
- Node.js + Express
- SQLite or PostgreSQL (configurable)
- JWT authentication
- AI integration (Claude, OpenAI)

**Infrastructure**
- Docker & Docker Compose
- Nginx reverse proxy
- Kubernetes support (optional)

### System Architecture

```
┌────────────────────────────────────────────────────────┐
│                  Vibrater PWA                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Idea Capture │  │   Projects   │  │  AI Chat     │ │
│  │   (Voice)    │  │   & Tasks    │  │  Refinement  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────┬──────────────────────────────┘
                          │ REST API
┌─────────────────────────▼──────────────────────────────┐
│               Vibrater Backend API                     │
│                 (Node.js + Express)                    │
│  ┌──────────────────────────────────────────────────┐ │
│  │  JWT Auth + Rate Limiting                        │ │
│  └──────────────────────────────────────────────────┘ │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│  │  Ideas     │  │  Projects  │  │   AI Chat  │      │
│  │  Routes    │  │  Routes    │  │   Routes   │      │
│  └────────────┘  └────────────┘  └────────────┘      │
└────┬───────────────────────┬──────────────────────────┘
     │                       │
     ▼                       ▼
┌─────────────┐    ┌──────────────────┐
│  SQLite or  │    │  AI Providers    │
│  PostgreSQL │    │  - Claude API    │
│             │    │  - OpenAI API    │
│ - users     │    │  - Ollama        │
│ - ideas     │    └──────────────────┘
│ - projects  │
│ - tasks     │
└─────────────┘
```

### Data Flow

1. **Idea Capture**: Voice/text → Whisper (transcribe) → Claude (extract title/tags) → Database
2. **Refinement**: User input → Claude (guided conversation) → Updated idea + conversation history
3. **Project Promotion**: Idea → Claude (generate plan) → New project with tasks
4. **Offline Support**: Operations → IndexedDB queue → Sync when online → Server

### Key Features

- **Voice Input**: Push-to-talk recording with Whisper transcription
- **AI Refinement**: Guided conversation to flesh out ideas
- **Tag Management**: Auto-tagging from AI, manual editing
- **Offline-First**: Full functionality offline with background sync
- **PWA**: Installable on mobile and desktop
- **Multi-Database**: Switch between SQLite and PostgreSQL

---

## Database Configuration

Vibrater supports both **SQLite** and **PostgreSQL**. Choose based on your deployment needs.

### Quick Comparison

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| **Setup** | Zero config | Requires server |
| **Performance** | Fast for small data | Better for large data |
| **Portability** | Single file | Network database |
| **Backups** | Copy file | pg_dump |
| **Concurrent Writes** | Limited | Excellent |
| **Best For** | Personal use, small teams | Production, scaling |

### SQLite Configuration (Default)

**Setup:**

```bash
# .env
DB_TYPE=sqlite
SQLITE_DIR=./storage
```

**Benefits:**
- ✅ No separate database server
- ✅ Single file for entire database
- ✅ Perfect for development and personal use
- ✅ Easy migration (just copy the .db file)

**Limitations:**
- ⚠️ Single writer (no concurrent writes)
- ⚠️ Not ideal for high-traffic production

**Location:**
Database stored at `vibrater-backend/storage/vibrater.db`

**Backup:**
```bash
# Simple file copy
cp vibrater-backend/storage/vibrater.db backups/vibrater-$(date +%Y%m%d).db

# Or with SQLite tools
sqlite3 storage/vibrater.db ".backup backups/vibrater.db"
```

### PostgreSQL Configuration

**Setup:**

```bash
# .env
DB_TYPE=postgres
DATABASE_URL=postgresql://user:password@localhost:5432/vibrater
```

**Benefits:**
- ✅ Supports multiple backend replicas
- ✅ Better concurrent access
- ✅ Production-grade
- ✅ Advanced features (transactions, constraints)

**Limitations:**
- ⚠️ Requires PostgreSQL server
- ⚠️ More complex setup and backups

**Backup:**
```bash
# Dump entire database
docker compose exec postgres pg_dump -U vibrater vibrater > backup.sql

# Compressed format
docker compose exec postgres pg_dump -U vibrater -Fc vibrater > backup.dump

# Restore
docker compose exec -i postgres psql -U vibrater vibrater < backup.sql
```

### Database Schema

**Core Tables:**

- `users` - User accounts and settings
- `devices` - Device registration for sync
- `ideas` - Captured ideas with AI conversation history
- `projects` - Promoted ideas with structured plans
- `tasks` - Project tasks with status tracking
- `refresh_tokens` - JWT refresh tokens

**Key Fields:**

```sql
-- Ideas table (simplified)
CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  tags TEXT,              -- JSON array: ["web", "ai"]
  vibe TEXT,              -- JSON array: ["creative", "technical"]
  excitement INTEGER,      -- 1-10 scale
  complexity TEXT,         -- afternoon, weekend, week, etc.
  conversation TEXT,       -- JSON: AI chat history
  archived INTEGER,        -- 0 or 1 (SQLite boolean)
  created_at DATETIME,
  updated_at DATETIME
);
```

### Switching Databases

**From PostgreSQL to SQLite:**

1. Export data from PostgreSQL
2. Update `.env` with `DB_TYPE=sqlite`
3. Run migrations: `npm run migrate`
4. Use migration script: `npm run migrate:pg-to-sqlite`

**From SQLite to PostgreSQL:**

1. Start PostgreSQL: `docker compose --profile postgres up -d`
2. Update `.env` with `DB_TYPE=postgres`
3. Run migrations: `npm run migrate`
4. Data import (manual - contact maintainer for script)

### Automatic Type Conversions

The database layer automatically handles:

- ✅ **Arrays** → JSON strings (tags, vibe, tech_stack)
- ✅ **Objects** → JSON strings (conversation, settings)
- ✅ **Booleans** → Integers (archived: 0/1)
- ✅ **Dates** → ISO strings
- ✅ **UUIDs** → Auto-generated for SQLite

---

## Deployment

### Docker Compose (Recommended)

**Quick Start:**

```bash
# Clone and configure
git clone https://github.com/nickmerrett/viberater.git
cd viberater
cp .env.example .env

# Edit .env with your API keys
# CLAUDE_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...

# Start (uses SQLite by default)
docker compose up -d

# Access at http://localhost:8080
```

**Services:**

- `frontend` - React PWA (port 80 internal)
- `backend` - Node.js API (port 3000 internal)
- `nginx` - Reverse proxy (port 8080)
- `postgres` - Optional PostgreSQL (port 5432)

**Using PostgreSQL:**

```bash
# Start with PostgreSQL
docker compose --profile postgres up -d

# Run migrations
docker compose exec backend npm run migrate
```

### Kubernetes Deployment

**SQLite Mode (Simple):**

```bash
# Apply SQLite deployment
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/backend-deployment-sqlite.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

**PostgreSQL Mode (Production):**

```bash
# Apply PostgreSQL deployment
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-pvc.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

See [k8s/README.md](k8s/README.md) for detailed Kubernetes documentation.

### Environment Variables

**Required:**

```bash
# Database
DB_TYPE=sqlite                    # or 'postgres'
SQLITE_DIR=./storage             # for SQLite
DATABASE_URL=postgresql://...    # for PostgreSQL

# JWT Authentication
JWT_SECRET=your-secret-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# AI Providers (at least one required)
CLAUDE_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

**Optional:**

```bash
# AI Configuration
DEFAULT_AI_PROVIDER=claude       # claude, openai, or ollama
MODEL_PRIMARY=claude-3-5-sonnet-20240620
OLLAMA_BASE_URL=http://localhost:11434

# Server
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### HTTPS Setup

**Using Nginx (Recommended):**

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Using Let's Encrypt:**

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificates saved to:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Production Checklist

- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Configure HTTPS/SSL
- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS_ORIGIN to your domain
- [ ] Set up regular database backups
- [ ] Configure rate limiting
- [ ] Enable monitoring/logging
- [ ] Set resource limits (CPU/memory)
- [ ] Test offline functionality
- [ ] Verify PWA installation works

### Monitoring

**Health Check:**

```bash
curl http://localhost:8080/health
```

**Logs:**

```bash
# Docker Compose
docker compose logs -f backend
docker compose logs -f frontend

# Kubernetes
kubectl logs -f deployment/vibrater-backend -n vibrater
```

### Scaling

**SQLite:**
- Single backend replica only
- Suitable for <100 users
- Vertical scaling (increase resources)

**PostgreSQL:**
- Multiple backend replicas supported
- Suitable for 100+ users
- Horizontal scaling (add replicas)

```yaml
# Scale backend replicas
kubectl scale deployment vibrater-backend --replicas=3 -n vibrater
```

---

## API Reference

See [GUIDE.md](GUIDE.md) for complete API documentation including:

- Authentication endpoints
- Ideas CRUD operations
- Projects and tasks management
- AI chat and refinement
- Voice transcription

---

## Additional Resources

- [Getting Started Guide](GUIDE.md)
- [Kubernetes Documentation](k8s/README.md)
- [PWA Setup Details](vibrater/PWA_SETUP.md)
- [Project Status & Roadmap](PROJECT_STATUS.md)
