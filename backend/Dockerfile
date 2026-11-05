# Node 20 reached EOL, so node:20-bookworm-slim stopped being rebuilt
# (last updated 2026-04-22) and froze with stale Debian packages and npm.
# Bump to a maintained tag so the base carries patched OS packages.
FROM node:22-bookworm-slim

WORKDIR /app

# Install build tools for native modules (bcrypt, better-sqlite3) and git
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

# Install dependencies
RUN npm install

# Install beads CLI
RUN npm install -g @beads/bd

# Copy source code
COPY . .

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
