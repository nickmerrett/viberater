#!/bin/bash

# Build script that generates build ID and date

# Generate build ID from git commit hash or timestamp
if git rev-parse --git-dir > /dev/null 2>&1; then
  BUILD_ID=$(git rev-parse --short HEAD)
else
  BUILD_ID="build-$(date +%s)"
fi

# Generate build date
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "Building with:"
echo "  BUILD_ID: $BUILD_ID"
echo "  BUILD_DATE: $BUILD_DATE"

# Build frontend
cd frontend 
podman build \
  --build-arg BUILD_ID="$BUILD_ID" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  -t viberater-frontend:latest \
  .

# Build backend
cd ../backend
podman build -t viberater-backend:latest .

echo "Build complete!"
echo "Frontend: viberater-frontend:latest ($BUILD_ID)"
echo "Backend: viberater-backend:latest"
