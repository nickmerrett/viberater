# OpenShift Deployment Guide

This guide covers deploying Vibrater on OpenShift with the security constraints required for non-root containers.

## Key Differences from Standard Kubernetes

OpenShift enforces stricter security policies:
- **Non-root containers**: Containers run with arbitrary UIDs (but group 0)
- **No privileged ports**: Cannot use ports < 1024 (e.g., port 80)
- **Read-only root filesystem**: Use `/tmp` for temporary files
- **Security Context Constraints (SCC)**: Must comply with `restricted` SCC

## Prerequisites

1. **OpenShift CLI** installed (`oc` command)
2. **Container registry access** (ghcr.io, quay.io, or OpenShift internal registry)
3. **API keys** for Claude/OpenAI

## Quick Start

### 1. Build OpenShift-Compatible Images

```bash
# Backend
cd vibrater-backend
docker build -f Dockerfile.openshift -t vibrater-backend:openshift .
docker tag vibrater-backend:openshift <your-registry>/vibrater-backend:openshift
docker push <your-registry>/vibrater-backend:openshift

# Frontend
cd ../vibrater
docker build -f Dockerfile.openshift -t vibrater-frontend:openshift .
docker tag vibrater-frontend:openshift <your-registry>/vibrater-frontend:openshift
docker push <your-registry>/vibrater-frontend:openshift
```

**Using OpenShift internal registry:**
```bash
# Login to OpenShift
oc login

# Get registry URL
REGISTRY=$(oc get route default-route -n openshift-image-registry -o jsonpath='{.spec.host}')

# Login to registry
docker login -u $(oc whoami) -p $(oc whoami -t) $REGISTRY

# Build and push
docker build -f Dockerfile.openshift -t $REGISTRY/vibrater/vibrater-backend:latest .
docker push $REGISTRY/vibrater/vibrater-backend:latest

docker build -f Dockerfile.openshift -t $REGISTRY/vibrater/vibrater-frontend:latest .
docker push $REGISTRY/vibrater/vibrater-frontend:latest
```

### 2. Create Namespace

```bash
oc apply -f k8s/namespace.yaml
oc project vibrater
```

### 3. Configure Secrets and ConfigMaps

Create your secrets file:
```bash
cp k8s/secret.yaml.example k8s/secret.yaml
```

Edit `k8s/secret.yaml` and add your base64-encoded values:
```bash
# Encode your secrets
echo -n "your-jwt-secret-min-32-characters" | base64
echo -n "sk-ant-your-claude-key" | base64
echo -n "sk-your-openai-key" | base64
```

Apply configuration:
```bash
oc apply -f k8s/secret.yaml
oc apply -f k8s/configmap.yaml
```

### 4. Deploy Backend

```bash
oc apply -f k8s/backend-deployment-openshift.yaml
```

**Check status:**
```bash
oc get pods -n vibrater
oc logs -f deployment/vibrater-backend -n vibrater
```

### 5. Deploy Frontend

```bash
oc apply -f k8s/frontend-deployment-openshift.yaml
```

### 6. Create Routes

**Backend Route:**
```bash
oc expose service vibrater-backend-service --name=vibrater-backend
```

**Frontend Route:**
```bash
oc expose service vibrater-frontend-service --name=vibrater-frontend
```

**Get URLs:**
```bash
oc get routes
```

You should see:
```
NAME                 HOST/PORT                                    PATH   SERVICES                      PORT   TERMINATION   WILDCARD
vibrater-backend     vibrater-backend-vibrater.apps.example.com          vibrater-backend-service      http                 None
vibrater-frontend    vibrater-frontend-vibrater.apps.example.com         vibrater-frontend-service     http                 None
```

### 7. Enable HTTPS (Optional but Recommended)

**Secure routes with edge termination:**
```bash
oc create route edge vibrater-backend-secure \
  --service=vibrater-backend-service \
  --port=http

oc create route edge vibrater-frontend-secure \
  --service=vibrater-frontend-service \
  --port=http
```

**Or apply the route YAML:**
```bash
oc apply -f k8s/routes.yaml
```

### 8. Update CORS Configuration

Update the ConfigMap with your frontend route URL:
```bash
oc edit configmap vibrater-config -n vibrater
```

Change `CORS_ORIGIN` to your frontend route:
```yaml
data:
  CORS_ORIGIN: https://vibrater-frontend-vibrater.apps.example.com
```

Restart backend to pick up changes:
```bash
oc rollout restart deployment/vibrater-backend -n vibrater
```

## Configuration Files

**OpenShift-specific files:**
- `vibrater-backend/Dockerfile.openshift` - Non-root backend image
- `vibrater/Dockerfile.openshift` - Non-root frontend image with nginx on port 8080
- `vibrater/nginx-openshift.conf` - Nginx config with temp paths in /tmp
- `k8s/backend-deployment-openshift.yaml` - Backend deployment with security contexts
- `k8s/frontend-deployment-openshift.yaml` - Frontend deployment with security contexts
- `k8s/routes.yaml` - OpenShift Route definitions

## Image Updates

Update images in the deployment files:

**Backend deployment:**
```yaml
spec:
  template:
    spec:
      containers:
      - name: backend
        image: <your-registry>/vibrater-backend:openshift
```

**Frontend deployment:**
```yaml
spec:
  template:
    spec:
      containers:
      - name: frontend
        image: <your-registry>/vibrater-frontend:openshift
```

## Common Commands

```bash
# View all resources
oc get all -n vibrater

# View logs
oc logs -f deployment/vibrater-backend -n vibrater
oc logs -f deployment/vibrater-frontend -n vibrater

# Restart deployments
oc rollout restart deployment/vibrater-backend -n vibrater
oc rollout restart deployment/vibrater-frontend -n vibrater

# Port forwarding (for testing)
oc port-forward svc/vibrater-backend-service 3000:80 -n vibrater
oc port-forward svc/vibrater-frontend-service 8080:8080 -n vibrater

# Scale backend (only 1 replica for SQLite!)
oc scale deployment/vibrater-backend --replicas=1 -n vibrater

# Scale frontend
oc scale deployment/vibrater-frontend --replicas=2 -n vibrater

# Delete everything
oc delete project vibrater
```

## Troubleshooting

### Permission Denied Errors

**Error:** `mkdir() "/var/cache/nginx/client_temp" failed (13: Permission denied)`

**Fix:** Use the OpenShift Dockerfile and nginx config:
- Dockerfile uses temp paths in `/tmp`
- nginx-openshift.conf sets all temp paths to `/tmp`

### Database Issues

**SQLite locked errors:**
- Ensure only 1 backend replica (`replicas: 1`)
- Use `strategy: Recreate` to prevent multiple pods

**Database not persisting:**
- Check PVC is bound: `oc get pvc -n vibrater`
- Verify volume mount: `oc describe pod <pod-name> -n vibrater`

### Image Pull Errors

**Error:** `ImagePullBackOff`

**Fix:**
```bash
# Check image name is correct
oc describe pod <pod-name> -n vibrater

# For internal registry, create pull secret
oc create secret docker-registry regcred \
  --docker-server=$REGISTRY \
  --docker-username=$(oc whoami) \
  --docker-password=$(oc whoami -t)

# Link secret to service account
oc secrets link default regcred --for=pull
```

### Routes Not Working

**Check route:**
```bash
oc get route vibrater-frontend -n vibrater -o yaml
```

**Test route:**
```bash
curl -I https://vibrater-frontend-vibrater.apps.example.com
```

**Check service:**
```bash
oc get svc -n vibrater
oc describe svc vibrater-frontend-service -n vibrater
```

### CORS Errors

Update CORS_ORIGIN in ConfigMap to match your route:
```bash
oc edit configmap vibrater-config -n vibrater
```

Set to your frontend route URL:
```yaml
CORS_ORIGIN: https://vibrater-frontend-vibrater.apps.example.com
```

Restart backend:
```bash
oc rollout restart deployment/vibrater-backend -n vibrater
```

## Security Considerations

**Secrets:**
- Never commit `secret.yaml` with real values
- Use OpenShift secrets for sensitive data
- Rotate JWT_SECRET regularly

**Routes:**
- Always use HTTPS in production (edge termination)
- Consider using custom TLS certificates

**Resources:**
- Set appropriate resource limits
- Monitor resource usage: `oc adm top pods -n vibrater`

## Scaling

**SQLite mode:**
- Backend: 1 replica only (SQLite single writer)
- Frontend: Scale as needed (2-4 replicas)

**PostgreSQL mode:**
- Use `k8s/backend-deployment.yaml` (without -openshift suffix)
- Backend: Scale as needed (2-4 replicas)
- Frontend: Scale as needed (2-4 replicas)
- Deploy PostgreSQL separately or use managed service

## Monitoring

**Health checks:**
```bash
# Backend health
curl http://vibrater-backend-vibrater.apps.example.com/health

# Frontend health
curl http://vibrater-frontend-vibrater.apps.example.com/
```

**View events:**
```bash
oc get events -n vibrater --sort-by='.lastTimestamp'
```

**Resource usage:**
```bash
oc adm top pods -n vibrater
oc adm top nodes
```

## Production Checklist

- [ ] Built images with OpenShift Dockerfiles
- [ ] Pushed images to accessible registry
- [ ] Created namespace and project
- [ ] Configured secrets with strong JWT_SECRET
- [ ] Applied ConfigMap with correct CORS_ORIGIN
- [ ] Deployed backend with SQLite volume
- [ ] Deployed frontend
- [ ] Created HTTPS routes (edge termination)
- [ ] Tested application functionality
- [ ] Configured resource limits
- [ ] Set up monitoring/alerting
- [ ] Documented custom configuration
- [ ] Tested backup/restore procedures

## Additional Resources

- [OpenShift Documentation](https://docs.openshift.com/)
- [Vibrater Documentation](../DOCS.md)
- [Vibrater User Guide](../GUIDE.md)
