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
- **RLS NO es aplicable con PgBouncer**: las políticas dependen de `SET app.current_user_id`, que no es sticky con transaction pooling. `db/migrations/0015_enable_rls.sql` es REFERENCIA LEGACY (el runner nunca lo ejecuta) con nombres de columna corregidos a snake_case — solo serviría con conexiones directas (sin pooler). No intentar habilitarlo bajo la configuración actual; la seguridad se apoya en ownership checks en rutas (28 mutantes validan `requireEventOwnership`).
- **`COLUMN_MIGRATIONS` tiene 34+ entradas**. Cada migración requiere nombre único en `migration_journal`. Índices de escalabilidad (`scalability_indexes_phase1`) agregan compuestos para audit_logs, events, refresh_tokens, cash_contributions, event_views, subscriptions.
- **Cron jobs**: `yieldToEventLoop()` cada N iteraciones en loops batch para no bloquear el event loop. `runWithLock` con advisory lock previene ejecución duplicada entre instancias.
- **Carga de env**: `src/config.ts` lee `.env` manualmente (no dotenv). `process.env` tiene prioridad sobre `.env`. Vars críticas causan `process.exit(1)` si faltan en producción.
- **Validación de requests**: se hace inline en cada ruta con Zod + `asyncHandlerWithValidation`. No hay middleware centralizado `validation.ts`. El wrapper captura `ZodError` automáticamente, no es necesario try-catch manual.
- **SSL**: incondicional para conexiones non-localhost. Localhost (`docker compose`) desactiva SSL. HTTPS del frontend lo gestiona Netlify (certificados automáticos sobre el dominio `fiestaylista.com`); el de la API lo gestiona Railway (dominio público `*.up.railway.app`). El dominio NO está proxyado por Cloudflare; Cloudflare se usa solo para Turnstile (CAPTCHA). No hay TLS 1.3 "forzado" en edge — se hereda el mínimo de Netlify/Railway (TLS 1.2+).
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
- **SSL/HTTPS**: gestionado por Netlify (frontend, certificados automáticos) y Railway (API). Cloudflare solo participa como proveedor de Turnstile (CAPTCHA) — no hay nada que configurar en su dashboard. Si el proyecto Railway se renombra, actualizar el redirect `/api/*` en `netlify.toml`, el `connect-src` del CSP y `BACKEND_URL` en Railway.
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

### Fase 5 — Eliminación de cuenta (UX)
- `POST /delete-account` responde tras el borrado DB + cancelación MP (<2s) — antes esperaba el cleanup inline de Cloudinary (30-50s) contra el timeout del cliente de 10s → falsos errores "eliminación fallida"
- Tabla `pending_cloudinary_deletes` (sin FK, sobrevive al DELETE users) + migración `pending_cloudinary_deletes_table`: los public_ids se encolan ahí y el cron `retryPendingCloudinaryDeletes` (lock `retry-pending-cloudinary-deletes`, backoff exponencial) los borra en background — mismo patrón que C2

### Fase 6 — Defensa bot
- `createLimiter` acepta `windowMs` configurable (default 60s, resto de limiters intactos)
- Limiters de seguridad en ventana de 15 min alineada con `lockout.ts` (`WINDOW_MINUTES`): `authLimiter` 10, `resetLimiter` 5, `strictFallbackLimiter` 5 — antes 60s fijos = 300 intentos/hora por IP vs umbral de lockout de 20/15min

### Fase 7 — Bajas (unsubscribe/email)
- Correos críticos (`verification`, `password_reset`) ignoran `email_suppressions` — antes un email con bounce/complaint/baja no podía verificar su cuenta ni recuperar su contraseña (atrapado fuera)
- Footer de baja y header `List-Unsubscribe` apuntan al HTML del backend (`BACKEND_URL/unsubscribe`) con token one-click por destinatario — antes apuntaban al SPA sin ruta `/unsubscribe` (fallback → NotFound: la baja por email no funcionaba)
- `POST /unsubscribe` responde HTML de confirmación (los clientes RFC 8058 solo requieren el 200 OK)
- Lógica HMAC del token compartida en `utils/unsubscribeToken.ts` (`createUnsubscribeToken`/`recoverEmailFromToken`) — estaba duplicada en `email.ts` y `unsubscribe.ts`

## Auditoría Forense — Fase A (Críticos, Ago 2026)

- **A1**: `EMAIL_SEND_TIMEOUT_MS = 15_000` + `sendEmailWithTimeout` con `Promise.race` — un envío colgado de Resend ya no retiene el pool (~5 conexiones) ni el advisory lock del cron diario dentro de la transacción de `runWithLock`
- **A3**: SW api-cache restringido a whitelist pública (slug/gifts/photos/messages) + `caches.delete('api-cache')` en logout — antes se cacheaban GETs autenticados (fuga entre sesiones en dispositivo compartido)
- **A4**: subidas de fotos sin duplicados — el frontend no reintenta un upload cuyo body ya se subió completo (`xhr.upload.onload`); el backend aborta el stream de Cloudinary al vencer el timeout (25s) y destruye el asset parcial (`UploadAbortHandle {stream, publicId}`, `public_id` explícito)
- **A5**: idempotencia en `POST /api/events` — columna `idempotency_key` (uuid) + índice único parcial `(user_id, key)`; el reintento (ej. doble clic en modal de crear) devuelve el evento existente en vez de duplicarlo; lookup por key ANTES del chequeo de límite de eventos; catch 23505 con constraint `events_user_id_idempotency_key_unique`

## Auditoría Forense — Fase B (Medios, Ago 2026)

- **B3**: validaciones de Login/Register corren ANTES de `submittingRef.current = true` — un submit inválido ya no deja el formulario bloqueado para siempre
- **B2**: el retry tras 401/refresh de `api.ts` usa un AbortController nuevo — el original ya estaba abortado, así que el reintento era imposible
- **B4**: `/api/health/ready` con try/catch → 503 `{status:'unhealthy', error}`; `processWebhook().catch()` defensivo en webhooks.ts
- **B5**: un solo mount `app.use('/api/webhooks', webhookLimiter, webhooksRouter, resendWebhookRouter)`; `/subscribe` sin apiLimiter local (el global ya cubría)
- **B6**: `yieldToEventLoop` (setImmediate, de cron.ts) en loops de `sendFreezeEmail`/`sendPurgeWarningEmail` — no bloquean el event loop en batches grandes
- **B9**: `getEvent` consulta los claims SOLO de los gifts de la página vía `inArray(giftClaims.giftId, ids)` (antes innerJoin global: 1 claim de otra página traía la página completa); `reconcileStuckSubscriptions` con `.limit(100)`
- **B8**: drafts en localStorage con persistencia en onChange y limpieza al confirmar: `fy_msg_draft:${eventId}` (MessageWall), `fy_rsvp_draft:${eventId}` (RsvpForm), `fy_promise_draft:${fundId}` (PromiseForm)
- **B7**: el polling de pago de Dashboard respeta el unmount (flag `mounted`; no setState ni encola tras salir)
- **B13**: safe-areas iOS en Sheet (`pb-safe-lg`), PhotoSlideshow (`pt-safe pb-safe`), CookieBanner (`mb-safe`), EventAdmin (`pb-bottom-nav`), dialogs de Account (`overflow-y-auto` + `m-auto`)
- **B10**: paginación incremental — estados `giftsHasMore`/`photosHasMore` (límites `>= 50` gifts, `>= 15` fotos); `loadMoreGifts`/`loadMorePhotos` con cursor `createdAt.toISOString()` del último ítem, dedupe por id, `skipAuthRedirect: true`; botones "Ver más" en EventGuest y GiftManagement. Heurístico porque `getEventBySlug` no devuelve hasMore. Photos admin sin load-more (máx 20 fotos en pro)
- **B1**: maxAge del SW api-cache 1h → 10 min (estado de regalos disponible/apartado menos obsoleto en offline)

## Auditoría Forense — Fase C (Menores, Ago 2026)

- **C1**: `GET /gifts` con hasMore real — `getEventGifts` trae `limit+1` y deriva `hasMore` (patrón de `photo.ts`); antes era heurístico (`gifts.length === limit`) y devolvía `true` con exactamente `limit` filas sin más
- **C2**: mensaje dedicado para tier free al subir fotos ("Tu plan no incluye fotos") — antes "Has alcanzado el límite de 0 fotos" era confuso (también aplica a `/guest-upload` que no pre-chequea tier)
- **C3**: `'expired'` agregado al union `SubscriptionStatus` de shared (el CHECK de la DB `0018` ya lo permitía — drift tipo/DB cerrado)
- **C4**: `createPreApproval` idempotente por `external_reference` — busca preapprovals existentes no cancelados ANTES de crear; un retry de `retryable` tras timeout parcial ya no duplica preapprovals en MP
- **C5**: `uploadWithProgress` rechaza 2xx sin cuerpo JSON ("El servidor respondió sin confirmar la subida") — antes resolvía `undefined as T` y los callers reventaban con TypeError
- **C6**: `useEventPage` sin `as any` — el update optimista de claims mapea el payload SSE (id/claimedBy) al tipo `GiftClaim` de shared
- **C7**: `handleClaim` valida que el token de Turnstile llegó (toast "verificación de seguridad sigue pendiente") — antes enviaba `token ?? undefined` a `verifyTurnstile` obligatorio → 400 con mensaje genérico
- **C8**: `NotFound` con `pt-safe` en la nav absoluta (PWA standalone con notch)
- **C9**: barras de progreso animan `scaleX` con `transformOrigin: 'left'` (Statistics, EventReadyBar) — antes `width` → layout/reflow por frame
- **C10**: `EnvelopeReveal` aplica el blur estático vía style (fade out por opacity) — antes animaba `filter` por frame (repaint costoso en Android gama baja)
- **C11**: menú móvil del Layout con `scaleY` + `origin-top` — antes `height: 'auto'` (animación de layout)
- **C12**: badges del CashFund con `min-w-0` + `break-words` (sin desborde en 320px)
- **C13**: `restartSSEListener` limpia el retry timer pendiente (`retryTimer`) antes de reconectar — evita listeners apilados si un restart coincide con un reintento programado

### Counters
- Backend: 357 tests (antes 231) | typecheck 0 errors | lint 0 errors (11 warnings preexistentes)
- Frontend: 375 tests | typecheck 0 errors | lint 0 errors (35 warnings preexistentes)