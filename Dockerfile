FROM node:22-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle.config.js ./
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY backend/startup.sh ./
RUN chmod +x startup.sh
USER appuser
EXPOSE 3001
CMD ["./startup.sh"]
