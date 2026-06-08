# Fiesta y Lista

Plataforma para crear y gestionar listas de regalos para eventos (baby showers, bodas, cumpleaños, bautizos, comuniones).

## Stack

- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + Framer Motion
- **Backend:** Express + TypeScript + Drizzle ORM + PostgreSQL
- **Pagos:** Mercado Pago
- **Bot detection:** Cloudflare Turnstile
- **Email:** Resend
- **Storage:** Cloudinary (imágenes)
- **CI/CD:** GitHub Actions → Railway (backend), Netlify (frontend)

## Requisitos

- Node.js 22+
- PostgreSQL 15+
- npm

## Instalación

```bash
git clone <repo>
cd fiesta-y-lista
npm install
cd backend && npm install
cd ../frontend && npm install
```

## Configuración

1. Copia `backend/.env.example` a `backend/.env` y completa las variables
2. Copia `frontend/.env.example` a `frontend/.env` y completa las variables

### Backend — Variables de Entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | Sí | URL de conexión a PostgreSQL |
| `JWT_SECRET` | Sí | Secreto para firmar tokens de acceso (mín. 32 chars, único entre los 3) |
| `JWT_REFRESH_SECRET` | Sí | Secreto para firmar tokens de refresco (único) |
| `JWT_GUEST_SECRET` | Sí | Secreto para firmar tokens de invitados (único) |
| `FRONTEND_URL` | Sí | URL del frontend (ej: `http://localhost:5173`) |
| `TURNSTILE_SECRET_KEY` | Prod | Secret key de Cloudflare Turnstile |
| `MERCADO_PAGO_ACCESS_TOKEN` | Prod | Token de acceso de Mercado Pago |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Prod | Secreto para verificar webhooks de MP |
| `MERCADO_PAGO_PRO_MONTHLY_PLAN_ID` | Prod | ID del plan mensual Pro en MP |
| `MERCADO_PAGO_PRO_YEARLY_PLAN_ID` | Prod | ID del plan anual Pro en MP |
| `RESEND_API_KEY` | Prod | API key de Resend para emails |
| `BACKEND_URL` | Prod | URL pública del backend (para webhooks MP) |
| `CLOUDINARY_CLOUD_NAME` | No | Nombre del cloud de Cloudinary |
| `CLOUDINARY_API_KEY` | No | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | No | API secret de Cloudinary |
| `BOOST_PRICE_CENTS` | No | Precio del boost en centavos (default: 10000) |
| `CONTRIBUTION_EXPIRY_HOURS` | No | Horas antes de expirar contribuciones (default: 24) |

### Frontend — Variables de Entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `VITE_API_URL` | Sí | URL del backend (ej: `http://localhost:3001`) |
| `VITE_TURNSTILE_SITE_KEY` | Prod | Site key de Cloudflare Turnstile |
| `VITE_APP_URL` | No | URL base de la app (para E2E tests) |

### Turnstile — Claves de Desarrollo

Para desarrollo local, usa las claves de prueba de Cloudflare Turnstile:

```
# Backend
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

# Frontend
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000000000AA
```

Estas claves permiten siempre la verificación, sin necesidad de interactuar con el captcha.

## Desarrollo

```bash
# Iniciar backend y frontend simultáneamente
npm run dev

# O por separado:
cd backend && npm run dev   # http://localhost:3001
cd frontend && npm run dev  # http://localhost:5173
```

## Testing

```bash
# Todos los tests
npm test

# Solo backend
cd backend && npm test

# Solo frontend (unit)
cd frontend && npm test

# E2E (requiere frontend corriendo)
cd frontend && npm run test:e2e
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia backend y frontend en desarrollo |
| `npm run build` | Compila backend + frontend para producción |
| `npm test` | Ejecuta tests de backend y frontend |
| `npm run lint` | Lintea backend + frontend |
| `npm run typecheck` | Verifica tipos en backend + frontend |
| `npm run db:generate` | Genera migraciones de base de datos |
| `npm run db:migrate` | Ejecuta migraciones pendientes |
| `npm run db:push` | Sincroniza schema con la base de datos |

## Arquitectura

```
fiesta-y-lista/
├── backend/
│   └── src/
│       ├── config.ts           # Variables de entorno + validación
│       ├── index.ts            # Entry point Express
│       ├── cron.ts             # Jobs programados (recordatorios, retry webhooks)
│       ├── db/
│       │   ├── index.ts        # Conexión PostgreSQL + Drizzle
│       │   ├── schema.ts       # Definición de tablas y relaciones
│       │   └── migrations/     # Migraciones SQL
│       ├── middleware/
│       │   ├── auth.ts         # requireAuth, optionalAuth
│       │   ├── error.ts        # Manejador global de errores
│       │   ├── ownership.ts    # Verificación de propiedad (eventos, gifts)
│       │   ├── rateLimit.ts    # Rate limiters por endpoint
│       │   ├── subscription.ts # Verificación de suscripción activa
│       │   └── turnstile.ts    # Verificación Cloudflare Turnstile
│       ├── routes/             # Express routers
│       ├── services/
│       │   ├── mercadopago.ts  # SDK wrappers (checkout, fetch, cancel)
│       │   ├── mp-webhooks.ts  # Webhook handlers (payments, subscriptions)
│       │   ├── auth.ts         # Lógica de autenticación
│       │   ├── subscription.ts # Gestión de suscripciones
│       │   └── ...             # Otros servicios
│       ├── types/              # TypeScript types
│       └── utils/              # Utilidades (errores, paginación, slug)
├── frontend/
│   └── src/
│       ├── components/         # Componentes React reutilizables
│       ├── hooks/              # Custom hooks (useAuth, useTurnstile, etc.)
│       ├── pages/              # Componentes de página
│       ├── services/           # API client y servicios
│       ├── utils/              # Utilidades (format, validation)
│       └── test/               # Tests unitarios
├── .github/workflows/ci.yml   # CI/CD pipeline
└── README.md
```

## Seguridad

- **Autenticación**: JWT con refresh token rotation (rotación atómica vía `UPDATE…RETURNING`)
- **Refresh tokens**: Almacenados hasheados (bcryptjs), revocados en logout, expiración forzada
- **Rate limiting**: Por endpoint (auth, uploads, payments, webhooks)
- **CSP**: Helmet con Content-Security-Policy restrictiva
- **Turnstile**: Verificación server-side en creación de checkout Pro
- **Webhooks**: Firma HMAC-SHA256 con timestamp validation (±5 min, replay protection)
- **Uploads**: Validación de magic bytes (independiente del mimetype), almacenamiento temporal en disco
- **IDOR**: Ownership middleware para eventos/regalos/fotos, userId desde JWT (nunca del body)
- **TOCTOU**: `FOR UPDATE` en transacciones críticas (suscripciones, fotos, boosts)
