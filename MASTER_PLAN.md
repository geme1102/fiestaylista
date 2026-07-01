# Plan Maestro de Ejecución

Consolidación de ~215 hallazgos (95 técnicos + 120 funcionales) organizados por prioridad de impacto en producción.

---

## 🚨 FASE 0 — HOTFIXES (Impacto inmediato en producción, ~8h)

### 0.1 Guest flow roto: Turnstile token missing en endpoints de invitados
**Causa raíz**: El frontend no envía Turnstile token en RSVP, mensajes, fotos, cash contribution, ni group-claim. Backend exige Turnstile en esos endpoints.

| Id | Bug | Archivo | Fix |
|----|-----|---------|-----|
| 0.1a | RSVP sin Turnstile | `frontend/src/components/RSVPForm.tsx` | Obtener y enviar `turnstileToken` del widget |
| 0.1b | Mensajes sin Turnstile | `frontend/src/components/MessageForm.tsx` | Idem |
| 0.1c | Photos sin Turnstile | `frontend/src/components/GuestPhotoUpload.tsx` | Idem |
| 0.1d | Cash contribution sin Turnstile | `frontend/src/components/CashFundSection.tsx` | Idem |
| 0.1e | Group claim sin Turnstile | `frontend/src/components/GiftCard.tsx` | Idem |
| 0.1f | Turnstile single-use nunca se resetea | `frontend/src/components/TurnstileWidget.tsx` | Resetear widget tras submit exitoso |
| 0.1g | Widget opacidad 0 en móvil | `frontend/src/components/TurnstileWidget.tsx` | Asegurar widget visible sin `pointer-events-none` |

### 0.2 Auth: Login sin protección + timing attack
| Id | Bug | Archivo | Fix |
|----|-----|---------|-----|
| 0.2a | `verifyTurnstileOptional` fail-open | `backend/src/middleware/turnstile.ts:49` | Revertir a fail-close o agregar rate limit por IP fuerte |
| 0.2b | `DUMMY_HASH` 54 chars (debe ser 60) | `backend/src/services/auth.ts:194` | Regenerar con `bcrypt.hashSync("dummy", 10)` |
| 0.2c | Refresh rotation sin grace window → multi-tab logout | `backend/src/services/auth.ts` | Guardar 2 tokens válidos simultáneos |

### 0.3 Guest: Cash Fund expulsa a invitados
| Id | Bug | Archivo | Fix |
|----|-----|---------|-----|
| 0.3a | `getContributions` requiere auth + ownership | `backend/src/routes/cash.ts:65` | Añadir ruta pública con `skipAuthRedirect` |
| 0.3b | Frontend llama endpoint owner-only | `frontend/src/components/CashFundSection.tsx:42-47` | Usar ruta pública |

### 0.4 Cash Fund: Datos incorrectos
| Id | Bug | Archivo | Fix |
|----|-----|---------|-----|
| 0.4a | `collectedAmount` nunca decrementa | `backend/src/services/cashFund.ts:146-153` | Decrementar al cancelar contribución |
| 0.4b | `promisedTotal` no retornado | `backend/src/routes/cash.ts` | Incluir en respuesta pública |
| 0.4c | `getContributions` response shape mismatch | `backend vs frontend` | Unificar: `{ contributions, nextCursor }` |
| 0.4d | `bankPhone` nunca configurable en producción | `frontend/src/components/CashFundSetupForm.tsx` | Agregar campo bankPhone al setup |

### 0.5 Event Lifecycle: Freeze/Complete bypass
| Id | Bug | Archivo | Fix |
|----|-----|---------|-----|
| 0.5a | Toggle `isActive` bypasses freeze | `backend/src/routes/events.ts` | Validar `frozenAt IS NULL` al reactivar |
| 0.5b | `getEventBySlug` no retorna `status` | `backend/src/routes/events.ts:getEventBySlug` | Incluir `status` calculado |
| 0.5c | Reactivar no restaura `isActive` | `backend/src/services/event.ts:reactivateEvent` | Set `isActive = true`, `frozenAt = NULL` |
| 0.5d | Complete no detiene gift claiming | `backend/src/routes/events.ts` | Bloquear `POST /gifts` si `status=completed` |

### 0.6 Gift: Race condition + 500
| Id | Bug | Archivo | Fix |
|----|-----|---------|-----|
| 0.6a | Nombre duplicado → 500 | `backend/src/services/gift.ts:53-56` | Catch 23505 → 400 |
| 0.6b | `addGroupClaim` race + no `isClaimed=true` | `backend/src/services/gift.ts` | SELECT FOR UPDATE + marcar claimed |
| 0.6c | Orden admin vs guest opuesto | `backend/src/routes/gifts.ts` | Unificar ORDER BY |

### 0.7 Photo: Upload roto + mixed content
| Id | Bug | Archivo | Fix |
|----|-----|---------|-----|
| 0.7a | Turnstile corre ANTES de multer | `backend/src/routes/photos.ts` | Reordenar middleware: multer → Turnstile |
| 0.7b | `http://` URLs permitidas | `backend/src/services/photo.ts` | Validar protocolo HTTPS |
| 0.7c | `toggleFeaturedPhoto` race (no atómico) | `backend/src/services/photo.ts` | Usar `UPDATE ... SET featured = NOT featured` |
| 0.7d | `compressImage` destruye alpha PNG | `frontend/src/services/image.ts` | Preservar PNG alpha |

### 0.8 Payment: Atribución + idempotency
| Id | Bug | Archivo | Fix |
|----|-----|---------|-----|
| 0.8a | No `external_reference` en MP preference | `backend/src/routes/subscriptions.ts:40-53` | Crear preference por usuario con `external_reference = userId` |
| 0.8b | Webhook duplicado extiende suscripción | `backend/src/services/subscription.ts` | Idempotency key con `merchant_order.id` |
| 0.8c | Refund/chargeback no desactiva Pro | `backend/src/services/subscription.ts` | Webhook `payment.refunded` → cancelar |
| 0.8d | Webhook tardío re-activa suscripción cancelada | `backend/src/services/subscription.ts` | Validar estado actual antes de reactivar |

### 0.9 Cron: Data corruption + spam
| Id | Bug | Archivo | Fix |
|----|-----|---------|-----|
| 0.9a | `purgeExpiredData` borra TODOS los frozen si UNO pasa 30 días | `backend/src/services/cron.ts` | WHERE por evento individual |
| 0.9b | Re-suscripción no descongela eventos | `backend/src/services/cron.ts` | Al reactivar subscription, descongelar eventos |
| 0.9c | `emailTracking` UNIQUE → 1 reminder por vida | `backend/src/services/notifications.ts` | Permitir múltiples reminders por evento+guest |
| 0.9d | `sendPurgeWarnings` 7 emails duplicados | `backend/src/services/cron.ts:185-191` | Dedup por eventId |
| 0.9e | `processReminders` marca `emailSent:true` ANTES de enviar | `backend/src/services/cron.ts` | Marcar DESPUÉS de send exitoso |

### 0.10 Auth: Logout + estado
| Id | Bug | Archivo | Fix |
|----|-----|---------|-----|
| 0.10a | Logout falla silenciosamente | `backend/src/routes/auth.ts` | Verificar eliminación de token |
| 0.10b | Refresh token en JSON body (XSS) | `backend/src/routes/auth.ts` | Usar cookie httpOnly para refresh |

### 0.11 SSE: Cash contributions silenciosas
| Id | Bug | Archivo | Fix |
|----|-----|---------|-----|
| 0.11a | No hay evento cash contribution | `backend/src/services/notifications.ts:58-65` | Emitir SSE event |
| 0.11b | Fire-and-forget sin delivery guarantee | `backend/src/services/sse.ts` | Buffer + retry |
| 0.11c | Scavenger no detecta half-open móvil | `backend/src/services/sse.ts` | Heartbeat + timeout real |

---

## 🔴 FASE 1 — SEGURIDAD + MONITOREO (~10h)

### 1.1 Frontend: Errores silenciosos
| Id | Bug | Hallazgos |
|----|-----|-----------|
| 1.1a | 15+ catch blocks sin Sentry | Todos los componentes con try-catch vacío |
| 1.1b | `SectionErrorBoundary` no reporta | `frontend/src/components/SectionErrorBoundary.tsx:24` |
| 1.1c | `showToas` typo crashes session restore | `frontend/src/contexts/AuthContext.tsx:49` |

### 1.2 Backend: XSS + rate limiting
| Id | Bug | Fix |
|----|-----|-----|
| 1.2a | Guest content sin sanitizar | Sanitize HTML en mensajes, nombres, gift messages |
| 1.2b | Rate limiters en endpoints públicos | RSVP, guest messages, photo upload, cash contribution |
| 1.2c | `uncaughtException` exit code 0 | Cambiar a `process.exit(1)` |

### 1.3 Data integrity
| Id | Bug | Fix |
|----|-----|-----|
| 1.3a | `deleteEvent` no limpia tablas relacionadas | Cascade DELETE en DB + app-level cleanup |
| 1.3b | `events.slug` no soft-delete aware | Unique index con `WHERE deleted_at IS NULL` |
| 1.3c | `gifts.claimedBy` vs `giftClaims` divergen | Single source of truth |
| 1.3d | `auth.tokens` nunca se limpia | TTL index o cron cleanup |
| 1.3e | event_views unbounded log | TTL + partition por mes |
| 1.3f | No unsubscribe mechanism (Ley 1581) | Unsubscribe link en emails |

### 1.4 Infraestructura
| Id | Bug | Fix |
|----|-----|-----|
| 1.4a | `sourceMap: false` en tsconfig | `backend/tsconfig.json:18` → `true` |
| 1.4b | Migraciones corren DESPUÉS de listen() | Mover antes de `app.listen()` |
| 1.4c | healthcheckTimeout 300s | Reducir a 30s |
| 1.4d | CORS origins hardcoded | Mover a env vars |
| 1.4e | `FRONTEND_URL` fallback frágil | Validar URL |
| 1.4f | `trust proxy` hop count | Configurar explícitamente |

---

## 🟠 FASE 2 — BACKEND ROBUSTEZ (~8h)

### 2.1 Error handling
| Id | Bug | Fix |
|----|-----|-----|
| 2.1a | Unify error types | Usar `AppError` en todos los services |
| 2.1b | Zwitterión sin tipo | Tipar `throw new AppError(code, message, status)` |
| 2.1c | 500 en vez de 400 para validación | ZodError → ValidationError en todas las rutas |

### 2.2 Base de datos
| Id | Bug | Fix |
|----|-----|-----|
| 2.2a | N+1 queries en gifts, contributions | Eager loading con JOINs |
| 2.2b | Queries sin LIMIT | Paginación obligatoria |
| 2.2c | Pool config subóptimo | Ajustar según Railway tier |
| 2.2d | Migration journal | `migration_journal` table |

### 2.3 Cash Fund
| Id | Bug | Fix |
|----|-----|-----|
| 2.3a | `collectedAmount` reconciliation | Job nocturno para reconciliar |
| 2.3b | Cancel contribution no decrementa | `UPDATE cash_funds SET collectedAmount = collectedAmount - amount` |

### 2.4 Gifts
| Id | Bug | Fix |
|----|-----|-----|
| 2.4a | Soft delete filter en queries | `WHERE deleted_at IS NULL` |
| 2.4b | Orden consistente admin/guest | Unificar ORDER BY createdAt |

### 2.5 Subscription
| Id | Bug | Fix |
|----|-----|-----|
| 2.5a | Idempotency key en webhooks | Almacenar `merchant_order.id` |
| 2.5b | Per-user MP preference | Crear preference con `external_reference = userId` |

---

## 🟡 FASE 3 — UX-UI + PERFORMANCE + MOBILE (~10h)

### 3.1 Estados de UI
| Id | Bug | Fix |
|----|-----|-----|
| 3.1a | Error states ausentes | Agregar en todos los componentes asíncronos |
| 3.1b | Empty states ausentes | Mensajes "no hay..." en listas |
| 3.1c | Loading states inconsistentes | Unificar spinners/skeletons |

### 3.2 A11y
| Id | Bug | Fix |
|----|-----|-----|
| 3.2a | Focus traps en modales | Verificar todos los modales |
| 3.2b | Body scroll lock | `useLockedBody` en modales |
| 3.2c | Touch targets < 44px | Botones pequeños |
| 3.2d | `localStorage` sin try-catch | Envolver todos los accesos |
| 3.2e | `prefers-reduced-motion` no implementado | En animaciones restantes |

### 3.3 Performance
| Id | Bug | Fix |
|----|-----|-----|
| 3.3a | Lazy loading ausente | Route-based code splitting |
| 3.3b | Debounce en search/inputs | `useDebounce` hook |
| 3.3c | Imágenes sin lazy loading | `loading="lazy"` en `<img>` |
| 3.3d | Bundle sin tree-shaking | Verificar imports |

### 3.4 PWA / Offline
| Id | Bug | Fix |
|----|-----|-----|
| 3.4a | No offline fallback UI | Página offline.html |
| 3.4b | No PWA update notification | `beforeinstallprompt` + update toast |
| 3.4c | Service worker strategy básica | Cache-first para assets |

---

## 🟢 FASE 4 — INFRAESTRUCTURA + DEPLOY (~5h)

### 4.1 Railway
| Id | Bug | Fix |
|----|-----|-----|
| 4.1a | `uncaughtException` exit 0 | `process.exit(1)` |
| 4.1b | Migraciones post-listen | Mover antes |
| 4.1c | healthcheckTimeout 300s | 30s |
| 4.1d | `PORT` NaN validation | Validar parseInt |

### 4.2 Config
| Id | Bug | Fix |
|----|-----|-----|
| 4.2a | CORS hardcoded | `ALLOWED_ORIGINS` env var |
| 4.2b | `FRONTEND_URL` fallback frágil | Validar URL |
| 4.2c | Cloudinary config sin validación | Validar al startup |
| 4.2d | Sentry frontend sin try-catch | `Sentry.init()` envuelto |

---

## 🔵 FASE 5 — TECHNICAL DEBT + SEO + E2E (~7h)

### 5.1 Shared types
| Id | Fix |
|----|-----|
| 5.1a | Mover tipos compartidos a `shared/` |
| 5.1b | Unificar `sanitize` utilitites |
| 5.1c | Dead code removal (`purgeExpiredData`, etc.) |
| 5.1d | Split archivos grandes (>300 lines) |
| 5.1e | `SubscriptionStatus` type tipado |

### 5.2 SEO
| Id | Fix |
|----|-----|
| 5.2a | PAGE_META para `/statistics` |
| 5.2b | `<main>` tags en todas las páginas |
| 5.2c | JSON-LD dedup |
| 5.2d | Meta descriptions únicos por evento |

### 5.3 E2E
| Id | Gaps |
|----|------|
| 5.3a | Photo upload flow |
| 5.3b | Cash fund flow (contribute, cancel) |
| 5.3c | Boost flow |
| 5.3d | Tier gating (Free vs Pro) |
| 5.3e | Guest messages |
| 5.3f | Incognito/private browsing |
| 5.3g | Payment webhook simulation |
| 5.3h | Token refresh rotation |
| 5.3i | Freeze/purge lifecycle |
| 5.3j | Group gift claiming |
| 5.3k | Flaky test fixes |

---

## 📊 ESTIMACIÓN TOTAL

| Fase | Horas | Dependencias |
|------|-------|-------------|
| FASE 0 — Hotfixes | ~8h | Ninguna |
| FASE 1 — Seguridad + Monitoreo | ~10h | Ninguna |
| FASE 2 — Backend Robustez | ~8h | FASE 0 (cash, gift fixes) |
| FASE 3 — UX-UI + Performance | ~10h | Ninguna |
| FASE 4 — Infraestructura | ~5h | Ninguna |
| FASE 5 — Technical Debt | ~7h | FASE 0, 1, 2 |
| **Total** | **~48h** | |

### Paralelizables
- FASE 0 + FASE 1 + FASE 3 + FASE 4 pueden correr en paralelo (sin dependencias de código)
- FASE 2 depende de FASE 0 (especialmente cash/gift)
- FASE 5 es la última (depende de refactors anteriores)

---

## 🏆 PRIORIDAD DE EJECUCIÓN RECOMENDADA

1. **FASE 0.1 — Guest Turnstile** (desbloquea invitados)
2. **FASE 0.2 — Auth hardening** (seguridad)
3. **FASE 0.5 — Event lifecycle** (freeze/complete bypass)
4. **FASE 0.6 — Gift 500 + race** (crash prevention)
5. **FASE 0.7 — Photo upload** (contenido invitados)
6. **FASE 0.8 — Payment attribution** (dinero)
7. **FASE 0.9 — Cron corruption** (integridad datos)
8. **FASE 0.11 — SSE cash events** (notificaciones)
9. **FASE 3 — UX-UI** (experiencia usuario)
10. **FASE 1 — Seguridad + Monitoreo** (visibilidad)
11. **FASE 4 — Infraestructura** (estabilidad deploy)
12. **FASE 2 — Backend** (robustez)
13. **FASE 5 — Deuda técnica** (calidad código)
