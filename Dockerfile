FROM node:22-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/drizzle.config.js ./
COPY --from=builder /app/src ./src
COPY backend/package*.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]