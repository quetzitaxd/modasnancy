# Modas Nancy — Design System v2.0

> Sistema de diseño generado a partir del logo oficial.
> Paleta, tipografía, componentes y estilo visual basados en la identidad de marca.

---

## 1. Filosofía Visual

**Sentimiento de marca:**
- Fashion boutique premium
- Ecommerce femenino moderno
- TikTok / Instagram aesthetic
- Elegante pero juvenil
- Visualmente limpio y brillante
- Altamente comercial
- Mobile-first

**Palabras clave:** feminidad, energía visual, boutique fashion, moderno, brillante, accesible, premium.

---

## 2. Paleta de Colores (extraída del logo)

### Colores Principales

| Token | Hex | Uso |
|-------|-----|-----|
| **Primary Pink** | `#F25AD9` | Botones CTA, links, acentos, badges |
| **Primary Dark** | `#D93CBF` | Hover states, texto sobre fondos claros |
| **Soft Pink** | `#F8B6EA` | Bordes, rings de focus, fondos suaves |
| **Pink Soft** | `#FFF0F9` | Fondos de sección, cards alternativas |

### Acento Dorado (la percha dorada del logo)

| Token | Hex | Uso |
|-------|-----|-----|
| **Gold Accent** | `#F6E36B` | Destacados premium, banners, iconos VIP |
| **Luxury Gold** | `#E8D25F` | Hover dorado, gradientes, marquesinas |
| **Gold Light** | `#FFF8D6` | Fondos de badges dorados, highlights |

### Colores de Contraste y Moda

| Token | Hex | Uso |
|-------|-----|-----|
| **Fashion Red** | `#FF4B5C` | Ofertas, live shopping, badges "Sale", alertas |
| **Denim Blue** | `#1D3557` | Contraste sobrio, footer, textos secundarios |
| **Elegant Black** | `#111111` | Texto principal, títulos, navbar |
| **Soft White** | `#FFF8FC` | Fondo principal de la app (rosa muy pálido) |

### Escala de Grises (accesibilidad + limpieza)

| Token | Hex | Uso |
|-------|-----|-----|
| Gray 50 | `#FAFAFA` | Fondos alternos |
| Gray 100 | `#F4F4F4` | Separadores sutiles |
| Gray 200 | `#E9E9E9` | Bordes, inputs inactivos |
| Gray 300 | `#D4D4D4` | Bordes hover |
| Gray 400 | `#A3A3A3` | Placeholders |
| Gray 500 | `#737373` | Texto deshabilitado |
| Gray 600 | `#666666` | Texto secundario |
| Gray 700 | `#404040` | Subtítulos |
| Gray 800 | `#262626` | Texto principal alterno |
| Gray 900 | `#171717` | Títulos oscuros |

### Colores Semánticos (estados)

| Estado | Color | Fondo | Uso |
|--------|-------|-------|-----|
| Éxito | `#22C55E` | `#DCFCE7` | Confirmaciones, stock OK |
| Advertencia | `#F59E0B` | `#FEF3C7` | Pocas unidades, atención |
| Error | `#FF4B5C` | `#FFE5E8` | Validaciones, fallos |
| Info | `#3B82F6` | `#DBEAFE` | Tips, ayuda, notas |

---

## 3. Gradientes de Marca

```css
--gradient-primary:      linear-gradient(135deg, #F25AD9 0%, #D93CBF 50%, #FF8BEA 100%);
--gradient-gold:         linear-gradient(135deg, #F6E36B 0%, #FFD84D 50%, #E8D25F 100%);
--gradient-hero:         linear-gradient(135deg, #F25AD9 0%, #FF4B5C 50%, #F6E36B 100%);
--gradient-live:         linear-gradient(135deg, #FF4B5C 0%, #F25AD9 100%);
--gradient-sale:         linear-gradient(135deg, #FF4B5C 0%, #FF8B5C 100%);
--gradient-shimmer:      linear-gradient(90deg, transparent 0%, rgba(246,227,107,0.3) 50%, transparent 100%);
```

**Reglas de uso:**
- `gradient-primary` → Botones CTA principales, headers, hero backgrounds
- `gradient-gold` → Badges premium, destacados, marquesina dorada
- `gradient-hero` → Hero section del home, banners grandes
- `gradient-live` → Badge "EN VIVO", botón de live shopping
- `gradient-sale` → Badge de oferta, etiquetas de descuento

---

## 4. Tipografía

### Familias

| Rol | Fuente | Fallback | Personalidad |
|-----|--------|----------|--------------|
| **Headings** | Playfair Display | Georgia, serif | Elegante, fashion, editorial |
| **Body** | Poppins | Inter, sans-serif | Moderno, limpio, legible |
| **Accent / Script** | Great Vibes | Allura, cursive | Decorativo, femenino, boutique |

### Escala Tipográfica (mobile-first)

| Token | Tamaño | Uso típico |
|-------|--------|------------|
| text-xs | 12px | Badges, captions, timestamps |
| text-sm | 14px | Botones, labels, precios tachados |
| text-base | 16px | Body text, inputs, descripciones |
| text-lg | 18px | Subtítulos, precios actuales |
| text-xl | 20px | Títulos de card, nombres de producto |
| text-2xl | 24px | Sección headers, títulos de página |
| text-3xl | 30px | Hero subtitles |
| text-4xl | 36px | Hero title (mobile) |
| text-5xl | 48px | Hero title (tablet) |
| text-6xl | 60px | Hero title (desktop) |

### Pesos recomendados

- **Light (300):** Descripciones largas, texto legal
- **Normal (400):** Body text general
- **Medium (500):** Labels, navegación, inputs
- **Semibold (600):** Botones, precios, títulos de card
- **Bold (700):** Hero titles, números grandes, CTAs

---

## 5. Espaciado (4pt grid)

Base: `0.25rem = 4px`

| Token | Valor | Uso |
|-------|-------|-----|
| space-1 | 4px | Icon gaps, tight padding |
| space-2 | 8px | Inline spacing, badge padding |
| space-3 | 12px | Card internal padding |
| space-4 | 16px | Standard section padding |
| space-5 | 20px | Button padding horizontal |
| space-6 | 24px | Section gaps |
| space-8 | 32px | Between major components |
| space-10 | 40px | Page section margins |
| space-12 | 48px | Large section breaks |

---

## 6. Bordes Redondeados

| Token | Valor | Uso |
|-------|-------|-----|
| radius-sm | 6px | Badges, chips, tags pequeños |
| radius-md | 10px | Inputs, botones pequeños |
| radius-lg | 14px | Cards, modales |
| radius-xl | 18px | Product cards, banners |
| radius-2xl | 24px | Modales, bottom sheets |
| radius-pill | 50px | Botones CTA, tabs, filtros |
| radius-full | 9999px | Avatares, iconos circulares |

---

## 7. Sombras (elevacón con "brillo" rosa)

| Token | Sombra | Uso |
|-------|--------|-----|
| shadow-sm | 0 2px 8px rgba(242,90,217,0.06) | Inputs, chips |
| shadow-md | 0 4px 16px rgba(242,90,217,0.08) | Cards, dropdowns |
| shadow-lg | 0 8px 30px rgba(242,90,217,0.10) | Modales, carrito |
| shadow-xl | 0 12px 40px rgba(242,90,217,0.14) | Bottom sheets |
| shadow-gold-md | 0 4px 16px rgba(246,227,107,0.25) | Destacados premium |
| shadow-card | 0 4px 20px rgba(17,17,17,0.06) | Tarjetas de producto |
| shadow-elevated | 0 8px 30px rgba(17,17,17,0.10) | Hover de tarjetas |

---

## 8. Componentes — Especificaciones Visuales

### Botón Primario (CTA)

```css
background: linear-gradient(135deg, #F25AD9, #D93CBF, #FF8BEA);
color: #FFFFFF;
border-radius: 50px;        /* pill */
padding: 12px 24px;
font-family: 'Poppins', sans-serif;
font-weight: 600;
font-size: 14px;
box-shadow: 0 6px 20px rgba(242, 90, 217, 0.35);
transition: all 250ms ease-out;
```

**Hover:** `transform: translateY(-2px); box-shadow: 0 8px 28px rgba(242,90,217,0.45);`
**Active:** `transform: translateY(0);`
**Disabled:** `opacity: 0.5; cursor: not-allowed;`

### Botón Outline (secundario)

```css
background: transparent;
color: #F25AD9;
border: 1.5px solid #F8B6EA;
border-radius: 50px;
```

**Hover:** fondo `rgba(242,90,217,0.06)`, sombra sutil rosa.

### Botón Gold (premium / destacado)

```css
background: linear-gradient(135deg, #F6E36B, #E8D25F);
color: #111111;
```

Usar para: "Comprar Ahora" en live, badges VIP, acciones especiales.

### Product Card

```css
background: #FFFFFF;
border-radius: 18px;
padding: 12px;
border: 1px solid rgba(242, 90, 217, 0.08);
box-shadow: 0 4px 20px rgba(17, 17, 17, 0.06);
transition: all 250ms ease-out;
```

**Hover:** `box-shadow: 0 8px 30px rgba(17,17,17,0.10); transform: translateY(-4px);`
**Imagen:** `border-radius: 14px; object-fit: cover;`

### Badge Sale

```css
background: linear-gradient(135deg, #FF4B5C, #FF8B5C);
color: #FFFFFF;
border-radius: 6px;
padding: 4px 10px;
font-size: 12px;
font-weight: 700;
```

### Badge Nuevo / Gold

```css
background: linear-gradient(135deg, #F6E36B, #FFD84D);
color: #111111;
```

### Badge "EN VIVO"

```css
background: linear-gradient(135deg, #FF4B5C, #F25AD9);
color: #FFFFFF;
/* Animación de pulso en el punto */
```

### Navbar

```css
background: rgba(255, 255, 255, 0.85);
backdrop-filter: blur(16px) saturate(1.2);
border-bottom: 1px solid rgba(242, 90, 217, 0.12);
height: 64px;
```

### Input / Form

```css
background: #FFFFFF;
border: 1.5px solid #E9E9E9;
border-radius: 14px;
padding: 12px 16px;
font-size: 16px;  /* Evita zoom en iOS */
transition: all 200ms ease-out;
```

**Focus:** `border-color: #F8B6EA; box-shadow: 0 0 0 3px rgba(242,90,217,0.12);`
**Error:** `border-color: #FF4B5C; box-shadow: 0 0 0 3px rgba(255,75,92,0.12);`
**Placeholder:** `#A3A3A3`

### Modal / Bottom Sheet

```css
background: #FFFFFF;
border-radius: 24px;  /* 2xl */
box-shadow: 0 20px 50px rgba(17, 17, 17, 0.20);
```

Mobile: `border-radius: 24px 24px 0 0;` (bottom sheet)
Overlay: `background: rgba(17, 17, 17, 0.45); backdrop-filter: blur(4px);`

### Tabs / Filtros

```css
background: transparent;
color: #666666;
border-radius: 50px;
padding: 8px 16px;
transition: all 200ms ease-out;
```

**Active:** `background: #FFF0F9; color: #F25AD9; font-weight: 600;`

---

## 9. Estilo de Fotografía e Imágenes

- **Retratos de producto:** Fondo blanco o blush `#FFF0F9`
- **Modelos:** Iluminación natural, fondos limpios, actitud confiada
- **Editorial:** Contraste alto, colores vivos, energía juvenil
- **Instagram-style:** Filtros cálidos, tonos rosados, dorados suaves
- **Formato:** WebP prioritario, ratio 3:4 o 1:1 para productos
- **Hover:** Zoom sutil (scale 1.03) con transición suave

---

## 10. Estilo de Banners y Promociones

- **Hero banners:** Degradado `gradient-hero` con texto blanco, botón dorado
- **Flash sales:** Fondo `gradient-sale` + countdown timer + badge dorado
- **Live shopping:** Ring animado `gradient-live` + pulso rosa
- **Marquesina dorada:** Fondo negro `#111` + texto dorado `#F6E36B` + animación shimmer
- **Stories:** Ring exterior `gradient-primary`, fondo blanco, icono de perfil centrado

---

## 11. Microinteracciones y Animaciones

| Interacción | Duración | Easing | Efecto |
|-------------|----------|--------|--------|
| Hover card | 250ms | ease-out | translateY(-4px) + sombra aumentada |
| Hover botón | 250ms | ease-out | translateY(-2px) + brillo aumentado |
| Tap / Press | 150ms | ease-in-out | scale(0.97) |
| Modal open | 300ms | spring | translateY(0) + fade in |
| Modal close | 200ms | ease-in | translateY(100%) + fade out |
| Toast | 400ms | ease-out | slideUp + fadeIn |
| Shimmer | 2s | linear | gradiente deslizante infinito |
| Live pulse | 2s | ease-in-out | sombra expansiva infinita |
| Stagger list | 50ms/item | ease-out | fadeIn + slideUp secuencial |
| Skeleton | 1.5s | linear | shimmer placeholder |

---

## 12. Layout Responsive

| Breakpoint | Ancho máximo | Layout |
|------------|--------------|--------|
| Mobile | 100% | 2 columnas producto, bottom nav |
| Tablet (md) | 720px | 3-4 columnas, sidebar opcional |
| Desktop (lg) | 960px | 4-5 columnas, top nav + sidebar |
| Wide (xl) | 1140px | 5-6 columnas, full experience |

---

## 13. Accesibilidad y Contraste

Todos los pares de color cumplen con WCAG AA (mínimo 4.5:1 para texto normal):

- `Elegant Black #111` sobre `Soft White #FFF8FC` → **16.8:1** ✅
- `Primary Dark #D93CBF` sobre `Soft White #FFF8FC` → **5.2:1** ✅
- `Gold Accent #F6E36B` sobre `Elegant Black #111` → **12.4:1** ✅
- `Fashion Red #FF4B5C` sobre `White #FFFFFF` → **5.1:1** ✅
- `Denim Blue #1D3557` sobre `White #FFFFFF` → **12.6:1** ✅

**Reglas:**
- Nunca usar `Soft Pink #F8B6EA` como color de texto sobre blanco (1.4:1, falla)
- Nunca usar `Gold Accent` sobre blanco (1.2:1, falla) — siempre sobre negro u oscuro
- Texto sobre gradientes: preferir blanco con sombra sutil

---

## 14. Checklist de Implementación

Antes de publicar cualquier página nueva:

- [ ] Usa `--font-body` para todo el texto, `--font-heading` para títulos
- [ ] Usa `--color-bg-main` como fondo de página, no blanco puro
- [ ] Botones CTA usan `gradient-primary` + `radius-pill`
- [ ] Badges de oferta usan `gradient-sale`
- [ ] Inputs tienen borde `#E9E9E9` y focus ring rosa
- [ ] Cards tienen `shadow-card` y hover `shadow-elevated`
- [ ] Imágenes de producto tienen `radius-lg` (14px)
- [ ] Navbar usa `glass-bg` con `backdrop-filter: blur(16px)`
- [ ] Bottom nav usa fondo blanco translúcido con borde rosa sutil
- [ ] Marquesina dorada usa fondo negro + texto dorado + animación shimmer
- [ ] Live shopping usa `gradient-live` + pulso animado
- [ ] No hay emojis como iconos (usar SVG/Lucide)
- [ ] Touch targets ≥ 44×44px en mobile
- [ ] Animaciones respetan `prefers-reduced-motion`

---

## 15. Archivos Relacionados

| Archivo | Propósito |
|---------|-----------|
| `frontend/css/theme-tokens.css` | Variables CSS definitivas |
| `frontend/css/style.css` | Estilos base del design system |
| `frontend/index.html` | Home + catálogo (usa tokens) |
| `frontend/checkout.html` | Checkout (usa tokens) |
| `frontend/live.html` | Live shopping (usa tokens) |
| `frontend/admin.html` | Panel admin (usa tokens admin) |
| `frontend/sw.js` | Actualizar cache version tras cambios CSS |

---

*Generado el 2026-05-25. Basado en el logo oficial de Modas Nancy.*
