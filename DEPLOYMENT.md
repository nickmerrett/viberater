# Vibrater Deployment Guide

Complete guide for deploying Vibrater (Frontend + Backend + Database) using Docker Compose or Kubernetes.

---

## Table of Contents

1. [Docker Compose (Local Development)](#docker-compose-local-development)
2. [Kubernetes (Production)](#kubernetes-production)
3. [Building Container Images](#building-container-images)
4. [Environment Configuration](#environment-configuration)
5. [Troubleshooting](#troubleshooting)

---

## Docker Compose (Local Development)

### Quick Start

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your settings

# 2. Start all services
docker-compose up -d

# 3. Run database migrations
docker-compose exec backend npm run migrate

# 4. Check everything is running
docker-compose ps

# 5. Access the app
open http://localhost:8080
```

### What Gets Deployed

The Docker Compose setup includes 4 services:

1. **PostgreSQL** - Database (port 5432)
2. **Backend** - API server (internal port 3000)
3. **Frontend** - Static web app (internal port 80)
4. **Nginx** - Gateway/reverse proxy (port 8080)

### Architecture

```
┌────────────────────────────────────┐
│  http://localhost:8080             │
└─────────────┬──────────────────────┘
              │
     ┌────────▼─────────┐
     │  Nginx Gateway   │
     │  (Port 8080)     │
     └────┬─────────┬───┘
          │         │
     /api │         │ /
          │         │
  ┌───────▼──┐  ┌──▼────────┐
  │ Backend  │  │ Frontend  │
  │ (Node.js)│  │ (Nginx)   │
  └─────┬────┘  └───────────┘
        │
  ┌─────▼──────┐
  │ PostgreSQL │
  └────────────┘
```

### Services Details

**PostgreSQL:**
- Image: `postgres:15-alpine`
- Port: `5432:5432`
- Volume: `postgres_data` (persists data)
- Healthcheck: Built-in

**Backend:**
- Build: `./vibrater-backend/Dockerfile`
- Port: Exposed internally only
- Volumes: Source code (hot reload), storage, logs
- Command: `npm run dev` (development mode)

**Frontend:**
- Build: `./vibrater/Dockerfile`
- Port: Exposed internally only
- Serves: Static files via nginx

**Nginx Gateway:**
- Image: `nginx:alpine`
- Port: `8080:80` (external:internal)
- Routes:
  - `/api` → Backend
  - `/health` → Backend
  - `/` → Frontend

### Common Commands

```bash
# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart a service
docker-compose restart backend

# Rebuild and restart
docker-compose build backend
docker-compose up -d backend

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Execute command in container
docker-compose exec backend npm run migrate
docker-compose exec postgres psql -U vibrater -d vibrater
```

### Development Workflow

**Backend Changes:**
- Edit files in `vibrater-backend/src/`
- Hot reload is enabled (nodemon)
- No restart needed

**Frontend Changes:**
- Edit files in `vibrater/`
- Rebuild container:
  ```bash
  docker-compose build frontend
  docker-compose up -d frontend
  ```

**Database Migrations:**
```bash
# Create new migration
# Edit vibrater-backend/migrations/00X_name.sql

# Run migrations
docker-compose exec backend npm run migrate
```

### Accessing Services

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:8080/api
- **Health Check**: http://localhost:8080/health
- **PostgreSQL**: `localhost:5432` (if needed)

---

## Kubernetes (Production)

### Prerequisites

- Kubernetes cluster (1.20+)
- `kubectl` configured
- Container registry (Docker Hub, GitHub Container Registry, etc.)
- Ingress controller (nginx recommended)
- cert-manager (optional, for SSL)

### Quick Start

```bash
# 1. Build and push container images
cd vibrater-backend
docker build -t your-registry/vibrater-backend:v1.0.0 .
docker push your-registry/vibrater-backend:v1.0.0

cd ../vibrater
docker build -t your-registry/vibrater-frontend:v1.0.0 .
docker push your-registry/vibrater-frontend:v1.0.0

# 2. Update image references in k8s manifests
# Edit k8s/backend-deployment.yaml
# Edit k8s/frontend-deployment.yaml

# 3. Create namespace and secrets
kubectl create namespace vibrater

kubectl create secret generic vibrater-secrets \
  --namespace=vibrater \
  --from-literal=DATABASE_PASSWORD='your-strong-password' \
  --from-literal=JWT_SECRET='your-long-random-secret-min-32-chars' \
  --from-literal=CLAUDE_API_KEY='sk-ant-your-key' \
  --from-literal=OPENAI_API_KEY='sk-your-key'

# 4. Deploy everything
kubectl apply -k k8s/

# 5. Check deployment
kubectl get pods -n vibrater
kubectl get svc -n vibrater
kubectl get ingress -n vibrater
```

### What Gets Deployed

**Deployments:**
1. PostgreSQL (1 replica, StatefulSet-like)
2. Backend (2-10 replicas, auto-scaling)
3. Frontend (2-5 replicas, auto-scaling)

**Services:**
- `postgres-service` (ClusterIP) - Database
- `vibrater-backend-service` (ClusterIP) - API
- `vibrater-frontend-service` (ClusterIP) - Web app

**Ingress:**
- Routes `/api` → Backend
- Routes `/health` → Backend
- Routes `/` → Frontend
- SSL/TLS termination (if cert-manager configured)

**Persistent Volumes:**
- PostgreSQL data (10Gi)
- Backend storage (5Gi)

**Auto-scaling:**
- Backend: 2-10 pods (CPU 70%, Memory 80%)
- Frontend: 2-5 pods (CPU 70%)

### Architecture

```
                     ┌──────────────┐
                     │   Internet   │
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │   Ingress    │
                     │  (SSL + LB)  │
                     └──┬────────┬──┘
                        │        │
            /api        │        │  /
                        │        │
              ┌─────────▼──┐  ┌──▼──────────┐
              │  Backend   │  │  Frontend   │
              │  Service   │  │  Service    │
              │  (2-10     │  │  (2-5       │
              │   pods)    │  │   pods)     │
              └─────┬──────┘  └─────────────┘
                    │
              ┌─────▼──────┐
              │ PostgreSQL │
              │  Service   │
              │  (1 pod)   │
              └────────────┘
```

### Kubernetes Resources

**Namespace:**
```yaml
# k8s/namespace.yaml
namespace: vibrater
```

**ConfigMap:**
```yaml
# k8s/configmap.yaml
- DATABASE_HOST: postgres-service
- CORS_ORIGIN: https://vibrater.yourdomain.com
- etc.
```

**Secrets:**
```yaml
# Create via kubectl (not in git!)
- DATABASE_PASSWORD
- JWT_SECRET
- CLAUDE_API_KEY
- OPENAI_API_KEY
```

**Deployments:**
- `k8s/postgres-deployment.yaml` - Database
- `k8s/backend-deployment.yaml` - API server
- `k8s/frontend-deployment.yaml` - Web app

**Ingress:**
- `k8s/ingress.yaml` - Routes and SSL

### Common Commands

```bash
# View all resources
kubectl get all -n vibrater

# View pods
kubectl get pods -n vibrater

# View logs
kubectl logs -n vibrater -l app=vibrater-backend -f
kubectl logs -n vibrater -l app=vibrater-frontend -f

# Describe a resource
kubectl describe pod -n vibrater <pod-name>

# Execute command in pod
kubectl exec -it -n vibrater <backend-pod> -- sh

# Port forward for debugging
kubectl port-forward -n vibrater svc/vibrater-backend-service 3000:80
kubectl port-forward -n vibrater svc/vibrater-frontend-service 8080:80

# Scale manually
kubectl scale deployment vibrater-backend -n vibrater --replicas=5

# Restart deployment
kubectl rollout restart deployment/vibrater-backend -n vibrater
kubectl rollout restart deployment/vibrater-frontend -n vibrater

# View resource usage
kubectl top pods -n vibrater
kubectl top nodes

# Delete everything
kubectl delete -k k8s/
```

### Updating Deployments

**Update Backend:**
```bash
# 1. Build new image
cd vibrater-backend
docker build -t your-registry/vibrater-backend:v1.0.1 .
docker push your-registry/vibrater-backend:v1.0.1

# 2. Update deployment
kubectl set image deployment/vibrater-backend \
  backend=your-registry/vibrater-backend:v1.0.1 \
  -n vibrater

# Or edit the YAML and apply
kubectl apply -f k8s/backend-deployment.yaml
```

**Update Frontend:**
```bash
# 1. Build new image
cd vibrater
docker build -t your-registry/vibrater-frontend:v1.0.1 .
docker push your-registry/vibrater-frontend:v1.0.1

# 2. Update deployment
kubectl set image deployment/vibrater-frontend \
  frontend=your-registry/vibrater-frontend:v1.0.1 \
  -n vibrater
```

### Setting Up SSL

**With cert-manager:**

```bash
# 1. Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# 2. Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# 3. Ingress is already configured to use cert-manager
# Just update the domain in k8s/ingress.yaml
```

---

## Building Container Images

### Backend Image

```bash
cd vibrater-backend

# Build
docker build -t vibrater-backend:latest .

# Tag for registry
docker tag vibrater-backend:latest your-registry/vibrater-backend:v1.0.0
docker tag vibrater-backend:latest your-registry/vibrater-backend:latest

# Push
docker push your-registry/vibrater-backend:v1.0.0
docker push your-registry/vibrater-backend:latest
```

**Using the build script:**
```bash
cd vibrater-backend
./build-and-push.sh your-registry/vibrater-backend v1.0.0
```

### Frontend Image

```bash
cd vibrater

# Build
docker build -t vibrater-frontend:latest .

# Tag for registry
docker tag vibrater-frontend:latest your-registry/vibrater-frontend:v1.0.0
docker tag vibrater-frontend:latest your-registry/vibrater-frontend:latest

# Push
docker push your-registry/vibrater-frontend:v1.0.0
docker push your-registry/vibrater-frontend:latest
```

### Using GitHub Container Registry

```bash
# Login
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Build and tag
docker build -t ghcr.io/username/vibrater-backend:latest ./vibrater-backend
docker build -t ghcr.io/username/vibrater-frontend:latest ./vibrater

# Push
docker push ghcr.io/username/vibrater-backend:latest
docker push ghcr.io/username/vibrater-frontend:latest
```

---

## Environment Configuration

### Docker Compose (.env file)

```bash
# Database
DB_PASSWORD=vibrater_dev_password

# Backend
NODE_ENV=development
JWT_SECRET=dev-secret-key-change-in-production-min-32-chars

# AI Providers (optional for Phase 1)
CLAUDE_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_AI_PROVIDER=claude

# CORS (important!)
CORS_ORIGIN=http://localhost:8080
```

### Kubernetes (ConfigMap + Secrets)

**ConfigMap (k8s/configmap.yaml):**
- Non-sensitive configuration
- Database host/port
- CORS origin
- Rate limits
- etc.

**Secrets (kubectl create secret):**
- Database password
- JWT secret
- API keys

**Update ConfigMap:**
Edit `k8s/configmap.yaml` and:
```bash
kubectl apply -f k8s/configmap.yaml
```

**Update Secrets:**
```bash
kubectl create secret generic vibrater-secrets \
  --namespace=vibrater \
  --from-literal=DATABASE_PASSWORD='new-password' \
  --from-literal=JWT_SECRET='new-secret' \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Frontend API URL

The frontend auto-detects the API URL based on environment:

**In `vibrater/js/config.js`:**
```javascript
apiUrl: window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'  // Direct backend (dev)
  : 'https://vibrater.yourdomain.com/api'  // Via ingress (prod)
```

**For Docker Compose:**
- Uses `http://localhost:8080/api` (via nginx gateway)

**For Kubernetes:**
- Uses `https://vibrater.yourdomain.com/api` (via ingress)

To change:
1. Edit `vibrater/js/config.js`
2. Rebuild frontend image
3. Redeploy

---

## Troubleshooting

### Docker Compose Issues

**Port already in use:**
```bash
# Check what's using port 8080
sudo lsof -i :8080
sudo kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "9090:80"  # Use port 9090 instead
```

**Backend can't connect to database:**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check backend logs
docker-compose logs backend

# Verify DATABASE_URL
docker-compose exec backend env | grep DATABASE
```

**Frontend shows "Failed to fetch":**
```bash
# Check backend is running
curl http://localhost:8080/health

# Check CORS_ORIGIN matches
docker-compose exec backend env | grep CORS

# Check nginx gateway config
docker-compose exec nginx cat /etc/nginx/conf.d/default.conf
```

**Migrations failed:**
```bash
# Check database is ready
docker-compose exec postgres pg_isready -U vibrater

# Run migrations manually
docker-compose exec backend npm run migrate

# View migration files
ls vibrater-backend/migrations/
```

### Kubernetes Issues

**Pods not starting:**
```bash
# Describe pod to see events
kubectl describe pod -n vibrater <pod-name>

# Check logs
kubectl logs -n vibrater <pod-name>

# Common issues:
# - Image pull error (check image name/registry auth)
# - Crash loop (check logs for error)
# - Resource limits (increase resources)
```

**Database connection failed:**
```bash
# Check PostgreSQL pod
kubectl get pods -n vibrater -l app=postgres

# Check PostgreSQL logs
kubectl logs -n vibrater -l app=postgres

# Test connection from backend pod
kubectl exec -it -n vibrater <backend-pod> -- sh
apk add postgresql-client
psql -h postgres-service -U vibrater -d vibrater
```

**Ingress not working:**
```bash
# Check ingress
kubectl get ingress -n vibrater
kubectl describe ingress -n vibrater vibrater-ingress

# Check ingress controller
kubectl get pods -n ingress-nginx

# Check DNS
nslookup vibrater.yourdomain.com

# Check cert-manager (if using)
kubectl get certificate -n vibrater
kubectl describe certificate -n vibrater vibrater-tls
```

**Auto-scaling not working:**
```bash
# Check HPA
kubectl get hpa -n vibrater

# Describe HPA to see metrics
kubectl describe hpa -n vibrater vibrater-backend-hpa

# Check metrics-server is installed
kubectl get deployment metrics-server -n kube-system
```

### Performance Issues

**Slow frontend:**
- Check browser cache
- Check gzip is enabled in nginx
- Check image sizes (should be ~50KB total)

**Slow backend:**
- Check database query performance
- Check number of API requests
- Enable backend logging
- Check resource limits

**Database slow:**
- Check disk I/O
- Add indexes (see migration files)
- Increase resources
- Consider managed database (RDS, Cloud SQL)

---

## Production Checklist

Before deploying to production:

### Security
- [ ] Change all default passwords
- [ ] Use strong JWT secret (32+ random chars)
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS to specific domain
- [ ] Review and tighten security headers
- [ ] Enable rate limiting
- [ ] Use secrets management (not plaintext)

### Configuration
- [ ] Set NODE_ENV=production
- [ ] Update API URL in frontend config
- [ ] Configure database backups
- [ ] Set up monitoring/alerts
- [ ] Configure log aggregation
- [ ] Set resource limits appropriately

### Testing
- [ ] Test user registration
- [ ] Test login/logout
- [ ] Test idea creation and sync
- [ ] Test project creation
- [ ] Test offline mode
- [ ] Test multi-device sync
- [ ] Load test API endpoints

### Operations
- [ ] Document deployment process
- [ ] Set up CI/CD pipeline
- [ ] Configure database backups (daily)
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure alerts (uptime, errors)
- [ ] Plan rollback procedure

---

## Next Steps

After successful deployment:

1. **Monitor**: Set up monitoring and alerts
2. **Backup**: Configure automated database backups
3. **Scale**: Adjust auto-scaling based on usage
4. **Optimize**: Monitor performance and optimize
5. **Phase 2**: Add AI integration features

---

## Support

**Documentation:**
- Architecture: `ARCHITECTURE.md`
- Frontend: `vibrater/README-V2.md`
- Backend: `vibrater-backend/README.md`
- Kubernetes: `k8s/README.md`

**Quick Reference:**
- `QUICK_REFERENCE.md` - Common commands

**Getting Help:**
- Check logs first
- Review troubleshooting section
- Check GitHub issues
- Open new issue with logs/details

---

**Happy Deploying! 🚀**
