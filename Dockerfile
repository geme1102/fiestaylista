FROM node:22-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm ci
COPY backend/ ./backend/
COPY shared/ ./shared/
WORKDIR /app/backend
RUN npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=prod-deps /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package*.json ./
COPY --from=builder /app/backend/drizzle.config.js ./
COPY --from=builder /app/backend/src/db/migrations ./src/db/migrations
COPY backend/startup.sh ./
RUN chmod +x startup.sh
USER appuser
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=30s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1
CMD ["./startup.sh"]
