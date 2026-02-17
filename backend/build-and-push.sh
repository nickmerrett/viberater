#!/bin/bash

# Build and push viberater backend container image
# Usage: ./build-and-push.sh [registry] [version]

set -e

REGISTRY=${1:-"ghcr.io/yourusername"}
VERSION=${2:-"latest"}
IMAGE_NAME="viberater-backend"
FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$VERSION"

echo "Building viberater backend container image..."
echo "Image: $FULL_IMAGE"
echo ""

# Build the image
docker build \
  --tag "$FULL_IMAGE" \
  --tag "$REGISTRY/$IMAGE_NAME:latest" \
  .

echo ""
echo "✓ Build complete!"
echo ""

# Ask if user wants to push
read -p "Push to registry? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "Pushing to registry..."
    docker push "$FULL_IMAGE"

    if [ "$VERSION" != "latest" ]; then
        docker push "$REGISTRY/$IMAGE_NAME:latest"
    fi

    echo ""
    echo "✓ Push complete!"
    echo ""
    echo "Update k8s/backend-deployment.yaml with:"
    echo "  image: $FULL_IMAGE"
else
    echo ""
    echo "Skipped push. To push manually:"
    echo "  docker push $FULL_IMAGE"
fi

echo ""
echo "Done! 🎉"
