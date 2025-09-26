FROM node:20-alpine AS builder

WORKDIR /app

# Accept API URL for Vite at build time (defaults to relative path for nginx proxy)
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Install dependencies (leverages Docker layer caching)
COPY package.json package-lock.json* bun.lockb* ./
RUN npm ci --no-audit --no-fund

# Copy source
COPY . .

# Build Vite app with injected env
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config with SPA fallback and /api proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

