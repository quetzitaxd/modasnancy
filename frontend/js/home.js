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
                <button class="product-temu__cart-btn" type="button" aria-label="Agregar al carrito" ${isOutOfStock ? 'disabled style="opacity:0.4;"' : ''} onclick="event.stopPropagation(); addTemuToCart('${encodeURIComponent(product.id)}')">
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

async function addTemuToCart(encodedId) {
    const id = decodeURIComponent(encodedId);
    try {
        const product = await getProduct(id);
        if (!product) { showToast('Producto no encontrado', 'error'); return; }

        const totalStock = Number(product.total_stock) || 0;
        if (totalStock === 0) { showToast('Producto agotado', 'error'); return; }

        const firstImage = product.images?.[0] || '';
        const variant = product.variants?.[0];

        addToCart({
            product_id: product.id,
            sku: variant?.sku || product.id,
            name: product.name,
            price: product.price,
            size: variant?.size || 'Unica',
            color_name: variant?.color_name || '',
            color_hex: variant?.color_hex || '',
            image: firstImage,
            quantity: 1,
            sale_enabled: product.sale_enabled,
            original_price: product.original_price,
            wholesale_enabled: product.wholesale_enabled,
            wholesale_min_qty: product.wholesale_min_qty,
            wholesale_discount_percent: product.wholesale_discount_percent,
            bundle_2x_enabled: product.bundle_2x_enabled,
            bundle_2x_price: product.bundle_2x_price
        });
    } catch (err) {
        showToast('Error al agregar al carrito', 'error');
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
});

window.allProducts = allProducts;
window.renderTemuGrid = renderTemuGrid;
window.addTemuToCart = addTemuToCart;
window.applyFilter = applyFilter;
window.openCategorySidebar = openCategorySidebar;
window.closeCategorySidebar = closeCategorySidebar;
window.applyCategoryFilter = applyCategoryFilter;
window.clearCategoryFilter = clearCategoryFilter;
