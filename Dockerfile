# Use the official Node.js 20 LTS image as a base
FROM node:20-alpine AS base

# Set the working directory in the container
WORKDIR /app

# --- Dependencies Stage ---
FROM base AS deps
WORKDIR /app

# Copy package.json and potentially lock files
COPY package.json ./package.json
# Copy lock files if they exist, destination must end with /
COPY package-lock.json* ./ 
COPY pnpm-lock.yaml* ./ 

# Prefer pnpm if lock file exists, otherwise use npm
RUN if [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; \
    fi

# --- Prisma Stage ---
FROM base AS prisma-stage
WORKDIR /app

# Copy installed dependencies and prisma schema
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma

# Generate Prisma client (ensure schema provider is postgresql)
RUN npx prisma generate

# --- Build Stage ---
FROM base AS builder
WORKDIR /app

# Copy installed dependencies, prisma client, and source code
COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma-stage /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma-stage /app/node_modules/@prisma ./node_modules/@prisma
COPY . .

# Build the TypeScript project
RUN npm run build

# Prune development dependencies
RUN npm prune --production

# --- Runner Stage ---
FROM node:20-alpine AS runner
WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV production

# Install PM2 globally
RUN npm install pm2 -g

# Copy necessary files from previous stages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/ecosystem.config.js ./ecosystem.config.js
COPY --from=prisma-stage /app/prisma ./prisma/

# Expose any ports if needed (not necessary for this worker)
# EXPOSE 3000

# Start the application using PM2
CMD [ "pm2-runtime", "start", "ecosystem.config.js" ] 