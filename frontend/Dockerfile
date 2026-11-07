# Multi-stage build. Stages:
#   base    - shared dependencies
#   test    - runs the unit suite; the pipeline builds this with `--target test`
#   build   - compiles the Vite bundle
#   runtime - nginx serving the built assets
#
# Node 22: matches the backend image (node:20 is EOL). Alpine stays for the
# frontend - the runtime is nginx:alpine and there is no glibc-only native
# dependency here.

# ---- base -------------------------------------------------------------------
FROM docker.io/node:22-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (reproducible, from the lockfile)
RUN npm ci

# ---- test -------------------------------------------------------------------
# CI gate. The pipeline runs `buildah bud --target test` with SKIP_PUSH=true.
# `npm test` is `vitest run`.
FROM base AS test
COPY . .
RUN npm test

# ---- build ------------------------------------------------------------------
FROM base AS build

# Build arguments for versioning
ARG BUILD_ID
ARG BUILD_DATE

# Copy source code
COPY . .

# Set build-time environment variables for Vite
ENV VITE_BUILD_ID=${BUILD_ID}
ENV VITE_BUILD_DATE=${BUILD_DATE}

# Build the app
RUN npm run build

# ---- runtime ----------------------------------------------------------------
# Production stage - OpenShift compatible
FROM docker.io/nginx:alpine

# Copy built app from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config as a template — BACKEND_URL is substituted at runtime
COPY --from=build /app/nginx-openshift.conf /etc/nginx/nginx.conf.template

# Create temp directories and set permissions for arbitrary UID
RUN mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp && \
    chmod -R 777 /tmp && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R 1001:0 /usr/share/nginx/html && \
    chmod -R g+rwX /usr/share/nginx/html && \
    # Fix permissions for nginx directories
    chown -R 1001:0 /var/cache/nginx && \
    chmod -R g+rwX /var/cache/nginx && \
    chown -R 1001:0 /var/log/nginx && \
    chmod -R g+rwX /var/log/nginx && \
    chown -R 1001:0 /etc/nginx && \
    chmod -R g+rwX /etc/nginx

# Run as non-root user (OpenShift will override with random UID, but same group)
USER 1001

# Expose non-privileged port
EXPOSE 8080

CMD ["/bin/sh", "-c", "envsubst '$BACKEND_URL' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf && nginx -c /tmp/nginx.conf -g 'daemon off;'"]
