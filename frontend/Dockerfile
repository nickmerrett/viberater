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

# Production stage
FROM docker.io/nginx:alpine

# Copy built app from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Fix permissions for Podman/SELinux
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
