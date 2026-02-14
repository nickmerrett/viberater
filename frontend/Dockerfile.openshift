# Build stage
FROM docker.io/node:20-alpine AS builder

# Build arguments for versioning
ARG BUILD_ID
ARG BUILD_DATE

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Set build-time environment variables for Vite
ENV VITE_BUILD_ID=${BUILD_ID}
ENV VITE_BUILD_DATE=${BUILD_DATE}

# Build the app
RUN npm run build

# Production stage - OpenShift compatible
FROM docker.io/nginx:alpine

# Copy built app from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy OpenShift-compatible nginx configuration
COPY nginx-openshift.conf /etc/nginx/nginx.conf

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

CMD ["nginx", "-g", "daemon off;"]
