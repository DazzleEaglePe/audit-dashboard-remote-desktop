# Stage 1: Install all dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies to keep the image slim
RUN npm ci --only=production

# Copy built assets and compiled files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/worker.js ./worker.js
COPY --from=builder /app/load-env.js ./load-env.js
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle ./drizzle

EXPOSE 3000

# Default command (starts the web server)
# Can be overridden to "node worker.js" for the background worker container
CMD ["node", "server.js"]
