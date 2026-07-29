# AGENTS.md

## Reglas del proyecto (de REGLAS.md)

- No borrar código que funciona. Solo se actualiza y mejora, nunca se elimina sin reemplazo equivalente o superior.
- No modificar procesos que funcionan sin justificación.
- Todo cambio debe pasar `typecheck`, `lint` y `tests` antes de commit.

## Arquitectura

Monorepo con dos paquetes npm independientes. El `package.json` raíz solo tiene scripts de conveniencia.

- **`backend/`** — Express + TypeScript + Drizzle ORM + PostgreSQL (driver postgres.js). Entry: `src/index.ts`, factory: `src/app.ts`. Validación de config al arranque (`src/config.ts`) hace `process.exit` si faltan vars críticas.
- **`frontend/`** — React 19 + Vite 6 + Tailwind CSS 4 + Framer Motion. Entry: `src/main.tsx`. Cliente API en `src/services/api.ts`.
- **`shared/`** — Tipos compartidos entre backend y frontend. Alias `@shared` en ambos vitest configs.
- Deploy: backend en Railway, frontend en Netlify. CI despliega ambos al hacer push a `main`.

## Comandos

### Desarrollo
```bash
npm run dev              # backend (:3001) + frontend (:5173) concurrentemente
cd backend && npm run dev   # solo backend (tsx watch)
cd frontend && npm run dev  # solo frontend (vite)
```

### Verificar (en este orden)
```bash
cd backend  && npm run typecheck && npm run lint && npm test   # vitest, ~200 tests
cd frontend && npm run typecheck && npm run lint && npm test   # vitest+jsdom, ~340 tests
# O desde la raíz:
npm test   # corre backend luego frontend
```

### Un solo archivo de test
```bash
cd backend  && npx vitest run src/__tests__/auth.test.ts
cd frontend && npx vitest run src/test/Login.test.tsx
```

### Base de datos
```bash
npm run db:generate   # drizzle-kit generate (desde raíz, usa backend/)
npm run db:migrate    # drizzle-kit migrate
npm run db:push       # sincroniza schema con la DB
docker compose up -d  # Postgres local
```

### E2E
```bash
cd frontend && npm run test:e2e   # playwright, requiere frontend corriendo
```

## Gotchas

### Backend
- **`postgres.js` con `prepare: false`** — no se puede interpolar `Date` crudo en templates `sql`. Usar `${dateVar.toISOString()}::timestamptz`.
- **Migraciones corren al arranque** antes de `app.listen()`. Runner custom en `src/db/migrate.ts` con tabla `migration_journal`. Cada entrada es un string SQL completo pasado a `sql.unsafe()` — NO dividir por `;` (rompe bloques `DO $$ ... $$`).
- **SSE cross-instance via Postgres LISTEN/NOTIFY**: El módulo `services/sse-pubsub.ts` usa `sql.listen()` (conexión dedicada) y `sql.notify()` para broadcast de eventos SSE entre instancias Railway. Cada instancia abre 1 conexión extra para el listener. `notifyEvent()` es fire-and-forget (el catch logea pero no lanza).
- **Pool de conexiones reducido**: default `DB_POOL_MAX=5` para escalar horizontalmente sin saturar Neon. Cada instancia usa ~6 conexiones (5 pool + 1 SSE listener). Neon recomienda usar su pooler interno (PgBouncer) — configurar DATABASE_URL con host `-pooler` o `?pgbouncer=true`. **Auto-config**: `db/index.ts` añade automáticamente `?pgbouncer=true` a URLs de Neon que no lo tengan.
- **Migraciones DDL con PgBouncer**: correr migraciones (ALTER TABLE, CREATE FUNCTION, DO $$) a través de PgBouncer en modo transacción puede causar connection pinning o timeouts. Para migraciones manuales en producción, usar una conexión directa (sin pooler) vía Railway Connect tab o configurar `DATABASE_URL_UNPOOLED`.
- **`COLUMN_MIGRATIONS` tiene 34+ entradas**. Cada migración requiere nombre único en `migration_journal`. Índices de escalabilidad (`scalability_indexes_phase1`) agregan compuestos para audit_logs, events, refresh_tokens, cash_contributions, event_views, subscriptions.
- **Cron jobs**: `yieldToEventLoop()` cada N iteraciones en loops batch para no bloquear el event loop. `runWithLock` con advisory lock previene ejecución duplicada entre instancias.
- **Carga de env**: `src/config.ts` lee `.env` manualmente (no dotenv). `process.env` tiene prioridad sobre `.env`. Vars críticas causan `process.exit(1)` si faltan en producción.
- **Validación de requests**: se hace inline en cada ruta con Zod + `asyncHandlerWithValidation`. No hay middleware centralizado `validation.ts`. El wrapper captura `ZodError` automáticamente, no es necesario try-catch manual.
- **SSL**: incondicional para conexiones non-localhost. Localhost (`docker compose`) desactiva SSL. **TLS 1.3 forzado vía Cloudflare Dashboard** (no código) — configurar SSL/TLS → "Full (Strict)" + "Minimum TLS Version → TLS 1.3".
- **Turnstile**: `verifyTurnstile` es obligatorio (lanza 400 sin token). `verifyTurnstileOptional` deja pasar sin token (rate limiter actúa como fallback). Login/register usan opcional; forgot/reset password y todos los endpoints de invitados usan obligatorio.
- **Cookie refresh token**: httpOnly, path `/api/auth/refresh`, prefijo `__Secure-` en producción. Cookie compañera no-httpOnly `hasRefresh=1` en path `/` permite al frontend saltar llamadas innecesarias de refresh.

### Frontend
- **No hay `.env` en el repo** — vars configuradas via dashboards de Netlify/Railway. `VITE_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` son separadas (frontend vs backend).
- **Access token solo en memoria** — `accessToken` es variable de módulo en `api.ts`, nunca en localStorage. Refresh via `tryRefreshToken()` revisa `document.cookie` por `hasRefresh=1` antes de hacer la request.
- **CSP en `netlify.toml`** — `img-src` permite solo `self`, `cloudinary`, `data:`, `blob:`. NO usar Unsplash ni otras URLs externas de imágenes. `connect-src` incluye la URL de Railway hardcodeada — si el proyecto Railway se renombra o migra, actualizar también en CSP y en el redirect `/api/*`.
- **`index.html`** incluye el script tag de Turnstile y contenido SEO (fallback SSR-like). Ambos deben mantenerse en sync.
- **El entorno de test es jsdom** — `document.cookie` persiste entre tests. Al testear lógica dependiente de cookies, setearla/limpiarla explícitamente.

### Deploy
- **Orden de CI**: lint → typecheck → test → build. Push a `main` dispara Railway (backend) + Netlify (frontend). PRs generan preview en Netlify.
- **Healthcheck de Railway**: 30s de timeout en `/health`. Si migraciones o `createApp()` fallan, el servidor nunca arranca y el healthcheck falla el deploy.
- **Cloudflare SSL/TLS**: configurar en Cloudflare Dashboard → SSL/TLS → "Full (Strict)" + Minimum TLS Version → TLS 1.3. No se puede forzar desde el código; el startup log lo recuerda cada vez que arranca el server.
- **`Dockerfile`**: build multi-stage. Imagen final copia `dist/`, corre `startup.sh` (`node dist/backend/src/index.js` con `--max-old-space-size=448`). El heap de Node está ajustado a 448MB para dejar ~64MB al OS Alpine en un contenedor de 512MB, evitando OOM kills silenciosos de Railway.

## Convenciones

- Comentarios y texto visible al usuario en español.
- Backend usa extensión `.js` en imports (ESM con TypeScript).
- Migraciones de columnas usan guards `IF NOT EXISTS` para idempotencia.
- Respuestas de error: `{ error: string, errorId: uuid }`. 4xx para subclases de `AppError`, 500 para inesperados.
- Notificaciones toast del frontend via `sonner` (`showToast` de `hooks/useToast`).
- Reporte de errores via `reportError(err, { source: '...' })` de `lib/reportError.ts`.

## Railway Audit — Correcciones Aplicadas (Jul 2026)

### Fase 1 — Foundation
- **H4**: Pool sizing `Math.ceil → Math.floor` en `db/index.ts` — evita exceder DB_POOL_MAX en cluster
- **H2**: Migration lock timeout 5→30 min + heartbeat cada 60s + índice en `locked_at`
- **H3**: Cluster primary ahora espera `Promise.all` de workers en shutdown (timeout 30s), flag `isShuttingDown` evita reinicios falsos
- **H11**: SHUTDOWN_TIMEOUT 10→30s, movido a scope de módulo

### Fase 2 — Shared Rate Limiting
- **H1**: `PostgresStore` en `rateLimitStore.ts` — tabla `rate_limits` con upsert atómico, fail-open en error DB. 16 tests
- 17 limiters migrados de MemoryStore a PostgreSQL vía `createLimiter()`
- Cleanup singleton cada 60s de registros expirados

### Fase 3 — Config & CORS
- **H8**: CORS normaliza trailing slash + lowercase antes de comparar
- **H9**: BACKEND_URL `warnConfig → failConfig` en producción
- **H14**: Railway service name configurable via `vars.RAILWAY_SERVICE_NAME`

### Fase 4 — Robustez
- **H7**: `railway.toml` con `readiness-path`
- **H5**: SSE reconnect conecta nuevo listener antes de desconectar el anterior
- **H10**: Cron errors reportados a Sentry vía `runWithLock`
- **H12**: 200ms delay entre llamadas MP API en `reconcileStuckSubscriptions`
- **H13**: Webhook limiter default 300→600

### Counters
- Backend: 231 tests (antes 215) | typecheck 0 errors | lint 0 errors
- Frontend: 340 tests | typecheck 0 errors | lint 0 errors