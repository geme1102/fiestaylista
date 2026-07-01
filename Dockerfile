FROM node:22-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm ci
COPY backend/ ./backend/
COPY shared/ ./shared/
WORKDIR /app/backend
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package*.json ./
COPY --from=builder /app/backend/drizzle.config.js ./
COPY --from=builder /app/backend/src/db/migrations ./src/db/migrations
COPY backend/startup.sh ./
RUN chmod +x startup.sh
USER appuser
EXPOSE 3001
CMD ["./startup.sh"]
