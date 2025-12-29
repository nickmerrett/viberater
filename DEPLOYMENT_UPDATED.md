# Deployment Configuration - Updated! ✅

**Date:** 2025-12-24
**Status:** Complete

---

## What Was Updated

All Docker and Kubernetes deployment configurations have been updated to include the frontend!

### Files Created/Updated

**Docker Compose:**
1. ✅ `docker-compose.yml` - Added frontend + nginx gateway services
2. ✅ `nginx-gateway.conf` - Routes /api to backend, / to frontend
3. ✅ `vibrater/Dockerfile` - Frontend nginx container
4. ✅ `vibrater/nginx.conf` - Frontend nginx config

**Kubernetes:**
1. ✅ `k8s/frontend-deployment.yaml` - Frontend deployment + service
2. ✅ `k8s/ingress.yaml` - Updated to route frontend requests
3. ✅ `k8s/kustomization.yaml` - Added frontend-deployment.yaml

**Documentation:**
1. ✅ `DEPLOYMENT.md` - Complete deployment guide (Docker + K8s)
2. ✅ `GETTING_STARTED.md` - Updated with new instructions

---

## Docker Compose Setup

### New Architecture

```
Port 8080 (External)
       │
       ▼
   Nginx Gateway
       │
   ┌───┴───┐
   │       │
   ▼       ▼
Backend  Frontend
   │
   ▼
PostgreSQL
```

### Services

1. **postgres** - Database (port 5432)
2. **backend** - API server (internal port 3000)
3. **frontend** - Web app (internal port 80)
4. **nginx** - Gateway (port 8080)

### Usage

```bash
# Start everything
docker-compose up -d

# Run migrations
docker-compose exec backend npm run migrate

# Access the app
open http://localhost:8080

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```

### What Changed

**Before:**
- Only backend exposed on port 3000
- Frontend served separately (python -m http.server)
- Manual CORS configuration

**After:**
- Complete stack on port 8080
- Nginx routes requests to appropriate service
- Frontend containerized
- Production-ready setup

---

## Kubernetes Setup

### New Resources

**Frontend Deployment:**
- 2-5 replicas (auto-scaling)
- Nginx serving static files
- Health checks configured
- 64-128Mi memory, 100-200m CPU

**Updated Ingress:**
- Routes `/api` → Backend
- Routes `/health` → Backend
- Routes `/` → Frontend
- SSL/TLS ready

### Usage

```bash
# Build images
docker build -t your-registry/vibrater-backend:latest ./vibrater-backend
docker build -t your-registry/vibrater-frontend:latest ./vibrater

# Push to registry
docker push your-registry/vibrater-backend:latest
docker push your-registry/vibrater-frontend:latest

# Update image references in k8s/*.yaml files

# Deploy
kubectl apply -k k8s/

# Check status
kubectl get pods -n vibrater
kubectl get svc -n vibrater
kubectl get ingress -n vibrater
```

### What Changed

**Before:**
- Only backend + database deployed
- Frontend not included
- Ingress commented out for frontend

**After:**
- Complete stack deployed
- Frontend deployment with auto-scaling
- Ingress configured for frontend
- Production-ready

---

## Quick Start Commands

### Docker Compose (Local Development)

```bash
# First time setup
docker-compose up -d
docker-compose exec backend npm run migrate

# Daily use
docker-compose up -d     # Start
docker-compose down      # Stop
docker-compose logs -f   # View logs

# Access
open http://localhost:8080
```

### Kubernetes (Production)

```bash
# Build and push (when code changes)
cd vibrater-backend
docker build -t registry/vibrater-backend:v1.0.0 .
docker push registry/vibrater-backend:v1.0.0

cd ../vibrater
docker build -t registry/vibrater-frontend:v1.0.0 .
docker push registry/vibrater-frontend:v1.0.0

# Deploy
kubectl apply -k k8s/

# Check
kubectl get all -n vibrater

# Access
curl https://vibrater.yourdomain.com
```

---

## File Summary

### Docker Files

| File | Purpose |
|------|---------|
| docker-compose.yml | Multi-service orchestration |
| nginx-gateway.conf | Request routing |
| vibrater/Dockerfile | Frontend container |
| vibrater/nginx.conf | Frontend web server |
| vibrater-backend/Dockerfile | Backend container |

### Kubernetes Files

| File | Purpose |
|------|---------|
| k8s/frontend-deployment.yaml | Frontend pods + service |
| k8s/backend-deployment.yaml | Backend pods + service |
| k8s/postgres-deployment.yaml | Database pod + service |
| k8s/ingress.yaml | HTTP routing + SSL |
| k8s/configmap.yaml | Configuration |
| k8s/secret.yaml.example | Secrets template |
| k8s/kustomization.yaml | Kustomize config |

---

## Testing Your Deployment

### Docker Compose

```bash
# 1. Health check
curl http://localhost:8080/health

# 2. Frontend
open http://localhost:8080

# 3. Backend API
curl http://localhost:8080/api/auth/me

# 4. Check all services
docker-compose ps

# Expected output:
# vibrater_postgres   Up (healthy)
# vibrater_backend    Up
# vibrater_frontend   Up
# vibrater_nginx      Up
```

### Kubernetes

```bash
# 1. Check pods are running
kubectl get pods -n vibrater

# Expected: All pods in Running state

# 2. Check services
kubectl get svc -n vibrater

# 3. Check ingress
kubectl get ingress -n vibrater

# 4. Test endpoints
curl https://vibrater.yourdomain.com/health
curl https://vibrater.yourdomain.com/
```

---

## Port Changes

| Service | Old Port | New Port | Access |
|---------|----------|----------|--------|
| Frontend (dev) | 8000 (python) | 8080 (docker) | http://localhost:8080 |
| Backend API | 3000 (direct) | 8080/api (via nginx) | http://localhost:8080/api |
| Database | 5432 | 5432 (unchanged) | Internal only |

---

## Environment Variables

### Important Settings

**CORS_ORIGIN:**
- Docker Compose: `http://localhost:8080`
- Kubernetes: `https://vibrater.yourdomain.com`

**API URL (Frontend):**
- Configured in `vibrater/js/config.js`
- Auto-detects based on hostname
- Override if needed

---

## Migration from Previous Setup

### If you were using:

**Python http.server on port 8000:**
```bash
# Stop it
# Ctrl+C in terminal, or:
pkill -f "python.*http.server"

# Use Docker Compose instead
docker-compose up -d
```

**Backend on port 3000:**
```bash
# Stop it
docker-compose down

# Start complete stack
docker-compose up -d
```

**Update frontend config:**
```javascript
// vibrater/js/config.js
apiUrl: 'http://localhost:8080/api'  // Changed from :3000/api
```

---

## Troubleshooting

### "Connection refused" errors

**Check all services are running:**
```bash
docker-compose ps
# All should show "Up"
```

**Check nginx gateway:**
```bash
docker-compose logs nginx
```

### "CORS error" in browser

**Check CORS_ORIGIN:**
```bash
docker-compose exec backend env | grep CORS
# Should match where you're accessing from
```

**Update .env:**
```bash
CORS_ORIGIN=http://localhost:8080
docker-compose restart backend
```

### Frontend shows blank page

**Check frontend container:**
```bash
docker-compose logs frontend
```

**Check nginx is routing:**
```bash
curl -I http://localhost:8080/
# Should return 200 OK with content-type: text/html
```

### Database connection failed

**Check PostgreSQL:**
```bash
docker-compose logs postgres
docker-compose exec postgres pg_isready -U vibrater
```

**Run migrations:**
```bash
docker-compose exec backend npm run migrate
```

---

## Next Steps

1. **Test locally with Docker Compose**
   ```bash
   docker-compose up -d
   open http://localhost:8080
   ```

2. **Build for production**
   ```bash
   # Build images
   docker build -t registry/vibrater-backend:v1 ./vibrater-backend
   docker build -t registry/vibrater-frontend:v1 ./vibrater
   ```

3. **Deploy to Kubernetes**
   ```bash
   kubectl apply -k k8s/
   ```

4. **Monitor and optimize**
   - Set up monitoring
   - Configure alerts
   - Tune auto-scaling
   - Add backups

---

## Documentation

**Comprehensive Guides:**
- `DEPLOYMENT.md` - Complete deployment guide (Docker + K8s)
- `GETTING_STARTED.md` - Quick start guide
- `k8s/README.md` - Kubernetes details
- `vibrater-backend/README.md` - Backend API docs
- `vibrater/README-V2.md` - Frontend docs

**Quick Reference:**
- `QUICK_REFERENCE.md` - Common commands

---

## Summary

✅ **Docker Compose** - Complete stack ready to run
✅ **Kubernetes** - Production deployment configured
✅ **Nginx Gateway** - Request routing configured
✅ **Frontend** - Containerized and ready
✅ **Documentation** - Comprehensive guides created

**Everything is ready to deploy!** 🚀

Try it now:
```bash
docker-compose up -d
open http://localhost:8080
```
