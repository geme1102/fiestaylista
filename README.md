# Fiesta y Lista

Plataforma para crear y gestionar listas de regalos para eventos (baby showers, bodas, cumpleaños, bautizos, comuniones).

## Stack

- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + Framer Motion
- **Backend:** Express + TypeScript + Drizzle ORM + PostgreSQL
- **Pagos:** Mercado Pago
- **Email:** Resend
- **Despliegue:** Frontend → Netlify, Backend → Railway

## Requisitos

- Node.js 22+
- PostgreSQL
- npm

## Instalación

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

## Configuración

1. Copia `backend/.env.example` a `backend/.env` y completa las variables
2. Copia `frontend/.env.example` a `frontend/.env` y completa las variables

### Variables de Entorno Requeridas

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión a PostgreSQL |
| `JWT_SECRET` | Secreto para firmar tokens de acceso |
| `JWT_REFRESH_SECRET` | Secreto para firmar tokens de refresco |
| `JWT_GUEST_SECRET` | Secreto para firmar tokens de invitados |
| `FRONTEND_URL` | URL del frontend (para CORS) |

### Variables de Entorno Opcionales

| Variable | Descripción |
|----------|-------------|
| `MERCADO_PAGO_ACCESS_TOKEN` | Token de acceso de Mercado Pago |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Secreto para verificar webhooks de MP |
| `MERCADO_PAGO_PRO_MONTHLY_PLAN_ID` | ID del plan mensual Pro |
| `MERCADO_PAGO_PRO_YEARLY_PLAN_ID` | ID del plan anual Pro |
| `RESEND_API_KEY` | API key de Resend para emails |
| `CLOUDINARY_CLOUD_NAME` | Nombre del cloud de Cloudinary |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |

## Desarrollo

```bash
npm run dev
```

Inicia backend (puerto 3001) y frontend (puerto 5173) simultáneamente.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia backend y frontend en desarrollo |
| `npm run build` | Compila el frontend para producción |
| `npm test` | Ejecuta tests de backend y frontend |
| `npm run db:generate` | Genera migraciones de base de datos |
| `npm run db:migrate` | Ejecuta migraciones pendientes |
| `npm run db:push` | Sincroniza schema con la base de datos |
