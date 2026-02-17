# OpenShift Deployment Guide

This guide covers deploying viberater on OpenShift with the security constraints required for non-root containers.

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
cd viberater-backend
docker build -f Dockerfile.openshift -t viberater-backend:openshift .
docker tag viberater-backend:openshift <your-registry>/viberater-backend:openshift
docker push <your-registry>/viberater-backend:openshift

# Frontend
cd ../viberater
docker build -f Dockerfile.openshift -t viberater-frontend:openshift .
docker tag viberater-frontend:openshift <your-registry>/viberater-frontend:openshift
docker push <your-registry>/viberater-frontend:openshift
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
docker build -f Dockerfile.openshift -t $REGISTRY/viberater/viberater-backend:latest .
docker push $REGISTRY/viberater/viberater-backend:latest

docker build -f Dockerfile.openshift -t $REGISTRY/viberater/viberater-frontend:latest .
docker push $REGISTRY/viberater/viberater-frontend:latest
```

### 2. Create Namespace

```bash
oc apply -f k8s/namespace.yaml
oc project viberater
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
oc get pods -n viberater
oc logs -f deployment/viberater-backend -n viberater
```

### 5. Deploy Frontend

```bash
oc apply -f k8s/frontend-deployment-openshift.yaml
```

### 6. Create Routes

**Backend Route:**
```bash
oc expose service viberater-backend-service --name=viberater-backend
```

**Frontend Route:**
```bash
oc expose service viberater-frontend-service --name=viberater-frontend
```

**Get URLs:**
```bash
oc get routes
```

You should see:
```
NAME                 HOST/PORT                                    PATH   SERVICES                      PORT   TERMINATION   WILDCARD
viberater-backend     viberater-backend-viberater.apps.example.com          viberater-backend-service      http                 None
viberater-frontend    viberater-frontend-viberater.apps.example.com         viberater-frontend-service     http                 None
```

### 7. Enable HTTPS (Optional but Recommended)

**Secure routes with edge termination:**
```bash
oc create route edge viberater-backend-secure \
  --service=viberater-backend-service \
  --port=http

oc create route edge viberater-frontend-secure \
  --service=viberater-frontend-service \
  --port=http
```

**Or apply the route YAML:**
```bash
oc apply -f k8s/routes.yaml
```

### 8. Update CORS Configuration

Update the ConfigMap with your frontend route URL:
```bash
oc edit configmap viberater-config -n viberater
```

Change `CORS_ORIGIN` to your frontend route:
```yaml
data:
  CORS_ORIGIN: https://viberater-frontend-viberater.apps.example.com
```

Restart backend to pick up changes:
```bash
oc rollout restart deployment/viberater-backend -n viberater
```

## Configuration Files

**OpenShift-specific files:**
- `viberater-backend/Dockerfile.openshift` - Non-root backend image
- `viberater/Dockerfile.openshift` - Non-root frontend image with nginx on port 8080
- `viberater/nginx-openshift.conf` - Nginx config with temp paths in /tmp
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
        image: <your-registry>/viberater-backend:openshift
```

**Frontend deployment:**
```yaml
spec:
  template:
    spec:
      containers:
      - name: frontend
        image: <your-registry>/viberater-frontend:openshift
```

## Common Commands

```bash
# View all resources
oc get all -n viberater

# View logs
oc logs -f deployment/viberater-backend -n viberater
oc logs -f deployment/viberater-frontend -n viberater

# Restart deployments
oc rollout restart deployment/viberater-backend -n viberater
oc rollout restart deployment/viberater-frontend -n viberater

# Port forwarding (for testing)
oc port-forward svc/viberater-backend-service 3000:80 -n viberater
oc port-forward svc/viberater-frontend-service 8080:8080 -n viberater

# Scale backend (only 1 replica for SQLite!)
oc scale deployment/viberater-backend --replicas=1 -n viberater

# Scale frontend
oc scale deployment/viberater-frontend --replicas=2 -n viberater

# Delete everything
oc delete project viberater
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
- Check PVC is bound: `oc get pvc -n viberater`
- Verify volume mount: `oc describe pod <pod-name> -n viberater`

### Image Pull Errors

**Error:** `ImagePullBackOff`

**Fix:**
```bash
# Check image name is correct
oc describe pod <pod-name> -n viberater

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
oc get route viberater-frontend -n viberater -o yaml
```

**Test route:**
```bash
curl -I https://viberater-frontend-viberater.apps.example.com
```

**Check service:**
```bash
oc get svc -n viberater
oc describe svc viberater-frontend-service -n viberater
```

### CORS Errors

Update CORS_ORIGIN in ConfigMap to match your route:
```bash
oc edit configmap viberater-config -n viberater
```

Set to your frontend route URL:
```yaml
CORS_ORIGIN: https://viberater-frontend-viberater.apps.example.com
```

Restart backend:
```bash
oc rollout restart deployment/viberater-backend -n viberater
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
- Monitor resource usage: `oc adm top pods -n viberater`

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
curl http://viberater-backend-viberater.apps.example.com/health

# Frontend health
curl http://viberater-frontend-viberater.apps.example.com/
```

**View events:**
```bash
oc get events -n viberater --sort-by='.lastTimestamp'
```

**Resource usage:**
```bash
oc adm top pods -n viberater
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
- [viberater Documentation](../DOCS.md)
- [viberater User Guide](../GUIDE.md)
