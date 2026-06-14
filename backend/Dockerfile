FROM node:20-alpine AS builder
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
RUN npm ci

# Copy backend source
COPY backend/ .

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

# Production image
FROM node:20-alpine
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY backend/prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/src/main"]
