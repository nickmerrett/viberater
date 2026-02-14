# Vibrater Kubernetes Deployment

Deploy Vibrater to any Kubernetes cluster (local, cloud, or self-hosted).

## 🔴 OpenShift Users

**For OpenShift deployments, see [OPENSHIFT.md](OPENSHIFT.md)** for specific instructions on handling non-root containers, Routes, and security constraints.

## Database Options

Vibrater supports both **SQLite** and **PostgreSQL**. Choose based on your needs:

### SQLite (Recommended for Small/Medium Deployments)

**Use `backend-deployment-sqlite.yaml`**

- ✅ **Simpler setup** - No separate database pod needed
- ✅ **Lower resource usage** - Single backend pod with persistent storage
- ✅ **Easier backups** - Just backup the PVC
- ✅ **Perfect for** - Personal use, small teams (<50 users)
- ⚠️ **Single replica** - SQLite only supports one writer

```bash
kubectl apply -f backend-deployment-sqlite.yaml
```

### PostgreSQL (For Large/Production Deployments)

**Use `backend-deployment.yaml` + `postgres-deployment.yaml`**

- ✅ **Multiple replicas** - Scale backend horizontally
- ✅ **Better concurrency** - Handle more simultaneous writes
- ✅ **Production-grade** - Battle-tested at scale
- ⚠️ **More complex** - Requires PostgreSQL pod + additional resources
- ⚠️ **Higher costs** - More CPU/memory needed

```bash
kubectl apply -f postgres-deployment.yaml
kubectl apply -f postgres-pvc.yaml
kubectl apply -f backend-deployment.yaml
```

## Prerequisites

- **Kubernetes cluster** (1.20+)
  - Local: minikube, kind, k3s, microk8s
  - Cloud: EKS, GKE, AKS, DigitalOcean Kubernetes
  - Self-hosted: kubeadm, k3s, RKE2
- **kubectl** configured to access your cluster
- **Container registry** access (Docker Hub, GitHub Container Registry, etc.)
- **Ingress controller** (nginx recommended)
- **cert-manager** (optional, for automatic SSL)

## Quick Start

### 1. Build and Push Container Image

```bash
# From project root
cd vibrater-backend

# Build the image
docker build -t yourusername/vibrater-backend:latest .

# Push to registry
docker push yourusername/vibrater-backend:latest

# Or use GitHub Container Registry
docker tag yourusername/vibrater-backend:latest ghcr.io/yourusername/vibrater-backend:latest
docker push ghcr.io/yourusername/vibrater-backend:latest
```

### 2. Update Image Reference

Edit `k8s/backend-deployment.yaml` and replace:
```yaml
image: ghcr.io/yourusername/vibrater-backend:latest
```

With your actual image URL.

### 3. Create Secrets

```bash
# Create namespace first
kubectl create namespace vibrater

# Create secrets
kubectl create secret generic vibrater-secrets \
  --namespace=vibrater \
  --from-literal=DATABASE_PASSWORD='your-strong-password-here' \
  --from-literal=JWT_SECRET='your-long-random-secret-min-32-chars' \
  --from-literal=CLAUDE_API_KEY='sk-ant-your-key' \
  --from-literal=OPENAI_API_KEY='sk-your-key' \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 4. Update Configuration

Edit `k8s/configmap.yaml` to set your domain:

```yaml
CORS_ORIGIN: "https://vibrater.yourdomain.com"
```

Edit `k8s/ingress.yaml` to set your domain:

```yaml
host: vibrater.yourdomain.com
```

### 5. Deploy

```bash
# Apply all manifests
kubectl apply -k k8s/

# Or apply individually
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-pvc.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### 6. Check Deployment

```bash
# Watch pods starting
kubectl get pods -n vibrater -w

# Check logs
kubectl logs -n vibrater -l app=vibrater-backend -f

# Check PostgreSQL
kubectl logs -n vibrater -l app=postgres -f

# Get service status
kubectl get svc -n vibrater
```

### 7. Access the API

```bash
# Get ingress address
kubectl get ingress -n vibrater

# Test health endpoint
curl https://vibrater.yourdomain.com/health
```

## Local Development with Minikube

```bash
# Start minikube
minikube start

# Enable ingress addon
minikube addons enable ingress

# Build image directly in minikube
eval $(minikube docker-env)
cd vibrater-backend
docker build -t vibrater-backend:dev .

# Update backend-deployment.yaml to use local image:
# image: vibrater-backend:dev
# imagePullPolicy: Never

# Deploy
kubectl apply -k k8s/

# Get minikube IP
minikube ip

# Add to /etc/hosts
echo "$(minikube ip) vibrater.local" | sudo tee -a /etc/hosts

# Access
curl http://vibrater.local/health
```

## Local Development with Kind

```bash
# Create kind cluster
kind create cluster --name vibrater

# Load image into kind
cd vibrater-backend
docker build -t vibrater-backend:dev .
kind load docker-image vibrater-backend:dev --name vibrater

# Install nginx ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for ingress to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

# Deploy
kubectl apply -k k8s/

# Port forward (since kind doesn't have LoadBalancer)
kubectl port-forward -n vibrater svc/vibrater-backend-service 3000:80
```

## Cloud Deployments

### AWS EKS

```bash
# Create EKS cluster (using eksctl)
eksctl create cluster \
  --name vibrater \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 2

# Install nginx ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/aws/deploy.yaml

# Install cert-manager for SSL
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Deploy Vibrater
kubectl apply -k k8s/

# Get LoadBalancer address
kubectl get svc -n ingress-nginx

# Point your domain to the LoadBalancer DNS
```

### Google GKE

```bash
# Create GKE cluster
gcloud container clusters create vibrater \
  --zone us-central1-a \
  --num-nodes 2 \
  --machine-type n1-standard-2

# Get credentials
gcloud container clusters get-credentials vibrater --zone us-central1-a

# Install nginx ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Deploy Vibrater
kubectl apply -k k8s/
```

### DigitalOcean Kubernetes

```bash
# Create cluster via UI or doctl
doctl kubernetes cluster create vibrater \
  --region nyc1 \
  --size s-2vcpu-2gb \
  --count 2

# Install nginx ingress (comes pre-installed on DOKS)

# Deploy Vibrater
kubectl apply -k k8s/
```

## Production Considerations

### 1. Secrets Management

Don't commit secrets! Use one of:

**Sealed Secrets:**
```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Seal your secrets
kubeseal --format=yaml < secret.yaml > sealed-secret.yaml
```

**External Secrets Operator:**
```bash
# Integrates with AWS Secrets Manager, Azure Key Vault, etc.
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
```

### 2. Persistent Storage

For production, use:
- **AWS**: EBS (gp3 volumes)
- **GCP**: Persistent Disks (pd-ssd)
- **Azure**: Azure Disks
- **Self-hosted**: Longhorn, Rook Ceph, OpenEBS

Update `postgres-pvc.yaml`:
```yaml
spec:
  storageClassName: gp3  # or your storage class
  resources:
    requests:
      storage: 50Gi
```

### 3. Database Backups

```bash
# Create CronJob for backups
kubectl apply -f k8s/postgres-backup-cronjob.yaml
```

Example backup CronJob (create `postgres-backup-cronjob.yaml`):
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: vibrater
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15-alpine
            command:
            - sh
            - -c
            - |
              pg_dump -h postgres-service -U vibrater vibrater | \
              gzip > /backup/vibrater-$(date +%Y%m%d-%H%M%S).sql.gz
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: vibrater-secrets
                  key: DATABASE_PASSWORD
            volumeMounts:
            - name: backup
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: backup
            persistentVolumeClaim:
              claimName: backup-pvc
```

### 4. Monitoring

Install Prometheus + Grafana:
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
```

### 5. SSL Certificates

Install cert-manager:
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
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
```

## Scaling

### Horizontal Pod Autoscaling

Already configured in `ingress.yaml` (HPA resource).

### Vertical Scaling

Update resource requests/limits in `backend-deployment.yaml`:
```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "2000m"
```

### Database Scaling

For larger deployments, consider:
- **PostgreSQL replication** (primary + replicas)
- **Managed database services** (AWS RDS, GCP Cloud SQL, Azure Database)
- **Citus** (for sharding/partitioning)

## Useful Commands

```bash
# View all resources
kubectl get all -n vibrater

# Describe a pod
kubectl describe pod -n vibrater <pod-name>

# Get logs
kubectl logs -n vibrater <pod-name> -f

# Execute command in pod
kubectl exec -it -n vibrater <pod-name> -- /bin/sh

# Port forward for debugging
kubectl port-forward -n vibrater svc/vibrater-backend-service 3000:80

# Delete everything
kubectl delete -k k8s/
kubectl delete namespace vibrater

# Restart deployment
kubectl rollout restart deployment/vibrater-backend -n vibrater

# View resource usage
kubectl top pods -n vibrater
kubectl top nodes
```

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod -n vibrater <pod-name>
kubectl logs -n vibrater <pod-name>
```

Common issues:
- Image pull errors (check image name, registry auth)
- Resource constraints (increase limits)
- ConfigMap/Secret missing (check they exist)

### Database connection failed

```bash
# Check PostgreSQL is running
kubectl get pods -n vibrater -l app=postgres

# Check PostgreSQL logs
kubectl logs -n vibrater -l app=postgres

# Test connection from backend pod
kubectl exec -it -n vibrater <backend-pod> -- sh
apk add postgresql-client
psql -h postgres-service -U vibrater -d vibrater
```

### Ingress not working

```bash
# Check ingress
kubectl get ingress -n vibrater
kubectl describe ingress -n vibrater vibrater-ingress

# Check ingress controller
kubectl get pods -n ingress-nginx

# Check DNS
nslookup vibrater.yourdomain.com
```

## Next Steps

- Set up CI/CD pipeline (GitHub Actions, GitLab CI, ArgoCD)
- Configure monitoring and alerting
- Set up log aggregation (ELK, Loki)
- Implement canary deployments
- Add network policies for security

## Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Kustomize](https://kustomize.io/)
- [Helm](https://helm.sh/)
