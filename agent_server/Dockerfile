# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY agent_server/package*.json agent_server/pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source files
COPY agent_server/ .
COPY report-templates/ ../report-templates/

# Skip TypeScript build - we use tsx at runtime
# RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm and tsx
RUN npm install -g pnpm tsx

# Copy package files
COPY agent_server/package*.json agent_server/pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files and source (tsx needs source for runtime)
COPY agent_server/ .
COPY report-templates/ ../report-templates/

# Expose port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8787/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the service using tsx (needed for runtime TS execution)
CMD ["pnpm", "start"]
