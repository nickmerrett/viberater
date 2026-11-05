# Multi-stage build. Stages:
#   base    - shared toolchain + dependencies (build tools needed for native modules)
#   test    - runs the unit suite; the pipeline builds this with `--target test`
#   runtime - the deployed image
#
# Node 22 (not 20): node:20 is EOL, so node:20-bookworm-slim stopped being
# rebuilt (last updated 2026-04-22) and froze with stale Debian packages and
# npm. 22 keeps the installed better-sqlite3 9.x line inside its supported ABI
# range while still being actively rebuilt.

# ---- base -------------------------------------------------------------------
FROM node:22-bookworm-slim AS base

WORKDIR /app

# Build tools for native modules (bcrypt, better-sqlite3) and git
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    curl \
    git \
 && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies (reproducible, from the lockfile)
RUN npm ci

# Install beads CLI
RUN npm install -g @beads/bd

# Copy source code
COPY . .

# ---- test -------------------------------------------------------------------
# CI gate. The pipeline runs `buildah bud --target test` with SKIP_PUSH=true, so
# a failing suite fails the build. Environment mirrors the old inline test step.
FROM base AS test
ENV NODE_ENV=test
ENV JWT_SECRET=test-secret-key-for-ci-min-32-chars!!
ENV DB_TYPE=sqlite
ENV SQLITE_DIR=/tmp
RUN npm test

# ---- runtime ----------------------------------------------------------------
FROM base AS runtime

# Create directories and set permissions for arbitrary UID (OpenShift)
RUN mkdir -p storage/projects storage/attachments logs && \
    chown -R 1001:0 /app && \
    chmod -R g+rwX /app

# Strip npm from the runtime image. npm is only needed at build time, and the
# copy bundled in the node base image ships its own vulnerable dependencies
# (tar, glob, minimatch, brace-expansion, sigstore, pacote, cross-spawn,
# ip-address) which dominate the Trivy findings for this image. The app starts
# via `node` directly and shells out to the `bd` CLI at runtime - never npm.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx

# `npm start` previously set this; the CMD below runs node directly.
ENV NODE_ENV=production

# Run as non-root user (OpenShift will override with random UID, but same group)
USER 1001

EXPOSE 3000

CMD ["node", "src/server.js"]
