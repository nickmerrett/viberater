FROM node:20-bookworm-slim

WORKDIR /app

# Build tools for native modules (bcrypt, better-sqlite3) and git.
# `apt-get upgrade` pulls the patched Debian versions of base packages
# (libgnutls30, libpcre2-8-0, libcap2, ...) that the :slim tag ships stale.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
      ca-certificates \
      curl \
      git \
 && apt-get upgrade -y \
      -o Dpkg::Options::="--force-confdef" \
      -o Dpkg::Options::="--force-confold" \
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