# 🚀 Guía de Deploy a Producción — Fiesta y Lista

> **Para quién es esta guía:** Personas sin experiencia en programación.
> **Tiempo estimado:** 3 a 5 horas si tienes todos los documentos a la mano.
> **Costo aproximado:** $5 a $20/mes (Railway ~$5, Neon gratis, Vercel gratis, dominio ~$10/año).
> **Importante:** Sigue los pasos en ORDEN. No te saltes ninguno ni cambies el orden.

---

## Índice de pasos

1. [Crear cuentas necesarias](#paso-1-crear-las-6-cuentas-necesarias)
2. [Crear la base de datos PostgreSQL](#paso-2-crear-la-base-de-datos-postgresql-en-neon)
3. [Subir el código a GitHub](#paso-3-subir-el-codigo-a-github)
4. [Configurar las variables del backend](#paso-4-configurar-las-variables-de-entorno-del-backend)
5. [Desplegar el backend en Railway](#paso-5-desplegar-el-backend-en-railway)
6. [Configurar Mercado Pago (cobros)](#paso-6-configurar-mercado-pago)
7. [Configurar Resend (correos electrónicos)](#paso-7-configurar-resend-correos-electronicos)
8. [Configurar Cloudinary (fotos)](#paso-8-configurar-cloudinary-fotos-opcional)
9. [Desplegar el frontend en Vercel](#paso-9-desplegar-el-frontend-en-vercel)
10. [Conectar el frontend con el backend](#paso-10-conectar-el-frontend-con-el-backend)
11. [Configurar webhooks de Mercado Pago](#paso-11-configurar-webhooks-de-mercado-pago)
12. [Verificar que todo funciona](#paso-12-verificar-que-todo-funciona)
13. [Solución de problemas comunes](#paso-13-solucion-de-problemas-comunes)
14. [Mantenimiento mensual](#paso-14-mantenimiento-mensual)

---

## Paso 1: Crear las 6 cuentas necesarias

Antes de empezar necesitas crear cuentas en estos servicios. Cada uno es gratis o tiene prueba gratis.

### 1.1 GitHub — Guardar el código

1. Abre https://github.com
2. Haz clic en **"Sign up"**
3. Ingresa tu correo electrónico
4. Crea una contraseña segura (mínimo 8 caracteres, con mayúscula y número)
5. Pon tu nombre de usuario (ej: `tu-nombre`)
6. Verifica tu correo con el código que te llegue
7. Listo, ya tienes cuenta de GitHub

### 1.2 Railway — Alojar el servidor (backend)

1. Abre https://railway.app
2. Haz clic en **"Login"**
3. Elige **"Continue with GitHub"**
4. Autoriza a Railway para conectarse con tu cuenta de GitHub
5. Listo, ya tienes cuenta de Railway
6. **Nota:** Railway te pedirá una tarjeta de crédito para activar la cuenta, pero no te cobrará hasta que superes $5 de uso (con esta app no lo superarás).

### 1.3 Vercel — Alojar la página web (frontend)

1. Abre https://vercel.com
2. Haz clic en **"Sign Up"**
3. Elige **"Continue with GitHub"**
4. Autoriza a Vercel para conectarse con tu cuenta de GitHub
5. Listo, ya tienes cuenta de Vercel

### 1.4 Neon — Base de datos

1. Abre https://neon.tech
2. Haz clic en **"Sign Up"**
3. Puedes usar tu cuenta de Google o GitHub
4. Listo, ya tienes cuenta de Neon

### 1.5 Mercado Pago — Cobros

1. Abre https://mercadopago.com.co
2. Haz clic en **"Crear cuenta"**
3. Elige **"Vender"**
4. Completa todos los datos que te pida:
   - Nombre completo
   - Documento de identidad (cédula)
   - Correo electrónico
   - Teléfono
   - Dirección
5. Verifica tu identidad cuando te lo pidan (pueden pedir fotos de tu documento)
6. **Importante:** La cuenta debe estar verificada para poder cobrar en producción

### 1.6 Resend — Correos electrónicos

1. Abre https://resend.com
2. Haz clic en **"Sign Up"**
3. Puedes usar tu cuenta de Google o GitHub
4. Verifica tu correo con el código que te llegue
5. Listo, ya tienes cuenta de Resend

---

## Paso 2: Crear la base de datos PostgreSQL en Neon

La base de datos guarda toda la información de la aplicación: usuarios, eventos, regalos, pagos, etc.

1. Abre https://console.neon.tech
2. Haz clic en **"Create a project"**
3. En **"Name"** escribe: `fiestaylista-db`
4. En **"Region"** elige la más cercana a Colombia (ej: **"US East (N. Virginia)"** — es la más rápida desde Latinoamérica)
5. Haz clic en **"Create project"**
6. Espera 10 a 20 segundos mientras se crea
7. En la pantalla que aparece, busca una caja que dice **"Connection string"** o **"Connection details"**
8. Dentro de esa caja hay un texto largo que empieza con `postgresql://` (se ve así):
   ```
   postgresql://usuario:contraseña@ep-...us-east-2.aws.neon.tech/fiestaylista-db?sslmode=require
   ```
9. Haz clic en el botón **"Copy"** para copiar ese texto completo
10. **Pégalo en un bloc de notas** porque lo usarás más adelante. Se llama `DATABASE_URL`.

> ⚠️ **No cierres esta página** hasta que hayas copiado la URL. Si la pierdes, puedes volver a Neon Dashboard, entrar al proyecto y en "Connection Details" copiarla de nuevo.

---

## Paso 3: Subir el código a GitHub

### 3.1 Crear el repositorio en GitHub

1. Abre https://github.com
2. Haz clic en el botón verde **"New"** (arriba a la izquierda, al lado de tu foto de perfil)
3. En **"Repository name"** escribe: `fiestaylista`
4. En **"Description"** puedes escribir: `App de listas de regalos para eventos`
5. Elige **"Public"** (así Railway y Vercel pueden ver el código)
6. **NO** marques "Add a README file"
7. **NO** marques "Add .gitignore"
8. **NO** elijas "Choose a license"
9. Haz clic en **"Create repository"**
10. Aparecerá una página con instrucciones. Busca la sección que dice **"…or push an existing repository from the command line"**

### 3.2 Subir el código desde tu computadora

1. Abre la carpeta del proyecto en Visual Studio Code:
   - Abre Visual Studio Code (si no lo tienes, descárgalo de https://code.visualstudio.com)
   - Ve a **Archivo** → **Abrir carpeta**
   - Busca y selecciona la carpeta **"Fiesta y Lista"**
   - Haz clic en **"Seleccionar carpeta"**

2. Abre la terminal en Visual Studio Code:
   - Ve a **Terminal** → **Nueva Terminal** (en la parte de arriba del programa)
   - Se abrirá una ventana en la parte de abajo

3. En la terminal escribe los siguientes comandos UNO POR UNO, presionando Enter después de cada uno:

   **Comando 1:**
   ```
   git init
   ```
   (Presiona Enter. Debe aparecer: "Initialized empty Git repository...")

   **Comando 2:**
   ```
   git add .
   ```
   (Presiona Enter. No muestra nada, es normal.)

   **Comando 3:**
   ```
   git commit -m "Primer commit - version completa"
   ```
   (Presiona Enter. Debe aparecer: "X files changed...")

   **Comando 4:** (Este comando lo copias de la página de GitHub, NO es exactamente este)
   ```
   git branch -M main
   ```
   (Presiona Enter. No muestra nada, es normal.)

   **Comando 5:** (Este comando lo copias de la página de GitHub, NO es exactamente este)
   ```
   git remote add origin https://github.com/TU-USUARIO/fiestaylista.git
   ```
   (Presiona Enter. No muestra nada, es normal.)

   > ⚠️ **Importante:** El comando 5 debe usar la URL que GitHub te mostró. Copia exactamente lo que apareció en la página de GitHub después de crear el repositorio.

   **Comando 6:**
   ```
   git push -u origin main
   ```
   (Presiona Enter. Te pedirá usuario y contraseña de GitHub. Ponlos.)

4. Espera a que termine. Verás algo como:
   ```
    * [new branch]      main -> main
    Branch 'main' set up to track remote branch 'main' from 'origin'.
   ```

5. **Verifica:** Ve a https://github.com/tu-usuario/fiestaylista — deberías ver todos los archivos del proyecto.

> ❓ **Si algo sale mal:** Revisa que los comandos 4, 5 y 6 sean exactamente los que GitHub te mostró. Si te pide "token" o "password" y no sabes cuál es, en GitHub ve a Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token, marca "repo", cópialo y úsalo como contraseña.

---

## Paso 4: Configurar las variables de entorno del backend

Las variables de entorno son datos secretos que la aplicación necesita para funcionar (como la contraseña de la base de datos). Las tienes que escribir exactamente como se muestran aquí.

Abre https://github.com/tu-usuario/fiestaylista y ve al archivo `backend/.env.example`. Ese archivo tiene la lista de variables que necesitas. Abajo te explico cada una:

### Lista completa de variables

| # | Variable | Explicación | Dónde la obtienes |
|---|----------|-------------|-------------------|
| 1 | `DATABASE_URL` | Conexión a la base de datos | Paso 2 (Neon) — el texto que empieza con `postgresql://...` |
| 2 | `JWT_SECRET` | Clave para generar tokens de seguridad | **Invéntala.** Debe tener al menos 32 caracteres. Ej: `MiClaveSuperSecreta1234567890ABCXYZ!@#` |
| 3 | `JWT_REFRESH_SECRET` | Clave diferente para refrescar tokens | **Invéntala.** Debe ser diferente a JWT_SECRET. Ej: `OtraClaveDiferente9876543210ZXCVBNM$%&` |
| 4 | `MERCADO_PAGO_ACCESS_TOKEN` | Token para cobrar con Mercado Pago | Paso 6 — lo obtienes del panel de Mercado Pago |
| 5 | `MERCADO_PAGO_PRO_MONTHLY_PLAN_ID` | ID del plan de suscripción mensual | Paso 6 — lo creas en Mercado Pago |
| 6 | `MERCADO_PAGO_PRO_YEARLY_PLAN_ID` | ID del plan de suscripción anual | Paso 6 — lo creas en Mercado Pago |
| 7 | `RESEND_API_KEY` | Clave para enviar correos | Paso 7 — la obtienes de Resend |
| 8 | `FRONTEND_URL` | URL donde vive la página web | Paso 9 — la obtienes de Vercel |
| 9 | `BACKEND_URL` | URL donde vive el servidor | Paso 5 — la obtienes de Railway |
| 10 | `CLOUDINARY_CLOUD_NAME` | Nombre de tu nube en Cloudinary | Paso 8 — opcional, para fotos |
| 11 | `CLOUDINARY_API_KEY` | Llave de Cloudinary | Paso 8 — opcional |
| 12 | `CLOUDINARY_API_SECRET` | Secreto de Cloudinary | Paso 8 — opcional |
| 13 | `FROM_EMAIL` | Correo que aparece como remitente | Ej: `Fiesta y Lista <noreply@tudominio.com>`. Si no tienes dominio, pon `noreply@app.fiestaylista.com` |
| 14 | `NODE_ENV` | Modo de la aplicación | Siempre debe ser: `production` |

> ⚠️ **Importante:** Las variables `BACKEND_URL` y `FRONTEND_URL` no las sabrás hasta después de los pasos 5 y 9. Por ahora déjalas vacías o con valores temporales, las actualizarás después.

Guarda esta lista en tu bloc de notas porque la necesitarás en los siguientes pasos.

---

## Paso 5: Desplegar el backend en Railway

### 5.1 Conectar Railway con GitHub

1. Abre https://railway.app
2. Haz clic en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Railway te mostrará tus repositorios de GitHub
5. Busca y selecciona **"fiestaylista"**
6. Railway empezará a construir el proyecto automáticamente

### 5.2 Configurar el comando de inicio

Railway necesita saber qué comando ejecutar para arrancar el backend:

1. En Railway, ve a la pestaña **"Settings"**
2. Busca **"Deploy"** → **"Start Command"**
3. Escribe exactamente: `npm run start`
4. Presiona Enter o haz clic fuera para guardar

### 5.3 Agregar las variables de entorno

1. En Railway, ve a la pestaña **"Variables"** (al lado de Settings)
2. Haz clic en **"Add Variable"** o **"New Variable"**
3. Agrega UNA POR UNA cada variable de la lista del Paso 4:
   - En **"KEY"** escribe el nombre exacto de la variable (ej: `DATABASE_URL`)
   - En **"VALUE"** pega el valor correspondiente (ej: `postgresql://...`)

   Repite esto para cada variable que tengas en tu lista. Las que no tienes aún (como las de Mercado Pago) déjalas para después.

   > 💡 **Tip:** Puedes hacer clic en **"Add Bulk Variable"** y pegar varias a la vez en formato `CLAVE=valor`, una por línea. Ejemplo:
   > ```
   > NODE_ENV=production
   > JWT_SECRET=MiClaveSuperSecreta...
   > JWT_REFRESH_SECRET=OtraClaveDiferente...
   > ```

4. Después de agregar cada variable, Railway reinicia el proyecto automáticamente.

### 5.4 Obtener la URL del backend

1. En Railway, ve a la pestaña **"Settings"**
2. Busca la sección **"Networking"**
3. Haz clic en **"Generate Domain"**
4. Aparecerá una URL parecida a: `https://fiestaylista.up.railway.app`
5. **Copia esa URL** y pégala en tu bloc de notas como `BACKEND_URL`

### 5.5 Verificar que el backend funciona

1. Abre una nueva ventana en tu navegador
2. Pega esta dirección (reemplaza `TU-URL` por la que copiaste):
   ```
   https://TU-URL.up.railway.app/api/health
   ```
3. Deberías ver algo como:
   ```json
   {"status":"ok","timestamp":"...","environment":"production","database":"connected"}
   ```
4. Si ves esto, **el backend está funcionando correctamente.** ¡Felicidades!

> ❓ **¿No funciona?** Revisa:
> - Que `DATABASE_URL` esté bien escrita en las variables de Railway
> - Que en Settings → Start Command esté `npm run start`
> - Ve a la pestaña **"Logs"** → **"Deploy Logs"** para ver errores

### 5.6 Actualizar BACKEND_URL

1. En Railway → Variables
2. Busca la variable `BACKEND_URL` y actualiza su valor con la URL que copiaste en el paso 5.4
3. Railway se reiniciará solo

---

## Paso 6: Configurar Mercado Pago

Mercado Pago es el que permite a tus usuarios pagar con tarjeta, Nequi, Daviplata, etc.

### 6.1 Obtener el token de producción

1. Abre https://www.mercadopago.com.co/developers/panel
2. Inicia sesión con tu cuenta de Mercado Pago
3. Haz clic en **"Crear aplicación"**
4. En **"Nombre de la aplicación"** escribe: `Fiesta y Lista`
5. En **"Productos"** selecciona: **"Mercado Pago"**
6. Haz clic en **"Crear aplicación"**
7. En la pantalla que aparece, busca la sección **"Credenciales"**
8. Busca la pestaña **"Producción"** (NO Sandbox)
9. Copia el texto que dice **"Access Token"** — empieza con `APP_USR-...`
10. **Guárdalo en tu bloc de notas** como `MERCADO_PAGO_ACCESS_TOKEN`

### 6.2 Crear los planes de suscripción

Necesitas crear dos planes: uno mensual y uno anual.

**Plan mensual:**
1. Abre https://www.mercadopago.com.co/suscriptions/create-plan
2. En **"Nombre del plan"** escribe: `Fiesta y Lista Pro Mensual`
3. En **"Monto"** escribe: `14990` (o el precio que quieras cobrar)
4. En **"Frecuencia"** selecciona: **"1 mes"**
5. En **"Días de prueba"** déjalo en `0`
6. Haz clic en **"Crear"**
7. En la página que aparece, busca el **"ID del plan"** — es un texto como `2c938084...`
8. **Guárdalo** como `MERCADO_PAGO_PRO_MONTHLY_PLAN_ID`

**Plan anual:**
1. Abre https://www.mercadopago.com.co/suscriptions/create-plan
2. En **"Nombre del plan"** escribe: `Fiesta y Lista Pro Anual`
3. En **"Monto"** escribe: `119990` (10 meses por el precio de ~8)
4. En **"Frecuencia"** selecciona: **"1 año"**
5. Haz clic en **"Crear"**
6. Copia el **"ID del plan"**
7. **Guárdalo** como `MERCADO_PAGO_PRO_YEARLY_PLAN_ID`

### 6.3 Agregar los valores a Railway

1. Abre Railway → Variables
2. Agrega las siguientes variables:
   - `MERCADO_PAGO_ACCESS_TOKEN` → pega el token `APP_USR-...`
   - `MERCADO_PAGO_PRO_MONTHLY_PLAN_ID` → pega el ID del plan mensual
   - `MERCADO_PAGO_PRO_YEARLY_PLAN_ID` → pega el ID del plan anual

---

## Paso 7: Configurar Resend (correos electrónicos)

Resend envía los correos de la aplicación: verificación de cuenta, recuperación de contraseña, recordatorios, etc.

### 7.1 Obtener la clave API

1. Abre https://resend.com
2. Ve a la barra lateral izquierda y haz clic en **"API Keys"**
3. Haz clic en **"Create API Key"**
4. En **"Name"** escribe: `Fiesta y Lista Producción`
5. En **"Permission"** selecciona: **"Full access"**
6. Haz clic en **"Create"**
7. Copia la clave que aparece (empieza con `re_...`)
8. **Guárdala** en tu bloc de notas como `RESEND_API_KEY`

### 7.2 Agregar a Railway

1. Abre Railway → Variables
2. Agrega: `RESEND_API_KEY` → pega la clave `re_...`
3. Si quieres que los correos lleguen bien (no a SPAM), necesitas un dominio. Si no tienes, los correos igual se enviarán pero pueden llegar a SPAM.

### 7.3 (Opcional) Verificar un dominio en Resend

Para que los correos no lleguen a SPAM:

1. En Resend, ve a **"Domains"**
2. Haz clic en **"Add Domain"**
3. Escribe tu dominio (ej: `fiestaylista.com` — debes haberlo comprado antes)
4. Resend te mostrará unos registros DNS (son textos largos que parecen:
   ```
   resend._domainkey.tudominio.com  TXT  "v=DKIM1; h=sha256; k=rsa; p=..."
   ```
5. Ve al sitio donde compraste tu dominio (GoDaddy, Namecheap, Hostinger, etc.)
6. Busca la sección **"DNS"** o **"Zone Editor"**
7. Agrega los registros que Resend te indicó
8. Espera 5 a 30 minutos
9. En Resend, haz clic en **"Verify"** al lado del dominio

---

## Paso 8: Configurar Cloudinary (fotos — opcional)

Cloudinary guarda las fotos que los usuarios suben a sus eventos. Si no lo configuras, las fotos se guardan temporalmente en el servidor y se perderán cuando Railway lo reinicie.

### 8.1 Crear cuenta y obtener datos

1. Abre https://cloudinary.com
2. Haz clic en **"Sign Up"** (gratis, no pide tarjeta)
3. Puedes usar tu cuenta de Google o GitHub
4. Una vez dentro, ve a **"Dashboard"** (menú izquierdo)
5. Copia estos 3 valores:
   - **Cloud name** — un texto como `dchgjkm98`
   - **API Key** — un número como `123456789012345`
   - **API Secret** — un texto largo como `abc123def456...`

### 8.2 Agregar a Railway

1. Abre Railway → Variables
2. Agrega:
   - `CLOUDINARY_CLOUD_NAME` → el Cloud name
   - `CLOUDINARY_API_KEY` → el API Key
   - `CLOUDINARY_API_SECRET` → el API Secret

---

## Paso 9: Desplegar el frontend en Vercel

El frontend es la página web que ven los usuarios cuando abren la aplicación en su navegador.

### 9.1 Crear el proyecto en Vercel

1. Abre https://vercel.com
2. Haz clic en **"Add New..."** (arriba a la derecha)
3. Selecciona **"Project"**
4. Vercel te mostrará tus repositorios de GitHub
5. Busca y selecciona **"fiestaylista"**
6. Se abrirá una página de configuración. Ahora tienes que cambiar varias cosas:

### 9.2 Configurar el proyecto

**Root Directory (carpeta del proyecto):**
1. Haz clic en **"Edit"** al lado de "Root Directory"
2. Escribe: `frontend`
3. Esto le dice a Vercel que el código del frontend está dentro de la carpeta `frontend`

**Build and Output Settings:**
1. En **"Build Command"** borra lo que hay y escribe: `npm run build`
2. En **"Output Directory"** borra lo que hay y escribe: `dist`

**Environment Variables (variables de entorno):**
1. Haz clic en **"+ Add"** para agregar variables
2. Agrega esta variable:
   - **Variable:** `VITE_API_URL`
   - **Valor:** La URL del backend que copiaste en el Paso 5.4 (ej: `https://fiestaylista.up.railway.app`)
   - **Nota:** Esta URL es la de Railway, no la de Vercel

### 9.3 Desplegar

1. Haz clic en el botón **"Deploy"**
2. Espera 2 a 4 minutos mientras Vercel construye y publica el proyecto
3. Verás barras de progreso: "Building", "Uploading", "Deploying"
4. Cuando termine, aparecerá una pantalla verde con **"Congratulations!"**
5. Habrá una URL como: `https://fiestaylista.vercel.app`
6. **Copia esa URL** y guárdala como `FRONTEND_URL` en tu bloc de notas

### 9.4 Probar que el frontend funciona

1. Abre una nueva ventana del navegador
2. Ve a la URL de Vercel (ej: `https://fiestaylista.vercel.app`)
3. Deberías ver la página de inicio de **Fiesta y Lista** con el diseño rosa y los iconos de eventos
4. Si ves la página, **el frontend está funcionando**

> ❓ **¿Ves una página en blanco o un error 404?** Revisa:
> - Que en Vercel → Project → Settings → "Root Directory" sea `frontend`
> - Que la variable `VITE_API_URL` esté bien escrita
> - Que la URL no tenga una barra al final

---

## Paso 10: Conectar el frontend con el backend

Ahora que ya tienes tanto el frontend como el backend funcionando, tienes que decirle al backend cuál es la URL del frontend (para que sepa a quién aceptar llamadas).

### 10.1 Actualizar FRONTEND_URL en Railway

1. Abre Railway → Proyecto → Variables
2. Busca la variable `FRONTEND_URL`
3. Cambia su valor por la URL de Vercel que copiaste en el Paso 9.3
   (ej: `https://fiestaylista.vercel.app`)
4. Railway reiniciará el backend automáticamente

### 10.2 Verificar la conexión

1. Abre la página web en Vercel (`https://fiestaylista.vercel.app`)
2. Regístrate con un correo electrónico real (que puedas revisar):
   - Haz clic en **"Registrarse"**
   - Pon tu nombre
   - Pon tu correo electrónico
   - Crea una contraseña (mínimo 8 caracteres, 1 mayúscula, 1 número)
   - Acepta términos y condiciones
   - Haz clic en **"Crear Cuenta"**

3. Si el registro funciona:
   - Te debe aparecer un mensaje de éxito
   - Debe llegarte un correo de verificación a tu bandeja de entrada

4. Revisa tu correo:
   - ¿Llegó el correo de verificación? → Sí, bien. No → Revisa que `RESEND_API_KEY` esté bien en Railway

5. Haz clic en el enlace de verificación del correo

6. Inicia sesión con tu correo y contraseña

7. Crea un evento de prueba:
   - Haz clic en **"+ Nuevo Evento"**
   - Ponle nombre, tipo y fecha
   - Agrega algunos regalos

---

## Paso 11: Configurar webhooks de Mercado Pago

Los webhooks son notificaciones automáticas que Mercado Pago envía al backend cuando alguien hace un pago. Sin esta configuración, los pagos no se procesarán automáticamente.

### 11.1 Configurar la URL del webhook en Mercado Pago

1. Abre https://www.mercadopago.com.co/developers/panel
2. Selecciona tu aplicación **"Fiesta y Lista"**
3. En el menú izquierdo, haz clic en **"Webhooks"**
4. Busca la sección **"Producción"** (NO Sandbox)
5. Asegúrate de que el interruptor esté en **"Activo"** (verde)
6. En **"URL"** escribe:
   ```
   https://TU-URL-DE-RAILWAY.up.railway.app/api/webhooks/mercadopago
   ```
   Reemplaza `TU-URL-DE-RAILWAY` por la URL que copiaste en el Paso 5.4

7. En **"Eventos"** selecciona:
   - ✅ **payment** (cuando alguien paga)
   - ✅ **subscription** (cuando alguien se suscribe)
   - ✅ **preapproval** (cuando se aprueba una suscripción)

8. Haz clic en **"Guardar"**

### 11.2 Verificar que el webhook funciona

1. En la misma página de Webhooks, busca la sección **"Últimas notificaciones"**
2. Debería mostrar las notificaciones que ha recibido el webhook
3. Si ves notificaciones con estado "Enviado" o "Pendiente", está funcionando
4. Si ves errores, la URL puede estar mal escrita o el backend caído

---

## Paso 12: Verificar que todo funciona

Realiza estas pruebas en ORDEN para asegurarte de que todo está funcionando correctamente.

### Prueba 1: Registro e inicio de sesión
- [ ] Abre `https://fiestaylista.vercel.app`
- [ ] Haz clic en **"Registrarse"**
- [ ] Completa el formulario con un correo real
- [ ] Haz clic en **"Crear Cuenta"**
- [ ] ✅ ¿Viste un mensaje de éxito? → Sí / No
- [ ] Revisa tu bandeja de correo (incluyendo SPAM)
- [ ] ✅ ¿Llegó el correo de verificación? → Sí / No
- [ ] Haz clic en el enlace de verificación del correo
- [ ] ✅ ¿La página mostró "Correo verificado"? → Sí / No
- [ ] Vuelve a la página web e inicia sesión con tu correo y contraseña
- [ ] ✅ ¿Entraste al Dashboard? → Sí / No

### Prueba 2: Crear un evento
- [ ] En el Dashboard, haz clic en **"+ Nuevo Evento"**
- [ ] Ponle nombre: "Evento de prueba"
- [ ] Elige tipo: "Cumpleaños"
- [ ] Elige una fecha (cualquiera)
- [ ] Haz clic en **"Crear Evento"**
- [ ] ✅ ¿Viste el evento creado en el Dashboard? → Sí / No
- [ ] Haz clic en el evento para entrar al administrador
- [ ] ✅ ¿Se abrió la página del evento? → Sí / No

### Prueba 3: Agregar regalos
- [ ] En el administrador del evento, busca la sección **"Regalos"**
- [ ] Haz clic en **"Agregar regalo"**
- [ ] Pon nombre: "Peluche"
- [ ] Pon precio: "50000"
- [ ] Pon URL: `https://ejemplo.com/peluche`
- [ ] Haz clic en **"Guardar"**
- [ ] ✅ ¿Apareció el regalo en la lista? → Sí / No
- [ ] Agrega otro regalo: "Libro" con precio "30000"
- [ ] ✅ ¿Aparecieron los dos regalos? → Sí / No

### Prueba 4: Vista de invitado
- [ ] En el administrador del evento, copia el **enlace público** del evento (botón "Compartir" o "Copiar enlace")
- [ ] Abre una ventana de **Incógnito** (Chrome) o **Privada** (Edge/Firefox) — así simulas ser un invitado
- [ ] Pega el enlace del evento en la ventana de Incógnito
- [ ] ✅ ¿Viste la página del evento con los regalos? → Sí / No
- [ ] Escribe un nombre en el campo "Escribe tu nombre para apartar un regalo"
- [ ] Haz clic en **"Apartar"** en uno de los regalos
- [ ] ✅ ¿Apareció el mensaje de que apartaste el regalo? → Sí / No
- [ ] ✅ ¿El regalo aparece como "apartado"? → Sí / No

### Prueba 5: Plan Pro (pago)
- [ ] Vuelve a la ventana normal (donde tienes sesión iniciada)
- [ ] Ve a **"Planes"** (en el menú de arriba)
- [ ] Haz clic en **"Pro Mensual"** → **"Elegir Plan"**
- [ ] ✅ ¿Te redirigió a Mercado Pago? → Sí / No
- [ ] En Mercado Pago, puedes pagar con una tarjeta de prueba:
   - Número: `5031 7557 3453 0604`
   - Vencimiento: cualquier fecha futura
   - CVV: `123`
   - Nombre: el que quieras
   - Cédula: `1000000000`
- [ ] ✅ ¿El pago se procesó? → Sí / No
- [ ] Vuelve al Dashboard y recarga la página
- [ ] ✅ ¿Tu cuenta aparece como "Pro" o con el plan activo? → Sí / No

### Prueba 6: Lluvia de Sobres (cash fund)
- [ ] En el administrador del evento, busca **"Lluvia de Sobres"**
- [ ] Haz clic en **"Activar"** o configúralo
- [ ] Comparte el enlace del evento de nuevo
- [ ] En la ventana de Incógnito (invitado), busca la sección de **"Lluvia de Sobres"**
- [ ] ✅ ¿Viste la opción de contribuir económicamente? → Sí / No
- [ ] Haz una contribución de prueba (Mercado Pago te pedirá datos de tarjeta)
   - Usa la misma tarjeta de prueba
- [ ] ✅ ¿Apareció confirmación del pago? → Sí / No
- [ ] Vuelve al administrador del evento
- [ ] ✅ ¿El contador de Lluvia de Sobres se actualizó? → Sí / No

### Prueba 7: SEO y meta tags
- [ ] Abre en el navegador: `https://fiestaylista.vercel.app/baby-shower`
- [ ] ✅ ¿Viste la página informativa de Baby Shower? → Sí / No
- [ ] Haz clic derecho en la página → **"Ver código fuente"** o **"View page source"**
- [ ] Busca la palabra `<title>` — ✅ ¿Aparece el título correcto? → Sí / No
- [ ] Busca `<meta name="description"` — ✅ ¿Aparece la descripción? → Sí / No

### Prueba 8: Aplicación instalable (PWA)
- [ ] En el navegador, busca el icono de instalar (en Chrome aparece como un monitor con una flecha en la barra de direcciones)
- [ ] ✅ ¿Aparece el icono de instalar? → Sí / No
- [ ] Si lo ves, la aplicación se puede instalar como una app en el celular o computador

---

## Paso 13: Solución de problemas comunes

Aquí tienes los problemas más frecuentes y cómo solucionarlos.

### ❌ "La página no carga" o "Error 500"

**Causa más común:** El frontend no puede hablar con el backend.

**Qué hacer:**
1. Abre la consola del navegador (F12 → pestaña "Console")
2. Busca errores que digan `VITE_API_URL` o `fetch` o `NetworkError`
3. Ve a Vercel → Project → Settings → Environment Variables
4. Verifica que `VITE_API_URL` tenga la URL completa de Railway (ej: `https://fiestaylista.up.railway.app`)
5. Ve a Railway → Logs → Deploy Logs y mira si hay errores

### ❌ "No puedo iniciar sesión"

**Causa más común:** Problema con la base de datos.

**Qué hacer:**
1. Ve a Railway → Variables
2. Verifica que `DATABASE_URL` esté bien escrita (empieza con `postgresql://...`)
3. Abre la terminal y prueba conectarte a la base de datos con esa URL
4. En Railway → Logs, busca errores que digan `database` o `connection`

### ❌ "No llegan los correos de verificación"

**Causa más común 1:** Resend no está configurado bien.

**Qué hacer:**
1. Ve a Railway → Variables
2. Verifica que `RESEND_API_KEY` esté escrita correctamente (empieza con `re_...`)
3. Ve a Resend → API Keys y verifica que la clave esté activa

**Causa más común 2:** Los correos van a SPAM.

**Qué hacer:**
1. Revisa la carpeta de SPAM en tu correo
2. Si están ahí, necesitas configurar un dominio en Resend (Paso 7.3)

### ❌ "El pago no se procesa"

**Causa más común 1:** Token incorrecto.

**Qué hacer:**
1. Ve a Railway → Variables
2. Verifica que `MERCADO_PAGO_ACCESS_TOKEN` empiece con `APP_USR` (producción) y no con `TEST` (prueba)

**Causa más común 2:** Webhook mal configurado.

**Qué hacer:**
1. Ve a Mercado Pago → Developers → Webhooks
2. Verifica que la URL sea: `https://TU-RAILWAY-URL/api/webhooks/mercadopago`
3. Verifica que los eventos seleccionados sean: `payment`, `subscription`, `preapproval`

**Causa más común 3:** Railway reinició y perdió la URL del webhook.

**Qué hacer:**
1. Railway a veces cambia la URL si reinicias el proyecto
2. Si la URL cambió, actualízala en Mercado Pago → Webhooks

### ❌ "Error al subir fotos"

**Causa más común:** No configuraste Cloudinary.

**Qué hacer:**
1. Sin Cloudinary, las fotos se guardan temporalmente en Railway
2. Cuando Railway reinicia, las fotos se pierden
3. Sigue el Paso 8 para configurar Cloudinary

### ❌ "El evento no se ve público" o "Evento no encontrado"

**Causa más común:** El evento está inactivo.

**Qué hacer:**
1. Ve al Dashboard → entra al evento
2. Busca el interruptor **"Activo"** o **"Evento activo"**
3. Asegúrate de que esté en **verde** (activo)
4. Si está en gris (inactivo), haz clic para activarlo

### ❌ "Error 502 Bad Gateway" en Railway

**Causa:** El backend se cayó o está reiniciando.

**Qué hacer:**
1. Espera 2-3 minutos y recarga la página
2. Ve a Railway → Logs para ver si hay errores
3. Si el error persiste, ve a Railway → Settings → **"Restart"** el proyecto

### ❌ "El cron de correos no funciona"

**Causa:** Los recordatorios automáticos (días 1, 3, 7, 14) no se ejecutan.

**Qué hacer:**
1. El backend tiene un sistema de cron que revisa cada hora
2. Si el backend se reinicia, el cron se reinicia solo
3. Verifica en Railway → Logs que aparezcan mensajes como:
   ```
   [Cron] Iniciando jobs programados...
   [Cron] Recordatorios: X eventos procesados
   ```
4. Si no ves estos mensajes, el backend puede estar fallando al iniciar

---

## Paso 14: Mantenimiento mensual

Una vez que la aplicación está funcionando, debes hacer pequeñas revisiones cada mes para asegurarte de que todo sigue bien.

### Cada semana:
- [ ] Revisa Railway → Logs → Deploy Logs para ver si hay errores
- [ ] Revisa Railway → Logs → App Logs para ver la actividad

### Cada mes:
- [ ] **Revisa el límite de Resend:** 100 correos gratis por día. Si los superas, debes comprar un plan en Resend
- [ ] **Revisa Railway:** Ve a la pestaña "Usage" para ver cuánto has gastado (~$5/mes)
- [ ] **Revisa Mercado Pago:** Ve al panel de Mercado Pago → "Actividad" para ver los pagos recibidos
- [ ] **Revisa la base de datos:** En Neon → Dashboard → "Storage" para ver el tamaño
- [ ] **Prueba la aplicación:** Haz un registro de prueba para verificar que todo funciona

### Cada 3 meses:
- [ ] **Actualiza el código:** Si el desarrollador te entrega nuevas versiones, repite los pasos de deploy
- [ ] **Revisa el dominio:** Si compraste dominio, verifica que no esté por vencer

### Cada año:
- [ ] **Renueva el dominio** si compraste uno
- [ ] **Revisa los precios** de los planes (Pro Mensual y Anual) y ajusta si es necesario

---

## 📋 Resumen de URLs importantes

| Qué es | URL |
|--------|-----|
| Página web (frontend) | `https://fiestaylista.vercel.app` (o tu dominio) |
| Servidor (backend) | `https://fiestaylista.up.railway.app` |
| Salud del backend | `https://fiestaylista.up.railway.app/api/health` |
| Estadísticas públicas | `https://fiestaylista.up.railway.app/api/public/stats` |
| Webhook de Mercado Pago | `https://fiestaylista.up.railway.app/api/webhooks/mercadopago` |
| Repositorio en GitHub | `https://github.com/tu-usuario/fiestaylista` |
| Base de datos (Neon) | `https://console.neon.tech` |
| Correos (Resend) | `https://resend.com` |
| Cobros (Mercado Pago) | `https://www.mercadopago.com.co/developers/panel` |

---

## 🎉 ¡Listo!

Tu aplicación **Fiesta y Lista** ya está en producción y funcionando.

Si tienes problemas que no aparecen en esta guía, contacta al desarrollador que te entregó el proyecto y muéstrale el error específico que ves en pantalla (puedes tomar una foto o un video del error).

---
*Última actualización: Mayo 2026*
