# 🚀 GUÍA DE LANZAMIENTO A PRODUCCIÓN
## Fiesta y Lista — Paso a paso

Esta guía asume que NO tienes experiencia en programación. Cada paso está explicado en detalle.

---

## 1. COMPRAR DOMINIO (YA DEBERÍAS TENERLO)

Si ya tienes `fiestaylista.com`, continúa. Si no:
- Ve a **GoDaddy**, **Namecheap** o **Google Domains**
- Busca y compra `fiestaylista.com` (o el que hayas elegido)
- Cuesta aprox $10–$15 USD al año

---

## 2. CONFIGURAR RAILWAY (BACKEND — EL SERVIDOR)

Railway es donde vive el "cerebro" de la app (backend + base de datos).

### 2.1 Crear cuenta en Railway
1. Ve a https://railway.app
2. Regístrate con GitHub (es la opción más fácil)
3. Autoriza a Railway para acceder a tus repositorios

### 2.2 Crear la base de datos PostgreSQL
1. En Railway, haz clic en **"New Project"**
2. Selecciona **"Provision PostgreSQL"**
3. Espera 1–2 minutos a que se cree
4. Railway te mostrará una URL de conexión. **GUÁRDALA** (termina en `.railway.app`)
   - Se ve así: `postgresql://postgres:abc123@...`
   - Esta URL es tu **DATABASE_URL**

### 2.3 Desplegar el backend (Railway)
1. En Railway, crea un **nuevo proyecto**
2. Selecciona **"Deploy from GitHub repo"**
3. Elige tu repositorio `fiestaylista`
4. Railway detectará automáticamente el `Dockerfile`
5. Ve a la pestaña **"Variables"** y agrega TODAS estas:

```
DATABASE_URL=postgresql://... (la que copiaste en el paso 2.2)
JWT_SECRET=f06b6a4ec53e060bd5ac4696d6d12cd9b4844d57b9c8e7ff268b448decf32110
JWT_REFRESH_SECRET=db59d67682f062af2bfecf96d714d1f2bd6aed4a102f2b8a5625f40c0fb524eb
JWT_GUEST_SECRET=555ddc9ec75ccdcc9f5fc4fbc0a989060f11cf5d322e0a12eff37ddde76ec266
FRONTEND_URL=https://fiestaylista.com
BACKEND_URL=https://tusubida.up.railway.app
NODE_ENV=production
PORT=3001
```

> ⚠️ **IMPORTANTE**: `BACKEND_URL` es la URL que Railway te asigna automáticamente. La ves en la pestaña **"Settings" > "Domains"** de tu proyecto Railway. Se ve como `fiestaylista-production.up.railway.app`.

### 2.4 Agregar variables faltantes (cuando tengas las cuentas)

Las siguientes variables necesitan que crees cuentas primero (pasos 3, 4, 5):

| Variable | Dónde conseguirla |
|---|---|
| `RESEND_API_KEY` | Paso 3 — Resend |
| `FROM_EMAIL` | Paso 3 — Resend |
| `MERCADO_PAGO_ACCESS_TOKEN` | Paso 4 — Mercado Pago |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Paso 4 — Mercado Pago |
| `MERCADO_PAGO_PRO_MONTHLY_PLAN_ID` | Paso 4 — Mercado Pago |
| `MERCADO_PAGO_PRO_YEARLY_PLAN_ID` | Paso 4 — Mercado Pago |
| `CLOUDINARY_CLOUD_NAME` | Paso 5 — Cloudinary |
| `CLOUDINARY_API_KEY` | Paso 5 — Cloudinary |
| `CLOUDINARY_API_SECRET` | Paso 5 — Cloudinary |

### 2.5 Asignar dominio personalizado (opcional)

En Railway, ve a **"Settings" > "Domains"** y agrega `api.fiestaylista.com` (o un subdominio). Necesitarás configurar un registro CNAME en tu proveedor de dominio apuntando a Railway.

---

## 3. CONFIGURAR RESEND (EMAILS)

Resend envía los correos (verificación, bienvenida, notificaciones).

### 3.1 Crear cuenta
1. Ve a https://resend.com
2. Regístrate gratis (el plan gratuito incluye 100 emails/día)
3. Verifica tu correo

### 3.2 Verificar tu dominio
1. En Resend, ve a **"Domains"**
2. Agrega tu dominio (`fiestaylista.com`)
3. Resend te dará un registro **TXT** o **MX** para agregar en tu proveedor de dominio
4. Agrega ese registro en GoDaddy / Namecheap / etc.

### 3.3 Obtener API Key
1. En Resend, ve a **"API Keys"**
2. Crea una nueva API Key
3. Copia la clave (empieza con `re_...`)
4. En Railway > Variables, agrega:
   - `RESEND_API_KEY=re_...` (lo que copiaste)
   - `FROM_EMAIL=Fiesta y Lista <noreply@fiestaylista.com>`
     - Cambia `fiestaylista.com` por TU dominio verificado

---

## 4. CONFIGURAR MERCADO PAGO (PAGOS PRO)

### 4.1 Crear cuenta de vendedor
1. Ve a https://mercadopago.com
2. Regístrate como vendedor (necesitas RFC o datos fiscales)
3. Completa la verificación de identidad

### 4.2 Obtener Access Token
1. En Mercado Pago, ve a **"Tu negocio" > "Configuración" > "Credenciales"**
2. Copia el **Access Token** de **Producción** (NO el de pruebas)
   - Empieza con `APP_USR-...`
3. En Railway > Variables, agrega:
   - `MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...`

### 4.3 Configurar Webhook
1. En Mercado Pago, ve a **"Webhooks"**
2. Agrega un nuevo webhook con la URL:
   - `https://tusubida.up.railway.app/api/webhooks/mercadopago`
   - (Reemplaza `tusubida` con tu URL real de Railway)
3. Selecciona evento: **"Pagos"**
4. Copia el **"Secret"** que te da Mercado Pago
5. En Railway > Variables, agrega:
   - `MERCADO_PAGO_WEBHOOK_SECRET=...` (el secret que copiaste)

### 4.4 Crear Planes de Suscripción (para PRO)
1. En Mercado Pago, ve a **"Suscripciones"**
2. Crea un plan **Mensual**:
   - Nombre: "Fiesta y Lista PRO Mensual"
   - Precio: el que hayas definido (ej. $99 MXN)
   - Frecuencia: cada 1 mes
   - Una vez creado, copia el **ID del plan**
3. Crea un plan **Anual**:
   - Nombre: "Fiesta y Lista PRO Anual"
   - Precio: ej. $699 MXN
   - Frecuencia: cada 1 año
   - Copia el **ID del plan**
4. En Railway > Variables:
   - `MERCADO_PAGO_PRO_MONTHLY_PLAN_ID=...` (ID del plan mensual)
   - `MERCADO_PAGO_PRO_YEARLY_PLAN_ID=...` (ID del plan anual)

---

## 5. CONFIGURAR CLOUDINARY (FOTOS)

Cloudinary almacena las fotos que los usuarios suben.

### 5.1 Crear cuenta
1. Ve a https://cloudinary.com
2. Regístrate gratis (plan Free: 25 GB de almacenamiento)
3. Ve a **"Dashboard"**

### 5.2 Copiar credenciales
En el Dashboard verás:
- **Cloud name** (ej: `dabc12345`)
- **API Key** (ej: `123456789012345`)
- **API Secret** (ej: `abc123def456...`)

En Railway > Variables agrega:
- `CLOUDINARY_CLOUD_NAME=dabc12345`
- `CLOUDINARY_API_KEY=123456789012345`
- `CLOUDINARY_API_SECRET=abc123def456...`

---

## 6. CONFIGURAR NETLIFY (FRONTEND — LA PÁGINA WEB)

Netlify despliega la página que ven los usuarios.

### 6.1 Crear cuenta en Netlify
1. Ve a https://netlify.com
2. Regístrate con GitHub

### 6.2 Conectar repositorio
1. En Netlify, haz clic en **"Add new site" > "Import an existing project"**
2. Conecta tu cuenta de GitHub
3. Busca y selecciona tu repositorio `fiestaylista`
4. En configuración, **Netlify detectará automáticamente** el archivo `netlify.toml`
5. Haz clic en **"Deploy site"**

### 6.3 Configurar variables de entorno (Netlify)
Ve a **"Site settings" > "Environment variables"** y agrega:

```
VITE_API_URL=https://tusubida.up.railway.app
VITE_APP_URL=https://fiestaylista.com
```

> **Explicación**: `VITE_API_URL` es la URL de tu backend en Railway. `VITE_APP_URL` es la URL de tu frontend.

### 6.4 Configurar dominio personalizado
1. En Netlify, ve a **"Domain settings"**
2. Agrega tu dominio `fiestaylista.com`
3. Netlify te dará instrucciones para configurar los **nameservers** en tu proveedor de dominio
4. Sigue las instrucciones (esto puede tardar 1–48 horas en propagarse)

### 6.5 Actualizar netlify.toml local
Después del despliegue, edita `netlify.toml` en tu computadora y cambia la URL del backend:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://TUSUBIDA.up.railway.app/api/:splat"
  status = 200
```

Reemplaza `TUSUBIDA.up.railway.app` por la URL real de tu Railway. Luego haz **commit y push** (paso 10).

---

## 7. CONFIGURAR SENTRY (MONITOREO DE ERRORES — OPCIONAL)

Sentry te avisa cuando la app falla.

1. Ve a https://sentry.io
2. Regístrate
3. Crea un proyecto **"React"**
4. Copia el **DSN** (empieza con `https://...`)
5. En **Netlify > Environment variables** agrega:
   - `VITE_SENTRY_DSN=https://...`
6. En **Railway > Variables** (para el backend):
   - `SENTRY_DSN=https://...`

---

## 8. CONFIGURAR ANALYTICS (GOOGLE — OPCIONAL)

Para ver cuántas personas visitan la app.

1. Ve a https://analytics.google.com
2. Crea una propiedad para `fiestaylista.com`
3. Copia el **Measurement ID** (empieza con `G-...`)
4. Edita el archivo `frontend/index.html` y agrega el script de Google Analytics
   - (Si no sabes cómo, pídelo a tu desarrollador)

El `CookieBanner.tsx` ya está configurado para respetar las preferencias de cookies de los usuarios.

---

## 9. ANTES DE LANZAR — LISTA DE VERIFICACIÓN

### 9.1 Base de datos (Railway)
- [ ] Railway > Variables: TODAS las variables están configuradas
- [ ] Las migraciones se ejecutan automáticamente (el Dockerfile lo hace)
- [ ] Railway muestra el log: "🎉 Fiesta y Lista API" sin errores

### 9.2 Sitio web (Netlify)
- [ ] El despliegue fue exitoso (verde)
- [ ] Las variables `VITE_API_URL` y `VITE_APP_URL` están configuradas
- [ ] El dominio `fiestaylista.com` apunta a Netlify

### 9.3 Prueba manual — REGÍSTRATE REALMENTE
1. Ve a `https://fiestaylista.com`
2. Haz clic en **"Crear Lista Gratis"**
3. Regístrate con un correo real (como Gmail)
4. **Verifica que recibas el email de confirmación**
   - Si no llega: revisa Resend > Logs
5. Inicia sesión
6. Crea un evento (Boda, Baby Shower, etc.)
7. Agrega regalos a la lista
8. Comparte el enlace del evento en otra ventana de incógnito
9. **Como invitado**: marca un regalo como "apartado"
10. Vuelve a la ventana del organizador y verifica que se vea el cambio

### 9.4 Prueba de pago PRO (con tarjeta real)
1. Ve a tu evento
2. Activa el plan PRO
3. Sigue el flujo de pago de Mercado Pago
4. Verifica que el pago se procese y tu plan se active
5. **IMPORTANTE**: Usa una tarjeta REAL para probar (Mercado Pago en producción no acepta tarjetas de prueba)
   - Puedes cancelar la suscripción después de la prueba

### 9.5 Pruebas de seguridad
- [ ] Prueba crear un evento con un slug que tenga caracteres especiales
- [ ] Cierra sesión e intenta acceder a `/dashboard` — debe redirigir a login
- [ ] En modo incógnito, intenta acceder a `/api/events/...` directamente — debe dar error 401

---

## 10. SUBIR CAMBIOS A GITHUB

Cuando hayas hecho cambios locales (como actualizar `netlify.toml`), súbelos:

```bash
# En la terminal (PowerShell), estando en la carpeta del proyecto:
git add .
git commit -m "chore: preparacion para produccion"
git push
```

Esto hará que:
- **Railway** redeploye automáticamente el backend
- **Netlify** redeploye automáticamente el frontend

---

## 11. MONITOREO CONTINUO

Después del lanzamiento:

### Railway (backend)
- Ve a la pestaña **"Logs"** de Railway para ver errores
- Si la app se cae, Railway la reinicia automáticamente

### Resend (emails)
- Ve a **"Logs"** en Resend para ver si los correos están llegando
- Si ves errores, probablemente el dominio no está verificado

### Errores inesperados
- Si configuraste Sentry, recibirás correos cuando haya errores
- Si no, pide a un amigo que pruebe la app y te diga si algo falla

---

## 12. SOLUCIÓN DE PROBLEMAS COMUNES

### "La página está en blanco"
- Netlify > Deploys: ¿el deploy fue exitoso?
- ¿Configuraste `VITE_API_URL` en Netlify?

### "Error 502 Bad Gateway"
- Railway: ¿el backend está corriendo?
- Railway > Logs: revisa errores
- Verifica que `DATABASE_URL` sea correcta

### "No llegan los correos"
- Resend > Domains: ¿el dominio está verificado? (punto verde)
- Resend > Logs: ¿hay intentos de envío?
- ¿Configuraste `FROM_EMAIL` y `RESEND_API_KEY`?

### "No puedo pagar / Mercado Pago no funciona"
- ¿Usaste el Access Token de **producción** (APP_USR) o de pruebas (TEST)?
- ¿Los plan IDs son correctos?
- ¿El webhook está configurado con la URL completa?

### "Las fotos no se suben"
- Cloudinary > Dashboard: ¿el Cloud Name, API Key y API Secret son correctos?
- ¿El plan gratuito de Cloudinary tiene espacio?

---

## ¿NECITAS AYUDA?

Si algo no funciona y no entiendes qué hacer:
1. Ve a Newton (https://newton.so) y busca tu error
2. Pregunta en un grupo de Facebook de programación
3. Contrata a un desarrollador freelance por 1 hora para que revise

---

*Documento generado el 01/06/2026 — Fiesta y Lista v1.0*
