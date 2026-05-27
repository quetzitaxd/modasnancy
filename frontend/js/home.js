/**
 * home.js — Render de productos tipo Temu
 */

let allProducts = [];
let currentCategoryFilter = 'all';

const PRODUCT_FALLBACK = '/assets/placeholder.svg';

function getStarRating() {
    const stars = Math.floor(Math.random() * 2) + 4; // 4-5 estrellas
    return stars;
}

function getSoldCount() {
    const counts = ['200+', '500+', '1K+', '2K+', '4.8K+', '10K+'];
    return counts[Math.floor(Math.random() * counts.length)];
}

function renderStars(count) {
    let html = '';
    for (let i = 0; i < 5; i++) {
        if (i < count) {
            html += '<svg viewBox="0 0 24 24" fill="#fa8c16" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
        } else {
            html += '<svg viewBox="0 0 24 24" fill="#e8e8e8" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
        }
    }
    return html;
}

function renderTemuCard(product, index) {
    const card = document.createElement('div');
    card.className = 'product-temu';

    const firstImage = product?.images?.[0];
    const totalStock = Number(product?.total_stock) || 0;
    const isOutOfStock = totalStock === 0;

    // Random demo data
    const rating = getStarRating();
    const sold = getSoldCount();
    const isAd = index < 2; // Primeros 2 como "Anuncio"
    const isFlash = product?.sale_enabled && Math.random() > 0.5;

    // Badges on image
    let badgeHtml = '';
    if (product?.sale_enabled) {
        if (isFlash) {
            badgeHtml = `<div class="product-temu__badge-img product-temu__badge-img--flash"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> OFERTA</div>`;
        } else {
            badgeHtml = `<div class="product-temu__badge-img product-temu__badge-img--sale">OFERTA</div>`;
        }
    } else if (product?.bundle_2x_enabled) {
        badgeHtml = `<div class="product-temu__badge-img product-temu__badge-img--flash">2x1</div>`;
    }

    // Price
    let priceHtml = '';
    let discountHtml = '';
    if (product?.sale_enabled && product?.original_price > 0) {
        const discount = Math.round(((product.original_price - product.price) / product.original_price) * 100);
        priceHtml = `
            <span class="product-temu__price">${formatMoney(product.price)}</span>
            <span class="product-temu__price-old">${formatMoney(product.original_price)}</span>
        `;
        discountHtml = `<span class="product-temu__price-discount">-${discount}%</span>`;
    } else if (product?.bundle_2x_enabled && product?.bundle_2x_price > 0) {
        priceHtml = `<span class="product-temu__price">2x ${formatMoney(product.bundle_2x_price)}</span>`;
    } else {
        priceHtml = `<span class="product-temu__price">${formatMoney(product.price)}</span>`;
    }

    // Urgency text
    const urgencyHtml = product?.sale_enabled
        ? `<div class="product-temu__urgency"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Ultimo dia</div>`
        : '';

    card.innerHTML = `
        <div class="product-temu__img-wrap">
            ${badgeHtml}
            <img src="${safeImageUrl(firstImage, PRODUCT_FALLBACK)}" alt="${safeText(product.name)}" loading="lazy" onerror="this.src='${PRODUCT_FALLBACK}'">
            ${isAd ? '<span class="product-temu__ad-label">Anuncio</span>' : ''}
        </div>
        <div class="product-temu__info">
            <div class="product-temu__title">${safeText(product.name)}</div>
            <div class="product-temu__rating">
                <div class="product-temu__stars">${renderStars(rating)}</div>
                <div class="product-temu__sold">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fa8c16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    ${sold} vendidos
                </div>
            </div>
            <div class="product-temu__price-row">
                ${priceHtml}
                ${discountHtml}
            </div>
            ${urgencyHtml}
            <div class="product-temu__actions">
                <span style="font-size:0.6rem; color:#999;">${isOutOfStock ? 'Agotado' : 'En stock'}</span>
                <button class="product-temu__cart-btn" type="button" aria-label="Agregar al carrito" ${isOutOfStock ? 'disabled style="opacity:0.4;"' : ''} onclick="event.stopPropagation(); handleHomeCartClick('${encodeURIComponent(product.id)}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                </button>
            </div>
        </div>
    `;

    // Click en card va al producto
    card.addEventListener('click', (e) => {
        if (e.target.closest('.product-temu__cart-btn')) return;
        window.location.href = `/producto.html?id=${encodeURIComponent(product.id)}`;
    });

    return card;
}

function renderTemuGrid(products, containerId, emptyMessage) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(products) || products.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; padding:3rem 1rem; text-align:center; color:#999; font-size:var(--fs-body);">${safeText(emptyMessage)}</div>`;
        return;
    }

    products.forEach((product, index) => {
        container.appendChild(renderTemuCard(product, index));
    });
}

function hasRealVariants(product) {
    if (!Array.isArray(product?.variants) || product.variants.length === 0) return false;
    if (product.variants.length > 1) return true;
    const v = product.variants[0];
    const size = String(v?.size || '').toLowerCase();
    const color = String(v?.color_name || '').toLowerCase();
    // Si la unica variante es generica, tratar como sin variantes reales
    if (size === 'unica' && (color === 'estandar' || color === '' || color === 'unico')) return false;
    return true;
}

async function handleHomeCartClick(encodedId) {
    const id = decodeURIComponent(encodedId);
    try {
        const product = await getProduct(id);
        if (!product) { showToast('Producto no encontrado', 'error'); return; }

        if (hasRealVariants(product)) {
            openVariantModal(product);
            return;
        }

        // Producto sin variantes reales: agregar directo validando stock de la unica variante
        const variant = product.variants?.[0];
        const variantStock = typeof variant?.stock === 'number' ? Number(variant.stock) || 0 : Number(product.total_stock) || 0;
        if (variantStock === 0) { showToast('Producto agotado', 'error'); return; }

        const cartItems = window.getCart ? window.getCart() : [];
        const currentQty = cartItems
            .filter((i) => String(i.sku) === String(variant?.sku || product.id))
            .reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
        if (currentQty + 1 > variantStock) {
            showToast(`Solo hay ${variantStock} unidad${variantStock !== 1 ? 'es' : ''} disponible${variantStock !== 1 ? 's' : ''}`, 'error');
            return;
        }

        window.Cart.add({
            product_id: product.id,
            sku: variant?.sku || product.id,
            size: variant?.size || 'Unica',
            color_name: variant?.color_name || '',
            image: product.images?.[0] || '',
            quantity: 1,
        });
    } catch (err) {
        showToast('Error al agregar al carrito', 'error');
    }
}

function openVariantModal(product) {
    // Remover modal previo si existe
    closeVariantModal();

    const overlay = document.createElement('div');
    overlay.id = 'variant-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:2000;display:flex;align-items:flex-end;justify-content:center;';
    if (window.innerWidth >= 768) {
        overlay.style.alignItems = 'center';
    }

    const panel = document.createElement('div');
    panel.id = 'variant-modal-panel';
    panel.style.cssText = 'background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:1.25rem;box-shadow:0 -4px 24px rgba(0,0,0,0.15);max-height:85vh;overflow-y:auto;position:relative;';
    if (window.innerWidth >= 768) {
        panel.style.borderRadius = '20px';
        panel.style.maxHeight = '80vh';
    }

    const firstImage = product.images?.[0] || PRODUCT_FALLBACK;
    const variants = Array.isArray(product.variants) ? product.variants : [];

    // Extraer colores y tallas unicos
    const colors = [...new Set(variants.map((v) => v.color_name).filter(Boolean))];
    const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))];

    let selectedColor = '';
    let selectedSize = '';

    function getSelectedVariant() {
        return variants.find((v) => {
            const matchColor = !colors.length || !selectedColor || v.color_name === selectedColor;
            const matchSize = !sizes.length || !selectedSize || v.size === selectedSize;
            return matchColor && matchSize;
        });
    }

    function updateAvailability() {
        const v = getSelectedVariant();
        const avail = document.getElementById('variant-modal-avail');
        const btn = document.getElementById('variant-modal-add');
        if (!v) {
            if (avail) { avail.textContent = 'Selecciona talla y color'; avail.style.color = '#666'; }
            if (btn) btn.disabled = true;
            return;
        }
        const stock = Number(v.stock) || 0;
        if (stock === 0) {
            if (avail) { avail.textContent = 'Agotado'; avail.style.color = '#d63031'; }
            if (btn) btn.disabled = true;
        } else if (stock < 10) {
            if (avail) { avail.textContent = `\u00daltimas ${stock} unidades disponibles`; avail.style.color = '#e67e22'; }
            if (btn) btn.disabled = false;
        } else {
            if (avail) { avail.textContent = 'Disponible'; avail.style.color = '#27ae60'; }
            if (btn) btn.disabled = false;
        }
    }

    function buildChip(text, isColor, hex, isSelected, isDisabled, onClick) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.style.cssText = 'padding:0.5rem 1rem;border-radius:12px;border:1.5px solid #e5e7eb;background:#fff;font-size:0.85rem;font-weight:600;cursor:pointer;transition:all .15s;min-height:40px;display:inline-flex;align-items:center;gap:0.35rem;font-family:inherit;color:#374151;';
        if (isColor && hex) {
            chip.innerHTML = `<span style="width:14px;height:14px;border-radius:50%;border:1px solid rgba(0,0,0,0.1);display:inline-block;background:${hex};"></span> ${safeText(text)}`;
        } else {
            chip.textContent = safeText(text).toUpperCase();
        }
        if (isSelected) {
            chip.style.borderColor = '#f25ad9';
            chip.style.background = '#f25ad9';
            chip.style.color = '#fff';
        }
        if (isDisabled) {
            chip.disabled = true;
            chip.style.opacity = '0.35';
            chip.style.cursor = 'not-allowed';
        } else {
            chip.addEventListener('click', () => onClick(text));
        }
        return chip;
    }

    function renderSelectors() {
        const colorWrap = document.getElementById('variant-modal-colors');
        const sizeWrap = document.getElementById('variant-modal-sizes');
        if (colorWrap) {
            colorWrap.innerHTML = '';
            colors.forEach((color) => {
                const variantForColor = variants.find((v) => v.color_name === color);
                const hex = variantForColor?.color_hex || '#d1a3a4';
                const isSelected = selectedColor === color;
                // Deshabilitar si TODAS las variantes de este color (con la talla seleccionada) estan agotadas
                let anyAvailable = false;
                if (!selectedSize) {
                    anyAvailable = variants.some((v) => v.color_name === color && (Number(v.stock) || 0) > 0);
                } else {
                    anyAvailable = variants.some((v) => v.color_name === color && v.size === selectedSize && (Number(v.stock) || 0) > 0);
                }
                const isDisabled = !anyAvailable;
                colorWrap.appendChild(buildChip(color, true, hex, isSelected, isDisabled, (c) => {
                    selectedColor = c;
                    renderSelectors();
                    updateAvailability();
                }));
            });
        }
        if (sizeWrap) {
            sizeWrap.innerHTML = '';
            sizes.forEach((size) => {
                const isSelected = selectedSize === size;
                // Deshabilitar si TODAS las variantes de esta talla (con el color seleccionado) estan agotadas
                let anyAvailable = false;
                if (!selectedColor) {
                    anyAvailable = variants.some((v) => v.size === size && (Number(v.stock) || 0) > 0);
                } else {
                    anyAvailable = variants.some((v) => v.size === size && v.color_name === selectedColor && (Number(v.stock) || 0) > 0);
                }
                const isDisabled = !anyAvailable;
                sizeWrap.appendChild(buildChip(size, false, null, isSelected, isDisabled, (s) => {
                    selectedSize = s;
                    renderSelectors();
                    updateAvailability();
                }));
            });
        }
    }

    panel.innerHTML = `
        <button type="button" id="variant-modal-close" style="position:absolute;top:0.75rem;right:0.75rem;width:32px;height:32px;border-radius:50%;border:none;background:#f3f4f6;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#6b7280;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:1rem;padding-right:2rem;">
            <img src="${safeImageUrl(firstImage, PRODUCT_FALLBACK)}" alt="${safeText(product.name)}" style="width:64px;height:64px;object-fit:cover;border-radius:12px;background:#f9fafb;flex-shrink:0;" onerror="this.src='${PRODUCT_FALLBACK}'">
            <div>
                <div style="font-size:0.9rem;font-weight:700;color:#111827;line-height:1.3;">${safeText(product.name)}</div>
                <div style="font-size:0.85rem;font-weight:700;color:#f25ad9;margin-top:0.2rem;">${formatMoney(product.price)}</div>
            </div>
        </div>
        ${colors.length ? `
        <div style="margin-bottom:1rem;">
            <div style="font-size:0.8rem;font-weight:700;color:#374151;margin-bottom:0.5rem;">Color</div>
            <div id="variant-modal-colors" style="display:flex;flex-wrap:wrap;gap:0.5rem;"></div>
        </div>` : ''}
        ${sizes.length ? `
        <div style="margin-bottom:1rem;">
            <div style="font-size:0.8rem;font-weight:700;color:#374151;margin-bottom:0.5rem;">Talla</div>
            <div id="variant-modal-sizes" style="display:flex;flex-wrap:wrap;gap:0.5rem;"></div>
        </div>` : ''}
        <div style="display:flex;align-items:center;gap:0.5rem;margin:0.75rem 0;">
            <span id="variant-modal-avail" style="font-size:0.8rem;font-weight:600;">Selecciona talla y color</span>
        </div>
        <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
            <button type="button" id="variant-modal-add" disabled style="flex:1;height:44px;border-radius:999px;border:none;background:linear-gradient(135deg,#f25ad9,#d633c9);color:#fff;font-weight:700;font-size:0.9rem;cursor:pointer;box-shadow:0 4px 12px rgba(242,90,217,0.25);opacity:0.6;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity=this.disabled?'0.6':'1'">
                Agregar al carrito
            </button>
            <button type="button" id="variant-modal-view" style="flex:1;height:44px;border-radius:999px;border:1.5px solid #f25ad9;background:#fff;color:#f25ad9;font-weight:700;font-size:0.9rem;cursor:pointer;">
                Ver producto
            </button>
        </div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    renderSelectors();
    updateAvailability();

    document.getElementById('variant-modal-close').addEventListener('click', closeVariantModal);
    document.getElementById('variant-modal-view').addEventListener('click', () => {
        window.location.href = `/producto.html?id=${encodeURIComponent(product.id)}`;
    });
    document.getElementById('variant-modal-add').addEventListener('click', () => {
        const v = getSelectedVariant();
        if (!v) { showToast('Selecciona talla y color', 'error'); return; }
        const stock = Number(v.stock) || 0;
        if (stock === 0) { showToast('Variante agotada', 'error'); return; }

        const cartItems = window.getCart ? window.getCart() : [];
        const currentQty = cartItems
            .filter((i) => String(i.sku) === String(v.sku))
            .reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
        if (currentQty + 1 > stock) {
            showToast(`Solo hay ${stock} unidad${stock !== 1 ? 'es' : ''} disponible${stock !== 1 ? 's' : ''}`, 'error');
            return;
        }

        window.Cart.add({
            product_id: product.id,
            sku: v.sku,
            size: v.size || 'Unica',
            color_name: v.color_name || '',
            image: product.images?.[0] || '',
            quantity: 1,
        });
        closeVariantModal();
        showToast('Agregado al carrito');
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeVariantModal();
    });
}

function closeVariantModal() {
    const overlay = document.getElementById('variant-modal-overlay');
    if (overlay) {
        overlay.remove();
        document.body.style.overflow = '';
    }
}

async function loadHomeProducts() {
    const grid = document.getElementById('products-grid');
    const loader = document.getElementById('loading');

    try {
        allProducts = await getProducts();
        if (loader) loader.style.display = 'none';

        if (!Array.isArray(allProducts) || allProducts.length === 0) {
            if (grid) grid.innerHTML = '<div style="grid-column:1/-1; padding:3rem; text-align:center; color:#999;"><p>Nuevas colecciones llegando pronto.</p></div>';
            return;
        }

        const active = allProducts.filter((p) => p.is_active === true || p.is_active === 1);
        renderTemuGrid(active, 'products-grid', 'No hay productos disponibles.');
    } catch (err) {
        if (loader) loader.style.display = 'none';
        if (grid) grid.innerHTML = `<div style="grid-column:1/-1; padding:3rem; text-align:center;"><p>${err.message || 'Error al cargar.'}</p><button class="btn btn--sm btn--primary" onclick="window.location.reload()">Reintentar</button></div>`;
    }
}

function getActiveProducts() {
    return allProducts.filter((p) => p.is_active === true || p.is_active === 1);
}

function applyFilter(filter) {
    const active = getActiveProducts();
    let filtered = active;

    if (filter === 'sale') {
        filtered = active.filter((p) => p.sale_enabled || p.bundle_2x_enabled);
    } else if (filter === 'new') {
        filtered = active.slice(0, 6);
    } else if (filter !== 'all') {
        filtered = active.filter((p) => safeText(p.category).toLowerCase() === filter.toLowerCase());
    }

    renderTemuGrid(filtered, 'products-grid', 'No hay productos en esta categoria.');
}

// ─── Sidebar de Categorias ────────────────────────────────────────────────

const FILTER_NAMES = {
    all: 'Todos los productos',
    sale: 'Ofertas',
    new: 'Nuevos',
    vestidos: 'Vestidos',
    blusas: 'Blusas',
    faldas: 'Faldas',
    pantalones: 'Pants',
    accesorios: 'Accesorios'
};

function openCategorySidebar() {
    const sidebar = document.getElementById('cat-sidebar');
    const overlay = document.getElementById('cat-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeCategorySidebar() {
    const sidebar = document.getElementById('cat-sidebar');
    const overlay = document.getElementById('cat-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
}

function updateSidebarActive(filter) {
    document.querySelectorAll('.cat-sidebar__item').forEach((item) => {
        item.classList.toggle('active', item.dataset.filter === filter);
    });
}

function updateActiveFilterBar(filter) {
    const bar = document.getElementById('active-filter-bar');
    const name = document.getElementById('active-filter-name');
    if (!bar || !name) return;

    if (filter === 'all') {
        bar.style.display = 'none';
    } else {
        bar.style.display = 'flex';
        name.textContent = FILTER_NAMES[filter] || filter;
    }
}

function applyCategoryFilter(filter, btnElement) {
    currentCategoryFilter = filter;
    applyFilter(filter);
    updateSidebarActive(filter);
    updateActiveFilterBar(filter);
    closeCategorySidebar();

    // Limpiar busqueda si hay
    const input = document.getElementById('search-input');
    if (input) input.value = '';
}

function clearCategoryFilter() {
    applyCategoryFilter('all', null);
}

// Search
function setupSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;

    let timeout;
    input.addEventListener('input', (e) => {
        clearTimeout(timeout);
        const query = e.target.value.trim().toLowerCase();

        // Resetear filtro de categoria al buscar
        updateActiveFilterBar('all');
        document.querySelectorAll('.cat-sidebar__item').forEach((item) => {
            item.classList.toggle('active', item.dataset.filter === 'all');
        });

        if (!query) {
            applyFilter(currentCategoryFilter);
            return;
        }
        timeout = setTimeout(() => {
            const filtered = allProducts.filter((p) => {
                const name = safeText(p.name).toLowerCase();
                const cat = safeText(p.category).toLowerCase();
                return name.includes(query) || cat.includes(query);
            });
            renderTemuGrid(filtered, 'products-grid', 'No se encontraron productos.');
        }, 300);
    });
}

// Cerrar sidebar con Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCategorySidebar();
});

// Category circles (circulitos del home)
function setupCategoryCircles() {
    const circles = document.querySelectorAll('.cat-circle');
    console.log('[home.js] setupCategoryCircles: encontrados', circles.length, 'circulos');
    circles.forEach((circle) => {
        circle.addEventListener('click', () => {
            const filter = circle.dataset.category || 'all';
            console.log('[home.js] Click en categoria:', filter);
            currentCategoryFilter = filter;
            applyFilter(filter);
            updateActiveFilterBar(filter);

            // Visual feedback
            circles.forEach((c) => c.classList.remove('active'));
            circle.classList.add('active');

            // Limpiar busqueda
            const input = document.getElementById('search-input');
            if (input) input.value = '';
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadHomeProducts().then(() => {
        if (window.INITIAL_FILTER) {
            currentCategoryFilter = window.INITIAL_FILTER;
            applyFilter(window.INITIAL_FILTER);
            updateSidebarActive(window.INITIAL_FILTER);
            updateActiveFilterBar(window.INITIAL_FILTER);
        }
    });
    setupSearch();
    setupCategoryCircles();

    // Urgency banner marquee (JS-driven for guaranteed compatibility)
    const urgencyTrack = document.querySelector('.urgency-banner__track');
    if (urgencyTrack) {
        let pos = 0;
        function animateUrgency() {
            pos -= 0.7;
            const half = urgencyTrack.scrollWidth / 2;
            if (half > 0 && Math.abs(pos) >= half) {
                pos = 0;
            }
            urgencyTrack.style.transform = 'translateX(' + pos + 'px)';
            requestAnimationFrame(animateUrgency);
        }
        requestAnimationFrame(animateUrgency);
    }
});

window.allProducts = allProducts;
window.renderTemuGrid = renderTemuGrid;
window.addTemuToCart = handleHomeCartClick;
window.handleHomeCartClick = handleHomeCartClick;
window.applyFilter = applyFilter;
window.openCategorySidebar = openCategorySidebar;
window.closeCategorySidebar = closeCategorySidebar;
window.applyCategoryFilter = applyCategoryFilter;
window.clearCategoryFilter = clearCategoryFilter;
