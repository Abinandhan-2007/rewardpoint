# ==============================================================================
# Multi-stage Dockerfile for Team Reward Tracker (Free Tier, Single Service)
# Stage 1: Build the Vite React Frontend
# Stage 2: Run FastAPI Backend with Uvicorn, serving the built static assets
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Frontend Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy dependency manifests first to optimize Docker layer cache
COPY frontend/package*.json ./
RUN npm ci || npm install

# Copy frontend source files
COPY frontend/ ./

# Build production bundle (outputs to /app/frontend/dist)
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Backend Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS backend-runtime

WORKDIR /app

# Ensure standard output is unbuffered and bytecode is not written
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    STATIC_DIR=/app/frontend/dist

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Working directory set to backend for clean imports
WORKDIR /app/backend

# Default port exposed (Render will override via PORT environment variable)
EXPOSE 8000

# Container healthcheck using /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Launch uvicorn dynamically binding to $PORT provided by Render or runtime
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
