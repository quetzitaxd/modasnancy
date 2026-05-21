/**
 * ui.js
 * Componentes UI reutilizables: toast, loader, product cards, modals.
 * Diseñado para mobile-first PWA.
 */

const IMAGE_FALLBACK = '/assets/placeholder.svg';
const CARD_IMAGE_FALLBACK = 'https://via.placeholder.com/400x500?text=Sin+Imagen';

function createSafeImage(src, fallback, className, alt) {
    const img = document.createElement('img');
    img.src = safeImageUrl(src, fallback || IMAGE_FALLBACK);
    img.alt = safeText(alt) || 'Imagen';
    img.loading = 'lazy';
    img.decoding = 'async';
    if (className) img.className = className;
    img.addEventListener('error', () => {
        const fb = safeImageUrl(fallback, IMAGE_FALLBACK);
        if (img.src !== fb) img.src = fb;
    });
    return img;
}

function getProductLink(productId) {
    return `/producto.html?id=${encodeURIComponent(safeText(productId))}`;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    const icon = type === 'success'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

    toast.innerHTML = `${icon} <span>${safeText(message)}</span>`;
    container.appendChild(toast);

    // Forzar reflow para animacion
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 350);
    }, 3000);
}

function showLoader(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="loader" aria-label="Cargando..."><div class="loader__spinner"></div></div>';
}

function hideLoader(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const loader = container.querySelector('.loader');
    if (loader) loader.remove();
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div class="error-state"><p>${safeText(message)}</p><button class="btn btn--sm btn--primary" onclick="window.location.reload()">Reintentar</button></div>`;
}

/**
 * Renderiza una tarjeta de producto.
 */
function renderProductCard(product) {
    const card = document.createElement('article');
    card.className = 'product-card';

    const firstImage = product?.images?.[0];
    const totalStock = Number(product?.total_stock) || 0;
    const isOutOfStock = totalStock === 0;

    // Badge de promocion
    let badgeHtml = '';
    if (product?.sale_enabled) {
        badgeHtml = '<span class="product-card__badge product-card__badge--sale">OFERTA</span>';
    } else if (product?.bundle_2x_enabled) {
        badgeHtml = '<span class="product-card__badge product-card__badge--bundle">2x1</span>';
    }

    // Precio
    let priceHtml = '';
    if (product?.sale_enabled && product?.original_price > 0) {
        priceHtml = `
            <span class="product-card__price--original">${formatMoney(product.original_price)}</span>
            <span class="product-card__price--sale">${formatMoney(product.price)}</span>
        `;
    } else if (product?.bundle_2x_enabled && product?.bundle_2x_price > 0) {
        priceHtml = `
            <span class="product-card__price--bundle">2x ${formatMoney(product.bundle_2x_price)}</span>
            <span class="product-card__price--unit">${formatMoney(product.price)} c/u</span>
        `;
    } else {
        priceHtml = `<span class="product-card__price">${formatMoney(product.price)}</span>`;
    }

    // Stock badge
    let stockHtml = '';
    if (isOutOfStock) {
        stockHtml = '<span class="product-card__stock product-card__stock--out">Agotado</span>';
    } else if (totalStock <= 3) {
        stockHtml = `<span class="product-card__stock product-card__stock--low">Ultimos ${totalStock}</span>`;
    }

    card.innerHTML = `
        <a href="${getProductLink(product?.id)}" class="product-card__link" aria-label="${safeText(product?.name)}">
            <div class="product-card__image-wrap">
                ${badgeHtml}
                <img src="${safeImageUrl(firstImage, CARD_IMAGE_FALLBACK)}" 
                     alt="${safeText(product?.name)}" 
                     loading="lazy" 
                     decoding="async"
                     class="product-card__image"
                     onerror="this.src='${CARD_IMAGE_FALLBACK}'">
            </div>
            <div class="product-card__info">
                <h3 class="product-card__name">${safeText(product?.name)}</h3>
                <div class="product-card__price-wrap">${priceHtml}</div>
                ${stockHtml}
            </div>
        </a>
        <div class="product-card__actions">
            ${isOutOfStock
                ? '<button class="btn btn--block btn--disabled" disabled>Agotado</button>'
                : `<a href="${getProductLink(product?.id)}" class="btn btn--block btn--primary">Ver Detalles</a>`
            }
        </div>
    `;

    return card;
}

/**
 * Renderiza una grid de productos en un contenedor.
 */
function renderProductGrid(products, containerId, emptyMessage = 'No hay productos disponibles.') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!Array.isArray(products) || products.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>${safeText(emptyMessage)}</p></div>`;
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'products-grid';
    products.forEach((product) => {
        grid.appendChild(renderProductCard(product));
    });
    container.appendChild(grid);
}

// Exponer funciones globales
window.createSafeImage = createSafeImage;
window.getProductLink = getProductLink;
window.showToast = showToast;
window.showLoader = showLoader;
window.hideLoader = hideLoader;
window.showError = showError;
window.renderProductCard = renderProductCard;
window.renderProductGrid = renderProductGrid;
