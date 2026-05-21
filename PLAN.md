# Plan de Implementación — modasnancy

> Migración desde el proyecto base (tiendanancy / VizioCBC) hacia la nueva tienda **modasnancy**.
> Guatemala. CuboPago. Frontend PWA desde cero. Paneles admin existentes rediseñados.

---

## Estado Actual del Proyecto Base

- **Backend:** Node.js + Express + MariaDB (Docker).
- **Pasarela:** CuboPago (sandbox/production) con webhooks.
- **Autenticación:** JWT con roles: `admin`, `vendedor`, `operador_stock`, `operador_pedidos`.
- **Frontend público:** Vanilla HTML/CSS/JS (muy acoplado a la marca VizioCBC).
- **Paneles internos:** `admin`, `pedidos` (operador_pedidos), `stock` (operador_stock), `vendedor`.
- **Funcionalidades clave:** Catálogo, carrito, checkout (efectivo/tarjeta), promociones (sale, bundle 2x, wholesale), inventario con movimientos, auditoría, dashboard, clientes persistentes.
- **Infra:** Docker Compose con Nginx Proxy Manager, backups con cron.

---

## FASE 1: Limpieza Backend & Infra (Base Sólida)

### 1.1 Configuración Centralizada
- Crear `backend/config.js` exportando todas las constantes de negocio.
- Campos a extraer:
  - `BRAND_NAME`, `BRAND_EMAIL`, `BRAND_PHONE`, `BRAND_CITY`
  - `CURRENCY_SYMBOL`, `CURRENCY_CODE`
  - `SHIPPING_CAPITAL_COST`, `SHIPPING_CAPITAL_FREE_THRESHOLD`, `SHIPPING_DEPARTMENT_COST`
  - `CORS_ORIGINS`, `DATA_DIR`, `UPLOAD_LIMITS`
  - `CUBOPAGO_ENVIRONMENT`, `CUBOPAGO_BASE_URL`, `CUBOPAGO_API_KEY`
- Reemplazar strings hardcodeados en `server.js`, `payments-service.js`, `orders-service.js`, `products-service.js`, etc.

### 1.2 Docker / Infraestructura
- Renombrar en `docker-compose.yml`:
  - `name: tiendanancy` → `name: modasnancy`
  - Contenedores: `tiendanancy-*` → `modasnancy-*`
  - Redes: `tiendanancy-net` → `modasnancy-net`
  - Volumen: `tiendanancy_db_data` → `modasnancy_db_data`
- Asegurar que el contenedor de DB no tenga nombre de DB hardcodeado fuera del `.env`.

### 1.3 Variables de Entorno
- Crear `.env.example` limpio con placeholders y comentarios descriptivos.
- Eliminar `.env` del historial de git si alguna vez fue trackeado.
- `CORS_ORIGIN` → placeholder genérico.
- `ADMIN_TOKEN_SECRET` → placeholder, instrucciones para generar.

### 1.4 Nginx
- `nginx.conf`: reemplazar `server_name viziocbc.com www.viziocbc.com` → comentarios o placeholders.
- Revisar proxy_pass a nombres de contenedores actualizados.

### 1.5 Base de Datos
- `database/init.sql`: renombrar `tiendanancy_db` si aparece hardcodeado.
- Limpiar `database/seed_orders.sql` (datos reales de Guatemala).
- Revisar scripts de migración para que no referencien la marca antigua.

### 1.6 Seguridad & Limpieza de Repo
- Eliminar `google-site-verification` de todos los HTML.
- Verificar `.gitignore` incluye `.env`, `data/`, `node_modules/`.
- Eliminar archivos de backup grandes del repo si no son necesarios (ej: `backup_2026-04-30.sql`).
- Actualizar `backend/package.json`: `name`, `description`, eliminar referencias a la marca anterior.

---

## FASE 2: Nuevo Frontend PWA (Tienda Pública) — Desde Cero

### 2.1 Estructura PWA Base
- Crear `frontend/manifest.json`:
  - `short_name`: modasnancy, `name`: Modas Nancy
  - `start_url`: "/", `display`: standalone, `orientation`: portrait
  - theme_color, background_color, iconos 192x192 y 512x512 (placeholders).
- Crear `frontend/sw.js` (Service Worker):
  - **Cache-First**: CSS, JS, imágenes de productos.
  - **Network-First**: `/api/products` (catálogo offline con datos recientes).
  - **Stale-While-Revalidate**: HTML.
- Crear `frontend/offline.html`: página elegante de fallback sin conexión.
- Registrar el SW en un `frontend/js/pwa.js` incluido en todas las páginas.

### 2.2 Meta Tags para Instalación Móvil
- iOS Safari:
  - `apple-mobile-web-app-capable`: yes
  - `apple-mobile-web-app-status-bar-style`: black-translucent
  - `apple-mobile-web-app-title`: Modas Nancy
  - `apple-touch-icon` (múltiples tamaños).
  - Splash screens para iPhone/iPad (placeholders documentados).
- Android Chrome:
  - `theme-color`, `manifest` link.
  - Soporte para shortcuts en el manifest.

### 2.3 Sistema de Theming
- Expandir `frontend/css/theme-tokens.css` para que sea la única fuente de verdad:
  - Colores: primario, secundario, acento, éxito, error, fondos, textos.
  - Tipografías: fuentes de Google Fonts configurables.
  - Espaciados, radios de borde, sombras.
- Documentar en el archivo qué tokens cambiar para un nuevo cliente.

### 2.4 Componentes JS Reutilizables
- `frontend/js/config.js`: central de marca (nombre, email, moneda, zona de envíos).
- `frontend/js/api.js`: wrapper de fetch con base URL, manejo de errores, cache para offline.
- `frontend/js/cart.js`: lógica pura del carrito (localStorage, cálculos con promociones).
- `frontend/js/ui.js`: renderizado de tarjetas de producto, toast, modales.
- `frontend/js/navbar.js` refactorizado: leer marca y links desde `config.js`.
- `frontend/js/footer.js`: inyectar footer dinámico desde config (evita editar 10+ HTMLs).

### 2.5 Páginas a Construir (Mobile-First)
Todas las páginas deben partir de un `frontend/template-page.html` base con:
- Head mínimo (meta PWA, theme tokens, FontAwesome).
- Navbar placeholder.
- `<main>` vacío.
- Footer placeholder.
- Scripts: `pwa.js`, `config.js`, `api.js`, `cart.js`, `ui.js`, `navbar.js`, `footer.js`.

Páginas necesarias:
1. `index.html` — Hero, ofertas, trust badges, "descubre lo nuevo".
2. `catalogo.html` — Grid de productos, filtros por categoría.
3. `producto.html` — Detalle, imágenes, selector de talla/color, agregar al carrito.
4. `checkout.html` — Carrito, formulario cliente, selects Guatemala, métodos de pago (efectivo / CuboPago), resumen.
5. `ofertas.html` — Productos con `sale_enabled` o `bundle_2x_enabled`.
6. `envios.html`, `devoluciones.html`, `faq.html`, `privacidad.html`, `tallas.html`, `nosotros.html`.

### 2.6 Assets Nuevos
- Crear carpeta `frontend/assets/brand/` con archivos placeholder claros:
  - `logo.svg`, `logo-icon.svg`
  - `hero-1.webp` hasta `hero-5.webp`
  - `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`
- Documentar en `PLAN.md` qué archivo reemplazar con qué dimensión.

---

## FASE 3: Paneles de Administración (Rediseño + Limpieza)

### 3.1 Tokens CSS Unificados
- Crear `frontend/css/admin-theme.css` compartido por todos los paneles.
- Basado en `theme-tokens.css` pero con variables de densidad/admin.
- Eliminar duplicación de estilos entre `admin.html`, `pedidos.html`, `stock.html`, `vendedor.html`.

### 3.2 Limpieza de Marca en Paneles
- Reemplazar `VizioCBC` → `modasnancy` en todos los títulos, logos, textos.
- Reemplazar email `soporteviziocbc@gmail.com` → placeholder configurable.
- Reemplazar `Ciudad de Guatemala` → configurable desde `config.js`.
- Reemplazar copyright `2026 VizioCBC` → dinámico con año actual + `BRAND_NAME`.

### 3.3 Paneles a Mantener/Refactorizar
| Panel | HTML | JS | Roles | Notas |
|---|---|---|---|---|
| Admin | `admin.html` | `admin.js` | admin | Dashboard, productos, pedidos, clientes, usuarios, inventario, auditoría |
| Pedidos | `pedidos.html` | `pedidos.js` | admin, operador_pedidos | Tabs por estado, búsqueda, modales, acciones rápidas. Preservar tal cual funcionalidad. |
| Stock | `stock.html` | `stock.js` | admin, operador_stock | Inventario, alertas, movimientos, ajustes. |
| Vendedor | `vendedor.html` | `vendedor.js` | admin, vendedor | Nueva venta externa, mis pedidos. |

### 3.4 Optimizaciones
- Reducir CSS inline masivo en los HTMLs de paneles, mover a `admin-theme.css`.
- Unificar estructura de login (todos los paneles tienen login view similar).

---

## FASE 4: Guatemala & CuboPago (Preservar)

### 4.1 Guatemala
- **Mantener intactos:**
  - `frontend/js/guatemala-data.js` (departamentos/municipios).
  - Lógica de costos de envío Q25 capital / Q40 departamentos.
  - Selects en checkout y vendedor.
- Hacer que los costos de envío y el umbral de envío gratis lean de `config.js` en vez de estar hardcodeados en el HTML/JS.

### 4.2 CuboPago
- **Mantener intacta** la integración backend:
  - `backend/payments-service.js` (llamadas a la API de CuboPago).
  - `backend/server.js` endpoints: `POST /api/orders/:id/pay`, `POST /api/webhooks/cubopago`.
  - Webhook logs en base de datos.
- **Mantener intacta** la lógica frontend de checkout:
  - Validación de tarjeta en `checkout.js`.
  - Formato de inputs (número, expiración, CVC).
  - Flujo: crear orden → procesar pago → mostrar comprobante / reintentar / cambiar a efectivo.
- Extraer solo strings de marca/email en los mensajes de éxito/error hacia `config.js`.

---

## FASE 5: Testing & Documentación

### 5.1 Testing PWA
- [ ] Instalación en iOS Safari (Add to Home Screen).
- [ ] Instalación en Android Chrome (Add to Home Screen / Install prompt).
- [ ] Funcionamiento offline: catálogo visible, checkout detecta sin conexión.
- [ ] Splash screens visibles en iOS.
- [ ] Theme color consistente en la barra de estado (iOS/Android).

### 5.2 Testing Flujos de Negocio
- [ ] Compra con pago contra entrega.
- [ ] Compra con CuboPago (tarjeta aprobada).
- [ ] Compra con CuboPago fallida → reintentar → cambiar a efectivo.
- [ ] Carrito con promociones: sale, bundle 2x, wholesale.
- [ ] Panel Admin: CRUD productos, subir imágenes, cambiar visibilidad.
- [ ] Panel Pedidos: confirmar, enviar (con guía), cancelar.
- [ ] Panel Stock: ajustar inventario, ver alertas, registrar entrada.
- [ ] Panel Vendedor: crear pedido externo, ver "mis pedidos".

### 5.3 Documentación
- `README.md`: setup paso a paso (Docker, .env, iniciar).
- `AGENTS.md`: estructura de carpetas, convenciones de código, decisiones técnicas.
- Guía de "Reemplazo de Assets": lista exacta de archivos a cambiar para un nuevo cliente.
- Guía de "Configuración de Marca": qué editar en `config.js` y `.env`.

---

## Criterios de Aceptación Generales

1. No debe quedar ninguna referencia a `VizioCBC`, `viziocbc.com`, `tiendanancy` en el código fuente (salvo en este plan histórico).
2. El frontend público debe ser 100% funcional como PWA instalable.
3. Los paneles internos deben conservar toda su funcionalidad actual.
4. CuboPago debe seguir funcionando sin modificaciones en su lógica de comunicación.
5. La base de datos debe poder inicializarse limpiamente con `docker-compose up`.
6. Todo el branding (nombre, colores, logo, imágenes) debe ser reemplazable sin tocar lógica de negocio.
