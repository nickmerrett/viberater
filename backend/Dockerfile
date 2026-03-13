FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create directories and set permissions for arbitrary UID (OpenShift)
RUN mkdir -p storage/projects logs && \
    chown -R 1001:0 /app && \
    chmod -R g+rwX /app

# Run as non-root user (OpenShift will override with random UID, but same group)
USER 1001

EXPOSE 3000

CMD ["npm", "start"]
