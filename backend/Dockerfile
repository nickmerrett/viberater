FROM node:20-bookworm-slim

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

# Run as non-root user (OpenShift will override with random UID, but same group)
USER 1001

EXPOSE 3000

CMD ["npm", "start"]
