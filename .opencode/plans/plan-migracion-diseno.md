# PLAN DE MIGRACIÓN — NUEVO DISEÑO A REACT + TAILWIND

## Diagnóstico del diseño entregado por la IA

### Estado del diseño
- **15 archivos HTML** con estructura visual completa
- **31 capturas PNG** de referencia
- **1 documento de diseño** (DESIGN.md con tokens)
- **1 componente faltante**: Toasts (notificaciones)
- **0 componentes React** — todo es HTML/CSS plano

### Problemas a corregir (errores de la IA)

| # | Problema | Solución |
|---|----------|----------|
| 1 | Marca "Regali Colombia" en lugar de "Fiesta y Lista" | Reemplazar todos los textos por "Fiesta y Lista" |
| 2 | Marca "Celebration Luxe" en 4 componentes | Ídem |
| 3 | Marca "Celebrate Life" en Onboarding | Ídem |
| 4 | Marca "Regalo Ideal" en ErrorBoundary | Ídem |
| 5 | Color primario distinto (#b10e6b) en vez de #ec4899 | Mapear a rose-500 existente |
| 6 | Tipos de evento incompletos (solo 4-5 tipos, faltan Bautizo/Comunión) | Usar los 5 tipos actuales |
| 7 | Iconos Material Symbols en vez de emojis | Mantener emojis como está ahora |
| 8 | Imágenes placeholder de IA (aida-public URLs) | Reemplazar con sistema actual (gift SVG, Cloudinary) |
| 9 | Sin componente Toasts | Mantener sonner actual |
| 10 | Precios inconsistentes ($24.990 vs $14.99) | Mantener precios actuales |

---

## 1. MAPEO DE DESIGN TOKENS

### Colores: HTML nuevo → Tailwind actual

| Token en HTML nuevo | Hex | Tailwind actual | Equivale a |
|---------------------|-----|-----------------|------------|
| `primary` | #b10e6b | rose-500 (#ec4899) | NO es igual — debe cambiarse a `rose-500` |
| `primary-container` | #d23284 | rose-400 | debe cambiarse a `rose-400` |
| `secondary` | #904d00 | amber-700 | usar `amber-600` |
| `secondary-container` | #fe932c | amber-500 | usar `amber-500` |
| `surface` | #faf9f8 | `pearl` en index.css | IGUAL — mantener |
| `on-surface` | #1a1c1c | gray-900 | usar `gray-900` |
| `on-surface-variant` | #574048 | gray-500 | usar `gray-500` |
| `error` | #ba1a1a | red-600 | usar `red-500` |
| `outline` | #8b7079 | gray-400 | usar `gray-400` |
| `outline-variant` | #debec8 | gray-200 | usar `gray-200` |
| `inverse-surface` (dark) | #0B0F19 | `obsidian` | IGUAL — mantener |

### Tipografía: HTML nuevo → Tailwind actual

| Token nuevo | Font | Size | Tailwind actual |
|-------------|------|------|-----------------|
| `display-lg` | Outfit 900 | 48px/56px | `font-outfit font-black text-5xl` |
| `headline-lg` | Outfit 800 | 32px/40px | `font-outfit font-extrabold text-3xl` |
| `headline-md` | Outfit 700 | 24px/32px | `font-outfit font-bold text-2xl` |
| `body-lg` | Jakarta 400 | 18px/28px | `font-jakarta text-lg` |
| `body-md` | Jakarta 400 | 16px/24px | `font-jakarta text-base` |
| `label-md` | Jakarta 600 | 14px/20px | `font-jakarta font-semibold text-sm` |
| `caption` | Jakarta 500 | 12px/16px | `font-jakarta font-medium text-xs` |

### Glass classes: HTML nuevo → CSS actual

| Clase nueva | CSS | Clase actual en index.css |
|-------------|-----|---------------------------|
| `.glass` | `bg-white/70 backdrop-blur(12px) border-white/30` | `.glass-card` (blur-16) |
| `.glass.dark` | `bg-[#1a1c1c]/70 border-white/10` | `.dark .glass-card` |
| `.glow-rose` | `box-shadow: 0 10px 25px -5px rgba(177,14,107,0.2)` | `shadow-lg shadow-rose-500/20` |
| `.glow-primary` | `box-shadow: 0 10px 25px -5px rgba(177,14,107,0.3)` | `shadow-xl shadow-rose-500/30` |
| `.shimmer` | `linear-gradient gold` shimmer 2s | `.animate-shimmer` o `.animate-card-shine` |
| `glass-gold` (en HTML) | gold/amber glass | `.glass-card-gold` (ya existe) |

---

## 2. ESTRUCTURA HTML → COMPONENTE REACT

### Mapeo completo: HTML nuevo → React existente

| # | Carpeta HTML | Componente React actual | Archivo destino |
|---|-------------|------------------------|-----------------|
| 1 | `navbar_premium_componente` | NavbarPremium | `frontend/src/components/NavbarPremium.tsx` |
| 2 | `inicio` (PNG) | Landing | `frontend/src/pages/Landing.tsx` |
| 3 | `iniciar_sesi_n` (PNG) | Login | `frontend/src/pages/Login.tsx` |
| 4 | `registrarse` (PNG) | Register | `frontend/src/pages/Register.tsx` |
| 5 | `olvid_contrase_a` (PNG) | ForgotPassword | `frontend/src/pages/ForgotPassword.tsx` |
| 6 | `restablecer_contrase_a` (PNG) | ResetPassword | `frontend/src/pages/ResetPassword.tsx` |
| 7 | `verificar_email` (PNG) | VerifyEmail | `frontend/src/pages/VerifyEmail.tsx` |
| 8 | `planes_precios_mejorado` | Pricing | `frontend/src/pages/Pricing.tsx` |
| 9 | `layout_app_shell` + `mis_eventos_dashboard` | Dashboard | `frontend/src/pages/Dashboard.tsx` |
| 10 | `administrar_evento` | EventAdmin | `frontend/src/pages/EventAdmin.tsx` |
| 11 | `p_gina_del_evento` | EventGuest | `frontend/src/pages/EventGuest.tsx` |
| 12 | `onboarding` | Onboarding | `frontend/src/pages/Onboarding.tsx` |
| 13 | `404_no_encontrada` | NotFound | `frontend/src/pages/NotFound.tsx` |
| 14 | `error_global` | ErrorBoundary | `frontend/src/components/ErrorBoundary.tsx` |
| 15 | `mi_cuenta` (PNG) | Account | `frontend/src/pages/Account.tsx` |
| 16 | `t_rminos_y_condiciones` (PNG) | TermsConditions | `frontend/src/pages/TermsConditions.tsx` |
| 17 | `pol_tica_de_privacidad` (PNG) | PrivacyPolicy | `frontend/src/pages/PrivacyPolicy.tsx` |
| 18 | `pol_tica_de_cookies` (PNG) | CookiesPolicy | `frontend/src/pages/CookiesPolicy.tsx` |
| 19 | `derechos_arco` (PNG) | ArcoRights | `frontend/src/pages/ArcoRights.tsx` |
| 20 | `baby_shower_seo` (PNG) | SeoEventPage | `frontend/src/pages/SeoEventPage.tsx` |
| 21 | `boda_seo` (PNG) | SeoEventPage | `frontend/src/pages/SeoEventPage.tsx` |
| 22 | `cumplea_os_seo` (PNG) | SeoEventPage | `frontend/src/pages/SeoEventPage.tsx` |
| 23 | `bautizo_seo` (PNG) | SeoEventPage | `frontend/src/pages/SeoEventPage.tsx` |
| 24 | `primera_comuni_n_seo` (PNG) | SeoEventPage | `frontend/src/pages/SeoEventPage.tsx` |
| 25 | `componente_gift_card` | GiftCard | `frontend/src/components/GiftCard.tsx` |
| 26 | `componente_lluvia_de_sobres` | CashFundSection | `frontend/src/components/CashFundSection.tsx` |
| 27 | `componente_cookies` | CookieBanner | `frontend/src/components/CookieBanner.tsx` |
| 28 | `componente_share_buttons` | ShareButtons | `frontend/src/components/ShareButtons.tsx` |
| 29 | `componente_loading_spinner` | LoadingSpinner | `frontend/src/components/LoadingSpinner.tsx` |
| 30 | `componente_image_skeleton` | ImageWithSkeleton | `frontend/src/components/ImageWithSkeleton.tsx` |
| 31 | — | Layout | `frontend/src/components/Layout.tsx` |
| 32 | — | Toasts (sonner) | Sin cambios — mantener actual |

---

## 3. PLAN DE MIGRACIÓN — FASE POR FASE

### FASE 0: PREPARACIÓN (30 min)
- [ ] Hacer backup de `frontend/src/` completo
- [ ] Leer los HTML de referencia en `Diseño IA/`
- [ ] Abrir los PNG para referencia visual

### FASE 1: SISTEMA DE DISEÑO (1 hora)
- [ ] **`frontend/src/index.css`** — NO necesita cambios mayores, las clases glass y animaciones ya existen. Solo verificar que `.glass-card`, `.glass-card-premium`, `.glass-card-gold`, `.glass-ghost` coincidan con los estilos nuevos.

### FASE 2: COMPONENTES BASE CON HTML (5 horas, en orden)

#### 2.1 NavbarPremium (desde HTML)
- Mantener: lógica de auth, dark toggle, logo, CTAs
- Agregar del HTML: scroll effect (navbar se encoge), animación shimmer en CTA,
  efecto de auth switching, bento grid del hero section (si se integra landing)

#### 2.2 Layout
- Mantener: nav superior, bottom nav mobile, footer, outlet, dark mode
- Mejorar: estilos glass del nav (usar `glass-card`), animaciones en active states

#### 2.3 LoadingSpinner
- Mejorar del HTML: agregar variante con anillo giratorio, 
  variante full-screen con gift icon bouncing, texto "Cargando momentos especiales..."
- Mantener: props fullScreen, size, text

#### 2.4 ImageWithSkeleton
- Mejorar del HTML: 3 estados visuales (loading pulse, loaded reveal, error fallback)
  con especificaciones exactas del diseño (ratio 4:3, blur 12px)

#### 2.5 ShareButtons
- Mejorar del HTML: animación de "Copiado" con check_circle, colores exactos
  de botones (WhatsApp #22c55e, Twitter #60a5fa, Facebook #2563eb)

#### 2.6 GiftCard (desde HTML)
Actualizar estructura visual desde el HTML:
- **Disponible individual**: imagen en caja gradiente, badge categoría con color,
  botón "Regalar este detalle"
- **Disponible colectivo**: progress bar con shimmer, badge "Regalo Colectivo",
  botón "Contribuir al sueño"
- **Apartado**: imagen con blur/opacidad, overlay "Apartado con amor por [nombre]",
  texto tachado
- **Admin**: botones Liberar (bg-primary/10) + ✕
- Animación: cascade-item con stagger delay (del HTML)

#### 2.7 CashFundSection (desde HTML)
Actualizar desde el HTML:
- **Estado activo**: glass-card-gold, progress bar con shimmer, orbs de fondo
- **Badges seguridad**: Mercado Pago, 100% Garantizado, Directo al Anfitrión
- **Formulario**: 3 montos sugeridos (50K, 100K, 200K) + custom input
- **Contribuciones recientes**: chips con nombre + monto
- **Estado inactivo admin**: dashed border + botón "Activar por $4.99"
- **Estado inactivo guest**: "Este fondo ya no está activo"

#### 2.8 CookieBanner (desde HTML)
Actualizar:
- Banner: glass card, texto bilingüe, 3 botones (Configurar, Rechazar, Aceptar)
- Panel: toggles Esenciales (disabled), Analíticas, Preferencias

### FASE 3: PÁGINAS CON HTML (8 horas)

#### 3.1 Dashboard / Mis Eventos (desde HTML)
Actualizar estructura y JSX:
- Nav superior con logo gradiente + desktop nav + dark toggle
- Verification banner (ámbar, con icono mail)
- Header "Mis Eventos (X)" + botón "+ Nuevo Evento"
- Event cards en grid (1→2→3 columnas):
  - Barra superior color del tipo
  - Glass card con icono, título, badge BOOST
  - Stats "X regalos · Y fotos"
  - Progress bar con gradiente
  - Cash fund badge (si aplica)
  - Botones: Administrar (primario), Copiar link, Eliminar
- Skeleton loading (3 placeholders glass)
- Empty state: "🎉 ¿Qué evento quieres crear?" + grid tipos
- Modal crear evento (bottom-sheet mobile / centered desktop)
- Modal confirmación eliminar

#### 3.2 EventAdmin (desde HTML)
Reestructurar completamente:
- Top app bar con back arrow + "Administrar Evento" + settings
- Breadcrumb: "Mis Eventos > Nombre del evento"
- Header glass card: icono tipo, título editable, tipo editable, toggle activo/inactivo
- Boost badge con shimmer + botón "Boost $4.99"
- Acciones: Compartir + Vista previa
- Regalos sección: input con sugerencias, quick suggestions chips, gift list
- Fotos sección: grid 2 columnas, upload dashed area, delete button
- Boost modal con overlay + beneficios + botón pago verde

#### 3.3 EventGuest (desde HTML)
Reestructurar:
- Top app bar con menú + shopping bag icon
- Header inmersivo: gradiente temático, icono glass card, badge tipo, nombre, fecha/locación
- Toggle accesibilidad "Lectura Fácil"
- Share buttons
- Galería fotos (grid 2-3 columnas)
- Lluvia de Sobres (CashFundSection)
- Gift list: input nombre (sticky superior), category filters (sticky), grid GiftCards
- Sección "Ya apartados" con opacidad reducida
- Confetti overlay al apartar regalo

#### 3.4 Pricing (desde HTML)
Actualizar:
- Top app bar con logo + nav + "Crear Lista Gratis"
- Toggle Mensual/Anual con "Ahorra 33%"
- 2 tiers: Esencial (Free) vs Elite Pro ($14.99/mes)
- Desktop: cards lado a lado; Mobile: carrusel snap
- "Todas las listas incluyen": grid 6 items glass
- FAQ acordeón (5 preguntas)

#### 3.5 Onboarding (desde HTML)
Actualizar:
- Wizard 3 pasos con slide transitions
- Step 1: grid 6 tipos (Boda, Baby, Cumpleaños, Bautizo, Primera Comunión, Otro)
- Step 2: input nombre del evento (minimalista, border-bottom style)
- Step 3: resumen en glass card + "Crear mi primer evento"
- Step indicators: 3 dots con gradiente

#### 3.6 NotFound 404 (desde HTML)
Actualizar:
- Minimal nav (solo logo)
- Floating glass card con icono search animado
- "404" + "Página no encontrada"
- CTAs condicionales según auth
- Helpful links grid (Tendencias, Soporte)
- Parallax mouse effect

#### 3.7 ErrorBoundary (desde HTML)
Actualizar:
- Sin nav ni footer (focused error state)
- Glass panel flotante con 😕
- "Algo salió mal" + supportive copy
- "Recargar página" botón con refresh icon rotatorio
- Error ID mock
- Fondo pearl gradient con blobs

### FASE 4: PÁGINAS SIN HTML (SOLO PNG) (4 horas)

Estas páginas solo tienen referencia visual PNG. La estructura React actual
ya existe y es funcional. Se actualiza el JSX visual para coincidir con el PNG:

- [ ] **Login** — card glass centrada, logo, formulario
- [ ] **Register** — igual + barra fortaleza + checkboxes
- [ ] **ForgotPassword** — card centrada con estados form/sent
- [ ] **ResetPassword** — card centrada con estados form/done
- [ ] **VerifyEmail** — 3 estados (verifying/success/error)
- [ ] **Account** — grid 2 columnas, avatar, suscripción, datos personales
- [ ] **TermsConditions** — glass card, toggle ES/EN, secciones
- [ ] **PrivacyPolicy** — misma estructura
- [ ] **CookiesPolicy** — misma estructura + tabla cookies
- [ ] **ArcoRights** — 4 action cards, modal formulario, historial
- [ ] **SeoEventPage x5** — header con icono, beneficios grid, FAQ, CTA
- [ ] **Landing** — página completa con hero, orbs, typewriter, categorías,
  features, testimonials, CTA final. Esta es la más compleja SIN HTML,
  solo referencia PNG. Requiere reconstrucción visual desde la imagen.

### FASE 5: INTEGRACIÓN Y PRUEBAS (2 horas)

- [ ] Verificar que todos los imports funcionan
- [ ] Verificar dark mode en todas las páginas
- [ ] Verificar responsive (mobile/tablet/desktop)
- [ ] `npm run dev` sin errores
- [ ] Probar flujo completo: registro → onboarding → dashboard → crear evento → admin → guest view

---

## 4. RESUMEN DE CAMBIOS POR ARCHIVO

### Archivos a modificar (18):

| Archivo | Prioridad | Cambio principal |
|---------|-----------|------------------|
| `components/NavbarPremium.tsx` | Alta | Agregar scroll effect, auth switching |
| `components/Layout.tsx` | Alta | Mejorar glass styles, animaciones |
| `components/GiftCard.tsx` | Alta | Nueva estructura visual con 4 estados |
| `components/CashFundSection.tsx` | Alta | Nueva estructura con gold glass, shimmer |
| `components/CookieBanner.tsx` | Alta | Nuevo diseño panel + banner |
| `components/ShareButtons.tsx` | Media | Nuevas animaciones, colores exactos |
| `components/LoadingSpinner.tsx` | Media | Nuevas variantes spinner |
| `components/ImageWithSkeleton.tsx` | Media | 3 estados exactos |
| `components/ErrorBoundary.tsx` | Media | Nuevo diseño focused error |
| `pages/Dashboard.tsx` | Alta | Reestructurar cards, modales, empty state |
| `pages/EventAdmin.tsx` | Alta | Reestructurar layout completo |
| `pages/EventGuest.tsx` | Alta | Reestructurar header + gift list |
| `pages/Pricing.tsx` | Alta | Nuevo diseño tiers + FAQ |
| `pages/Onboarding.tsx` | Alta | Nuevo wizard 3 pasos |
| `pages/NotFound.tsx` | Media | Nuevo diseño con glass card |
| `pages/Register.tsx` | Media | Actualizar visual |
| `pages/Login.tsx` | Media | Actualizar visual |
| `pages/Account.tsx` | Media | Actualizar visual |

### Archivos a crear o reemplazar completamente (0):

Ninguno. Todos los componentes existen. Solo se actualizan.

### Archivos sin cambios (10):

| Archivo | Razón |
|---------|-------|
| `pages/Landing.tsx` | Sin HTML, solo PNG — se hará después |
| `pages/ForgotPassword.tsx` | Solo cambios visuales menores |
| `pages/ResetPassword.tsx` | Solo cambios visuales menores |
| `pages/VerifyEmail.tsx` | Solo cambios visuales menores |
| `pages/TermsConditions.tsx` | Solo cambios visuales menores |
| `pages/PrivacyPolicy.tsx` | Solo cambios visuales menores |
| `pages/CookiesPolicy.tsx` | Solo cambios visuales menores |
| `pages/ArcoRights.tsx` | Solo cambios visuales menores |
| `pages/SeoEventPage.tsx` | Solo cambios visuales menores |
| `index.css` | Ya compatible — sin cambios |

---

## 5. TIEMPO ESTIMADO TOTAL

| Fase | Tiempo |
|------|--------|
| Fase 0: Preparación | 30 min |
| Fase 1: Sistema de diseño | 1 hora |
| Fase 2: Componentes base (8) | 5 horas |
| Fase 3: Páginas con HTML (7) | 8 horas |
| Fase 4: Páginas sin HTML (12) | 4 horas |
| Fase 5: Integración y pruebas | 2 horas |
| **Total** | **~20.5 horas** |

---

## 6. RIESGOS Y MITIGACIONES

| Riesgo | Mitigación |
|--------|------------|
| El color primario #b10e6b no es igual al rose-500 actual | Mapear a rose-500 en Tailwind, ajustar sombras |
| Imágenes placeholder de IA no funcionan | Ya tenemos sistema de gift SVG y Cloudinary |
| Landing no tiene HTML solo PNG | Usar el diseño actual como base + ajustar visual desde PNG |
| La IA inventó nuevas features (RSVP, favoritos) | Ignorar, mantener funcionalidad actual |
| Bottom nav con 4 items en algunos diseños | Mantener 3 items actuales (Eventos, Planes, Cuenta) |
