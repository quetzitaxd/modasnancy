function cleanTrackingParameters() {
    if (window.history && window.history.replaceState) {
        try {
            const url = new URL(window.location.href);
            const paramsToRemove = ['fbclid', 'gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', '_ga'];
            let changed = false;
            
            for (const param of paramsToRemove) {
                if (url.searchParams.has(param)) {
                    url.searchParams.delete(param);
                    changed = true;
                }
            }
            
            if (changed) {
                window.history.replaceState(null, '', url.pathname + url.search + url.hash);
            }
        } catch (e) {
            console.warn('Could not clean tracking parameters', e);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cleanTrackingParameters();


    setupMobileMenu();

    const productsGrid = document.getElementById('products-grid');
    if (productsGrid) {
        loadProducts();
    }

    const saleGrid = document.getElementById('sale-products-grid');
    if (saleGrid) {
        loadSaleProducts();
    }
});

function setupMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navLinksEl = document.getElementById('nav-links');
    if (!hamburgerBtn || !navLinksEl) return;

    const updateExpanded = () => {
        const isOpen = navLinksEl.classList.contains('open');
        hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
    };

    hamburgerBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        navLinksEl.classList.toggle('open');
        updateExpanded();
    });

    // Cerrar menú al hacer click fuera
    document.addEventListener('click', (event) => {
        if (navLinksEl.classList.contains('open') && !navLinksEl.contains(event.target) && !hamburgerBtn.contains(event.target)) {
            navLinksEl.classList.remove('open');
            updateExpanded();
        }
    });
}

const IMAGE_FALLBACK_LOCAL = '/assets/placeholder.svg';
const IMAGE_FALLBACK_REMOTE = 'https://via.placeholder.com/80x100?text=Img';
const CARD_IMAGE_FALLBACK = 'https://via.placeholder.com/400x500?text=Sin+Imagen';

function toText(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).trim();
}

function toMoney(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return parsed;
}

function getSafeUrl(rawValue, fallback) {
    const value = toText(rawValue);
    if (!value) {
        return fallback;
    }

    if (value.startsWith('/')) {
        return value;
    }

    try {
        const url = new URL(value, window.location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
            return url.href;
        }
    } catch {
        // invalid URL, fallback below
    }

    return fallback;
}

function createSafeImage(src, fallback, className, alt) {
    const img = document.createElement('img');
    img.src = getSafeUrl(src, fallback);
    img.alt = toText(alt) || 'Imagen';
    img.loading = 'lazy';
    img.decoding = 'async';

    if (className) {
        img.className = className;
    }

    img.addEventListener('error', () => {
        const safeFallback = getSafeUrl(fallback, IMAGE_FALLBACK_REMOTE);
        if (img.src !== safeFallback) {
            img.src = safeFallback;
        }
    });

    return img;
}

function getProductLink(productId) {
    return `/producto.html?id=${encodeURIComponent(toText(productId))}`;
}

// --- CATALOG DATA FETCH ---
let allProducts = [];

async function loadProducts() {
    const loader = document.getElementById('loading');
    const errorMsg = document.getElementById('error-message');
    const grid = document.getElementById('products-grid');

    try {
        const res = await fetch('/api/products');
        if (!res.ok) {
            throw new Error('Error al cargar productos');
        }

        allProducts = await res.json();
        if (!Array.isArray(allProducts)) {
            allProducts = [];
        }

        if (loader) {
            loader.style.display = 'none';
        }

        if (allProducts.length === 0) {
            if (grid) {
                grid.textContent = '';
                const msg = document.createElement('p');
                msg.className = 'text-center';
                msg.style.gridColumn = '1/-1';
                msg.style.padding = '4rem';
                msg.style.color = '#888';
                msg.style.fontSize = '1.1rem';
                msg.textContent = 'Nuevas colecciones llegando pronto. Mantente atenta.';
                grid.appendChild(msg);
            }
            return;
        }

        renderProducts(allProducts, grid);
        setupFilters();
    } catch (err) {
        if (loader) {
            loader.style.display = 'none';
        }
        if (errorMsg) {
            errorMsg.style.display = 'block';
        }
    }
}

async function loadSaleProducts() {
    const loader = document.getElementById('sale-loading');
    const errorMsg = document.getElementById('sale-error-message');
    const grid = document.getElementById('sale-products-grid');

    try {
        const res = await fetch('/api/products');
        if (!res.ok) {
            throw new Error('Error al cargar ofertas');
        }

        const products = await res.json();
        if (!Array.isArray(products)) {
            throw new Error('Respuesta invalida');
        }

        const saleProducts = products.filter((p) => p.sale_enabled === true || p.sale_enabled === 1 || p.bundle_2x_enabled === true || p.bundle_2x_enabled === 1);

        if (loader) {
            loader.style.display = 'none';
        }

        if (saleProducts.length === 0) {
            if (grid) {
                grid.textContent = '';
                const msg = document.createElement('p');
                msg.className = 'text-center';
                msg.style.gridColumn = '1/-1';
                msg.style.padding = '3rem';
                msg.style.color = '#888';
                msg.style.fontSize = '1rem';
                msg.textContent = 'No hay ofertas activas en este momento. Vuelve pronto.';
                grid.appendChild(msg);
            }
            return;
        }

        renderProducts(saleProducts, grid);
    } catch (err) {
        if (loader) {
            loader.style.display = 'none';
        }
        if (errorMsg) {
            errorMsg.style.display = 'block';
        }
    }
}

function renderProducts(products, targetGrid) {
    const grid = targetGrid || document.getElementById('products-grid');
    if (!grid) {
        return;
    }

    grid.textContent = '';

    if (!Array.isArray(products) || products.length === 0) {
        const msg = document.createElement('p');
        msg.className = 'text-center';
        msg.style.gridColumn = '1/-1';
        msg.style.padding = '4rem';
        msg.style.color = '#888';
        msg.style.fontSize = '1.1rem';
        msg.textContent = 'No hay productos en esta categoria.';
        grid.appendChild(msg);
        return;
    }

    products.forEach((product) => {
        const card = document.createElement('div');
        card.className = 'product-card';

        const imageWrap = document.createElement('div');
        imageWrap.className = 'product-image-wrap';

        const imageLink = document.createElement('a');
        imageLink.href = getProductLink(product && product.id);
        imageLink.style.display = 'block';
        imageLink.style.height = '100%';

        const firstImage = product && product.images && product.images[0];
        const image = createSafeImage(firstImage, IMAGE_FALLBACK_LOCAL, 'product-image', product && product.name);
        image.addEventListener('error', () => {
            image.src = CARD_IMAGE_FALLBACK;
        });
        imageLink.appendChild(image);

        // Sale badge on image
        if (product && product.sale_enabled) {
            const saleBadge = document.createElement('span');
            saleBadge.textContent = 'OFERTA';
            saleBadge.className = 'sale-badge-premium';
            imageWrap.style.position = 'relative';
            imageWrap.appendChild(saleBadge);
        }
        if (product && product.bundle_2x_enabled) {
            const bundleBadge = document.createElement('span');
            bundleBadge.textContent = 'Oferta 2x';
            bundleBadge.className = 'sale-badge-premium';
            bundleBadge.style.background = '#fde68a';
            bundleBadge.style.color = '#b45309';
            bundleBadge.style.top = product.sale_enabled ? '40px' : '10px';
            imageWrap.style.position = 'relative';
            imageWrap.appendChild(bundleBadge);
        }

        const info = document.createElement('div');
        info.className = 'product-info';

        const titleLink = document.createElement('a');
        titleLink.href = getProductLink(product && product.id);
        titleLink.className = 'product-title';
        titleLink.textContent = toText(product && product.name) || 'Producto';

        const price = document.createElement('div');
        price.className = 'product-price';
        if (product && product.sale_enabled && product.original_price > 0) {
            price.innerHTML = `<span style="text-decoration: line-through; color: #999; font-size: 0.85rem; margin-right: 0.4rem;">Q${toMoney(product.original_price).toFixed(2)}</span><span style="color: #d63031;">Q${toMoney(product.price).toFixed(2)}</span>`;
        } else if (product && product.bundle_2x_enabled && product.bundle_2x_price > 0) {
            price.innerHTML = `<span style="color: #d63031; font-weight: 700;">Oferta 2x Q${toMoney(product.bundle_2x_price).toFixed(2)}</span><span style="color: #999; font-size: 0.8rem; margin-left: 0.4rem;">(Q${toMoney(product.price).toFixed(2)} c/u)</span>`;
        } else {
            price.textContent = `Q${toMoney(product && product.price).toFixed(2)}`;
        }

        const stockBadge = document.createElement('div');
        stockBadge.className = 'product-stock-badge';
        stockBadge.style.fontSize = '0.78rem';
        stockBadge.style.fontWeight = '700';
        stockBadge.style.marginTop = '0.4rem';
        stockBadge.style.marginBottom = '0.4rem';
        const totalStock = Number(product && product.total_stock) || 0;
        if (totalStock === 0) {
            stockBadge.textContent = 'Agotado';
            stockBadge.style.color = '#d63031';
        } else if (totalStock <= 3) {
            stockBadge.textContent = `¡Últimos ${totalStock} disponibles!`;
            stockBadge.style.color = '#e67e22';
        } else {
            stockBadge.style.display = 'none';
        }

        const action = document.createElement('a');
        action.href = getProductLink(product && product.id);
        if (totalStock === 0) {
            action.className = 'btn btn-outline btn-block disabled';
            action.style.opacity = '0.5';
            action.style.pointerEvents = 'none';
            action.textContent = 'Agotado';
        } else {
            action.className = 'btn btn-outline btn-block';
            action.textContent = 'Ver Detalles';
        }

        imageWrap.appendChild(imageLink);
        info.appendChild(titleLink);
        info.appendChild(price);
        info.appendChild(stockBadge);
        info.appendChild(action);

        card.appendChild(imageWrap);
        card.appendChild(info);
        grid.appendChild(card);
    });
}

function setupFilters() {
    const filtersContainer = document.getElementById('category-filters');
    if (!filtersContainer) {
        return;
    }

    const categories = [];
    const seen = new Set();
    const counts = {};

    allProducts.forEach((product) => {
        const category = toText(product && product.category).toLowerCase();
        if (!category) {
            return;
        }
        counts[category] = (counts[category] || 0) + 1;
        if (seen.has(category)) {
            return;
        }
        seen.add(category);
        categories.push(category);
    });
    categories.sort((a, b) => a.localeCompare(b));

    const createFilterButton = (label, value, active, count) => {
        const button = document.createElement('button');
        button.className = 'filter-btn';
        if (active) {
            button.classList.add('active');
        }
        button.setAttribute('data-filter', value);
        button.textContent = `${label} (${count})`;
        return button;
    };

    filtersContainer.textContent = '';
    filtersContainer.appendChild(createFilterButton('Todos', 'all', true, allProducts.length));
    categories.forEach((category) => {
        const label = category.charAt(0).toUpperCase() + category.slice(1);
        filtersContainer.appendChild(createFilterButton(label, category, false, counts[category]));
    });

    filtersContainer.querySelectorAll('.filter-btn').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            filtersContainer.querySelectorAll('.filter-btn').forEach((button) => button.classList.remove('active'));
            const target = event.currentTarget;
            target.classList.add('active');

            const filter = target.getAttribute('data-filter');
            if (filter === 'all') {
                renderProducts(allProducts);
                return;
            }

            renderProducts(allProducts.filter((product) => {
                const category = toText(product && product.category).toLowerCase();
                return category === filter;
            }));
        });
    });
}
