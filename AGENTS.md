# AGENTS.md — modasnancy

> Contexto para agentes de código que trabajen en este proyecto.

---

## 1. Propósito del Proyecto

Tienda de comercio electrónico para **Modas Nancy** (Guatemala). Venta de ropa y accesorios femeninos con envíos a todo el país.

- **Moneda:** Quetzales (Q / GTQ)
- **Pasarela de pago:** CuboPago (sandbox/producción)
- **Frontend:** PWA mobile-first, vanilla JS/HTML/CSS (estilo app nativa tipo Temu)
- **Backend:** Node.js + Express + MariaDB
- **Infra:** Docker Compose + Nginx Proxy Manager

---

## 2. Estructura de Carpetas

```
modasnancy.com/
├── backend/              # API REST Node.js
│   ├── server.js         # Entry point Express
│   ├── config.js         # Config central (marca, moneda, envíos, CuboPago)
│   ├── db.js             # Pool de conexiones MariaDB
│   ├── *-service.js      # Lógica de negocio (products, orders, payments, etc.)
│   ├── scripts/          # Migraciones y utilidades DB
│   └── tests/            # Tests unitarios
├── frontend/             # Sitio público + paneles admin
│   ├── index.html        # Home (diseño Temu)
│   ├── catalogo.html     # Catálogo con filtros
│   ├── ofertas.html      # Solo productos en promoción
│   ├── producto.html     # Detalle de producto
│   ├── checkout.html     # Carrito + pago
│   ├── admin.html        # Panel admin (roles: admin)
│   ├── pedidos.html      # Panel operador de pedidos
│   ├── stock.html        # Panel operador de stock
│   ├── vendedor.html     # Panel de vendedor externo
│   ├── css/
│   │   ├── theme-tokens.css   # Variables de diseño (colores, fuentes, espaciado)
│   │   ├── style.css          # Base del design system
│   │   ├── home.css           # Estilos específicos del home/catalogo/ofertas Temu
│   │   ├── admin-theme.css    # Estilos compartidos por paneles admin
│   │   └── admin-dashboard.css # Estilos específicos del panel admin.html (KPIs, sidebar, gráficos)
│   ├── js/
│   │   ├── config.js     # Config frontend (marca, moneda, API)
│   │   ├── api.js        # Wrapper fetch con timeout y errores
│   │   ├── cart.js       # Carrito localStorage + cálculos promociones
│   │   ├── ui.js         # Toast, loaders, tarjetas de producto
│   │   ├── home.js       # Render Temu de productos, filtros, búsqueda
│   │   ├── pwa.js        # Registro Service Worker
│   │   ├── guatemala-data.js  # Departamentos/municipios + selects
│   │   ├── navbar.js     # Navbar dinámico (legacy, no usado en Temu)
│   │   ├── footer.js     # Footer dinámico (legacy)
│   │   └── *.js          # Admin panels (admin.js, pedidos.js, stock.js, vendedor.js)
│   ├── assets/
│   │   ├── brand/        # Logo, íconos, imágenes de marca
│   │   └── icons/        # Iconos PWA (192, 512)
│   ├── manifest.json     # PWA manifest
│   └── sw.js             # Service Worker (cache-first / network-first)
├── database/
│   ├── init.sql          # Schema inicial
│   ├── init-inventory.sql
│   └── migrar_*.sql      # Migraciones
├── data/                 # Datos persistentes (montado en Docker)
│   ├── products/         # Imágenes de productos por ID
│   └── banners.json
├── scripts/              # Scripts de utilidad (host)
│   ├── backup.sh
│   ├── seed-products.js
│   └── download-images.js
├── docker-compose.yml
├── nginx.conf
├── .env                  # Variables locales (NO commitear)
└── PLAN.md               # Plan completo de 5 fases
```

---

## 3. Convenciones de Código

### Frontend
- **Vanilla JS únicamente.** No React, Vue, ni frameworks.
- Cada página carga sus scripts en orden: `config.js` → `api.js` → `cart.js` → `ui.js` → específicos.
- Funciones globales expuestas vía `window.*` para compatibilidad entre scripts.
- **Mobile-first.** Todos los CSS nuevos deben partir de mobile y usar `@media (min-width: ...)` para tablet/desktop.
- **PWA:** Todo cambio en assets críticos requiere actualizar `sw.js` (cache version) y `manifest.json`.

### Backend
- `server.js` solo enruta; la lógica vive en `*-service.js`.
- `config.js` es la única fuente de verdad para constantes de negocio.
- Precios se manejan en centavos/enteros cuando es posible; la respuesta al frontend usa `Number.toFixed(2)`.
- Todo cambio en productos/pedidos/inventario debe quedar en `audit_logs`.

### Base de Datos (MariaDB)
- Tablas principales: `products`, `product_variants`, `inventory`, `orders`, `order_items`, `customers`, `users`, `audit_logs`.
- Inventario por SKU (no por producto).
- Productos tienen `sale_enabled`, `bundle_2x_enabled`, `wholesale_enabled` como flags.

---

## 4. Decisiones Técnicas Clave

### ¿Por qué vanilla JS en vez de framework?
- PWA ligera, carga instantánea en 3G.
- Menor complejidad para un equipo pequeño.
- Fácil de cachear todo en Service Worker.

### ¿Por qué diseño Temu en vez de e-commerce tradicional?
- Solicitud explícita del cliente tras evaluar el diseño anterior.
- Mayor conversión en mobile: cards 2-col, rating simulado, badges de urgencia, precios grandes.

### Imágenes de productos
- Se almacenan en `data/products/<product-id>/` como archivos estáticos.
- Nginx sirve `/products/` desde ese directorio.
- El backend lista archivos en la carpeta y devuelve URLs relativas (`/products/<id>/filename.jpg`).
- Para seedear productos sin subir imágenes reales, se pueden descargar placeholders a la carpeta correspondiente.

### Promociones
- **Sale:** `sale_enabled = 1` + `sale_price`. Se muestra precio tachado y % descuento.
- **Bundle 2x:** `bundle_2x_enabled = 1` + `bundle_2x_price`. Si el carrito tiene >= 2 unidades del mismo producto, aplica precio especial por par.
- **Wholesale:** `wholesale_enabled = 1` + `wholesale_min_qty` + `wholesale_discount_percent`. Descuento por volumen.

### Checkout
- **Efectivo (contra entrega):** Crea orden directamente.
- **Tarjeta (CuboPago):** Crea orden → procesa pago vía `/api/orders/:id/pay`.
- Envío: Q25 capital (gratis > Q500), Q40 departamentos. Hardcodeado en `backend/config.js` y `frontend/js/config.js`.

---

## 5. Cómo Levantar el Proyecto (Local)

```bash
# 1. Variables de entorno
cp .env.example .env
# Editar .env con credenciales locales

# 2. Levantar Docker
docker compose up --build -d

# 3. Verificar
# Frontend: http://localhost:8080
# API:      http://localhost:8080/api/products
```

### Credenciales de prueba (local)
| Rol | Usuario | Contraseña |
|---|---|---|
| Admin | `admin` | `admin123` |
| Vendedor | `vendedor` | `vendedor123` |
| Operador Pedidos | `pedidos` | `pedidos123` |
| Operador Stock | `stock` | `stock123` |

### Seed de productos de prueba
```bash
node scripts/seed-products.js        # Crea 12 productos
node scripts/download-images.js      # Descarga placeholders si faltan
```

---

## 6. Checklist para Nuevos Cambios

- [ ] ¿No quedó ninguna referencia a la marca anterior (`VizioCBC`, `viziocbc`, `tiendanancy`)?
- [ ] ¿Los precios usan `formatMoney()` del frontend y `config.js` del backend?
- [ ] ¿Las imágenes nuevas tienen fallback (`onerror` o `safeImageUrl`)?
- [ ] ¿El cambio funciona en mobile (<= 480px)?
- [ ] ¿No se rompió el Service Worker (revisar `sw.js` si se cambian assets críticos)?
- [ ] ¿Los paneles admin cargan `admin-theme.css` antes de estilos inline?
- [ ] ¿Se actualizó `AGENTS.md` si cambió la arquitectura o convenciones?

---

## 7. Contacto y Soporte

- Email marca: `soporte@modasnancy.com`
- Teléfono: `+50200000000` (placeholder)
- Ciudad: Ciudad de Guatemala
- País: Guatemala

---

*Última actualización: 2026-05-20 (sesion de reconstruccion Temu)*
