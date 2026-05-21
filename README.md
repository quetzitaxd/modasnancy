# Modas Nancy

Tienda de comercio electrónico PWA para **Modas Nancy** (Guatemala). Venta de ropa y accesorios femeninos con envíos a todo el país.

- **Moneda:** Quetzales (Q / GTQ)
- **Pasarela de pago:** CuboPago (sandbox/producción)
- **Frontend:** PWA mobile-first, vanilla JS/HTML/CSS (estilo app nativa tipo Temu)
- **Backend:** Node.js + Express + MariaDB
- **Infra:** Docker Compose + Nginx Proxy Manager

---

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) o Docker Engine + Compose
- [Node.js](https://nodejs.org/) 18+ (solo para scripts de utilidad local)
- Git

---

## Setup paso a paso

### 1. Clonar y entrar al proyecto

```bash
git clone <repo-url> modasnancy.com
cd modasnancy.com
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
# Base de datos
DB_NAME=modasnancy_db
DB_USER=modasnancy_user
DB_PASSWORD=tu_password_seguro
DB_ROOT_PASSWORD=tu_root_password

# Seguridad
ADMIN_TOKEN_SECRET=genera_un_secreto_largo_aqui
ADMIN_USER=admin
ADMIN_PASS=admin123

# CuboPago
CUBOPAGO_ENVIRONMENT=sandbox
CUBOPAGO_API_KEY=tu_api_key_de_cubopago

# Marca (opcional — si no se define, usa valores por defecto)
BRAND_NAME=Modas Nancy
BRAND_EMAIL=soporte@modasnancy.com
BRAND_PHONE=+50200000000
BRAND_CITY=Ciudad de Guatemala
```

> **Generar ADMIN_TOKEN_SECRET:**  
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3. Levantar Docker

```bash
docker compose up --build -d
```

### 4. Verificar

| Servicio | URL |
|---|---|
| Tienda (Home) | http://localhost:8080 |
| API | http://localhost:8080/api/products |
| Panel Admin | http://localhost:8080/admin.html |
| Panel Pedidos | http://localhost:8080/pedidos.html |
| Panel Stock | http://localhost:8080/stock.html |
| Panel Vendedor | http://localhost:8080/vendedor.html |

### 5. Seed de productos de prueba

```bash
# Desde el host (requiere Node.js)
node scripts/seed-products.js        # Crea 12 productos
node scripts/download-images.js      # Descarga placeholders
```

---

## Credenciales de prueba (local)

| Rol | Usuario | Contraseña |
|---|---|---|
| Admin | `admin` | `admin123` |
| Vendedor | `vendedor` | `vendedor123` |
| Operador Pedidos | `pedidos` | `pedidos123` |
| Operador Stock | `stock` | `stock123` |

> **Nota:** En producción, cambia todas las contraseñas por defecto.

---

## Configuración de marca

Edita estos archivos para personalizar la tienda:

### Frontend

| Archivo | Qué cambiar |
|---|---|
| `frontend/js/config.js` | `BRAND_CONFIG`: nombre, email, teléfono, ciudad, redes sociales. `SHIPPING_CONFIG`: costos de envío. `CURRENCY_CONFIG`: símbolo y código de moneda. |
| `frontend/manifest.json` | `name`, `short_name`, `description`, `theme_color`, `background_color` |
| `frontend/assets/brand/logo-icon.svg` | Ícono principal (usado en favicon y PWA) |
| `frontend/assets/icons/icon-192x192.svg` | Ícono PWA 192x192 |
| `frontend/assets/icons/icon-512x512.svg` | Ícono PWA 512x512 |

### Backend

| Archivo | Qué cambiar |
|---|---|
| `backend/config.js` | Lee de variables de entorno con fallbacks. Edita `.env` para sobrescribir. |
| `.env` | `BRAND_NAME`, `BRAND_EMAIL`, `BRAND_PHONE`, `BRAND_CITY` |

### Nginx / Dominio

| Archivo | Qué cambiar |
|---|---|
| `nginx.conf` | Descomenta `server_name` y reemplaza `tudominio.com` por tu dominio real. Configura Nginx Proxy Manager para SSL. |

---

## Guía de reemplazo de assets

Para cambiar la imagen de marca completa, reemplaza estos archivos manteniendo las mismas dimensiones:

| Archivo | Dimensión | Uso |
|---|---|---|
| `frontend/assets/brand/logo-icon.svg` | Cuadrado | Favicon, PWA icon |
| `frontend/assets/icons/icon-192x192.svg` | 192x192 | PWA icon (home screen) |
| `frontend/assets/icons/icon-512x512.svg` | 512x512 | PWA icon (splash screen) |
| `frontend/assets/placeholder.svg` | Variable | Fallback cuando un producto no tiene imagen |
| `data/products/<id>/main.png` | 1:1 recomendado | Imágenes de productos (servidas por Nginx desde `/products/<id>/`) |

> **Tip:** Si cambias colores de marca, edita `frontend/css/theme-tokens.css` que es la única fuente de verdad para colores, fuentes y espaciado.

---

## Testing rápido

### API

```bash
# Listar productos
curl http://localhost:8080/api/products

# Login
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Crear orden (reemplaza <token>)
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"customer_name":"Test","phone":"55551234","address":"Calle 1","city":"Guatemala","department":"Guatemala","payment_method":"efectivo","items":[{"product_id":"vest-floral-01","variant_id":44,"sku":"vest-floral-01-rosa-l","quantity":1,"price":185,"name":"Vestido Floral","size":"l","color_name":"rosa","image":"/products/vest-floral-01/main.png"}]}'
```

### PWA (desde navegador)

1. Abre Chrome DevTools → Lighthouse → PWA
2. Verifica que el manifest sea válido
3. Verifica que el Service Worker esté registrado
4. En Application → Service Workers, haz "Offline" y verifica que el catálogo siga visible

---

## Estructura del proyecto

```
modasnancy.com/
├── backend/              # API REST Node.js
│   ├── server.js         # Entry point Express
│   ├── config.js         # Config central (marca, moneda, envíos, CuboPago)
│   ├── db.js             # Pool de conexiones MariaDB
│   ├── *-service.js      # Lógica de negocio
│   └── scripts/          # Migraciones y utilidades DB
├── frontend/             # Sitio público + paneles admin
│   ├── index.html        # Home (diseño Temu)
│   ├── catalogo.html     # Catálogo con filtros
│   ├── ofertas.html      # Solo productos en promoción
│   ├── producto.html     # Detalle de producto
│   ├── carrito.html      # Carrito
│   ├── checkout.html     # Checkout
│   ├── admin.html        # Panel admin
│   ├── pedidos.html      # Panel operador de pedidos
│   ├── stock.html        # Panel operador de stock
│   ├── vendedor.html     # Panel de vendedor externo
│   ├── css/              # Estilos (theme-tokens, admin-theme, admin-dashboard, home)
│   ├── js/               # Scripts vanilla JS modulares
│   ├── assets/           # Íconos, logo, imágenes de marca
│   ├── manifest.json     # PWA manifest
│   └── sw.js             # Service Worker
├── database/             # Schema inicial y migraciones
├── data/                 # Datos persistentes (montado en Docker)
│   └── products/         # Imágenes de productos por ID
├── scripts/              # Scripts de utilidad (host)
├── docker-compose.yml
├── nginx.conf
└── .env                  # Variables locales (NO commitear)
```

---

## Promociones soportadas

- **Sale:** `sale_enabled = 1` + `sale_price`. Precio tachado + % descuento.
- **Bundle 2x:** `bundle_2x_enabled = 1` + `bundle_2x_price`. Precio especial por par.
- **Wholesale:** `wholesale_enabled = 1` + `wholesale_min_qty` + `wholesale_discount_percent`. Descuento por volumen.

---

## Envíos

- **Capital (Guatemala):** Q25 — gratis en compras > Q500
- **Departamentos:** Q40 tarifa fija
- Configurable desde `frontend/js/config.js` y `backend/config.js`

---

## Soporte

- Email: `soporte@modasnancy.com`
- Ciudad: Ciudad de Guatemala
- País: Guatemala

---

*Última actualización: 2026-05-20*
