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

    updateCartCount();
    setupCartSidebar();
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

// --- CART GLOBALS ---
function getCart() {
    try {
        const parsed = JSON.parse(localStorage.getItem('modasnancy_cart') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem('modasnancy_cart', JSON.stringify(cart));
    updateCartCount();
    renderSidebarCart();

    if (typeof renderCheckoutCart === 'function') {
        renderCheckoutCart();
    }
}

function updateCartCount() {
    const cart = getCart();
    const countEl = document.getElementById('cart-count');
    const bottomCountEl = document.getElementById('bottom-nav-cart-count');

    const totalItems = cart.reduce((acc, current) => {
        const qty = Number(current && current.quantity);
        return acc + (Number.isFinite(qty) && qty > 0 ? qty : 0);
    }, 0);

    if (countEl) {
        countEl.textContent = String(totalItems);
    }
    if (bottomCountEl) {
        bottomCountEl.textContent = String(totalItems);
        bottomCountEl.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) {
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast';

    const icon = document.createElement('i');
    icon.className = 'fas fa-check-circle';
    icon.style.color = 'var(--primary-color)';

    const text = document.createElement('span');
    text.textContent = toText(message);

    toast.appendChild(icon);
    toast.appendChild(document.createTextNode(' '));
    toast.appendChild(text);
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// --- SIDEBAR CART LOGIC ---
function setupCartSidebar() {
    const cartBtn = document.getElementById('cart-icon-btn');
    const closeBtn = document.getElementById('close-cart-btn');
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');

    if (!sidebar || !cartBtn || !closeBtn || !overlay) {
        return;
    }

    const openCart = () => {
        sidebar.classList.add('open');
        overlay.classList.add('show');
        renderSidebarCart();
    };

    const closeCart = () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    };

    cartBtn.addEventListener('click', (event) => {
        event.preventDefault();
        openCart();
    });

    closeBtn.addEventListener('click', closeCart);
    overlay.addEventListener('click', closeCart);

    window.openCartSidebar = openCart;

    // Conectar bottom nav carrito (móvil)
    const bottomCartBtn = document.getElementById('bottom-nav-cart');
    if (bottomCartBtn) {
        bottomCartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openCart();
        });
    }
}

function renderSidebarCart() {
    const cart = getCart();
    const container = document.getElementById('cart-sidebar-items');
    const totalEl = document.getElementById('cart-sidebar-total');

    if (!container || !totalEl) {
        return;
    }

    container.textContent = '';

    if (cart.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-center';
        empty.style.padding = '3rem 0';
        empty.style.color = '#888';
        empty.textContent = 'Tu bolsa esta vacia.';
        container.appendChild(empty);
        totalEl.textContent = 'Q0.00';
        return;
    }

    let total = 0;
    const qtyByProduct = {};
    cart.forEach(item => {
        const pid = item.product_id || item.sku;
        if (!qtyByProduct[pid]) qtyByProduct[pid] = 0;
        qtyByProduct[pid] += (Number(item.quantity) || 0);
    });

    cart.forEach((item, index) => {
        // Encontrar datos frescos del producto para evitar precios/promociones viejas
        const freshProduct = allProducts.find(p => p.id === item.product_id);
        
        // Usar datos frescos si están disponibles, sino usar lo del item (fallback)
        const price = toMoney(freshProduct ? freshProduct.price : item.price);
        const wholesale_enabled = freshProduct ? freshProduct.wholesale_enabled : item.wholesale_enabled;
        const wholesale_min_qty = freshProduct ? freshProduct.wholesale_min_qty : item.wholesale_min_qty;
        const wholesale_discount_percent = freshProduct ? freshProduct.wholesale_discount_percent : item.wholesale_discount_percent;

        const quantity = Number(item && item.quantity) > 0 ? Number(item.quantity) : 1;
        
        const pid = item.product_id || item.sku;
        const totalProductQty = qtyByProduct[pid] || 0;
        const isWholesale = wholesale_enabled && totalProductQty >= wholesale_min_qty && wholesale_discount_percent > 0;
        const bundleEnabled = freshProduct ? freshProduct.bundle_2x_enabled : item.bundle_2x_enabled;
        const bundlePrice = freshProduct ? freshProduct.bundle_2x_price : item.bundle_2x_price;
        const isBundle = bundleEnabled && bundlePrice > 0 && totalProductQty >= 2;

        let finalPrice = price;
        if (isWholesale) {
            finalPrice = price * (1 - (wholesale_discount_percent / 100));
        }

        let itemTotal = finalPrice * quantity;
        if (isBundle && !isWholesale) {
            const pairs = Math.floor(totalProductQty / 2);
            const singles = totalProductQty % 2;
            const totalBundlePrice = (pairs * bundlePrice) + (singles * price);
            finalPrice = totalBundlePrice / totalProductQty;
            itemTotal = finalPrice * quantity;
        }

        total += itemTotal;

        const row = document.createElement('div');
        row.className = 'sidebar-cart-item';

        const img = createSafeImage(item && item.image, IMAGE_FALLBACK_LOCAL, 'sidebar-cart-img', item && item.name);

        const details = document.createElement('div');
        details.className = 'sidebar-cart-details';

        const title = document.createElement('div');
        title.className = 'sidebar-cart-title';
        title.textContent = toText(item && item.name) || 'Producto';

        const meta = document.createElement('div');
        meta.className = 'sidebar-cart-meta';
        const sizeLabel = (toText(item && item.size) || 'Unica').toUpperCase();
        const colorLabel = toText(item && item.color_name);
        meta.textContent = colorLabel ? `Talla: ${sizeLabel} | Color: ${colorLabel}` : `Talla: ${sizeLabel}`;

        const priceEl = document.createElement('div');
        priceEl.className = 'sidebar-cart-price';

        const isOnSale = freshProduct ? freshProduct.sale_enabled : item.sale_enabled;
        const originalPrice = freshProduct ? freshProduct.original_price : item.original_price;

        if (isWholesale) {
            priceEl.innerHTML = `<span style="text-decoration: line-through; color: #999; font-size: 0.8rem; margin-right: 0.5rem;">Q${price.toFixed(2)}</span> Q${finalPrice.toFixed(2)}`;
            const badge = document.createElement('div');
            badge.style.fontSize = '0.7rem';
            badge.style.background = '#e84393';
            badge.style.color = 'white';
            badge.style.padding = '1px 5px';
            badge.style.borderRadius = '3px';
            badge.style.display = 'inline-block';
            badge.textContent = `-${wholesale_discount_percent}% Mayorista`;
            priceEl.appendChild(badge);
        } else if (isBundle) {
            priceEl.innerHTML = `<span style="text-decoration: line-through; color: #999; font-size: 0.8rem; margin-right: 0.5rem;">Q${price.toFixed(2)}</span> Q${finalPrice.toFixed(2)}`;
            const badge = document.createElement('div');
            badge.style.fontSize = '0.7rem';
            badge.style.background = '#fde68a';
            badge.style.color = '#b45309';
            badge.style.padding = '1px 5px';
            badge.style.borderRadius = '3px';
            badge.style.display = 'inline-block';
            badge.textContent = 'Oferta 2x';
            priceEl.appendChild(badge);
        } else if (isOnSale && originalPrice > 0) {
            priceEl.innerHTML = `<span style="text-decoration: line-through; color: #999; font-size: 0.8rem; margin-right: 0.5rem;">Q${toMoney(originalPrice).toFixed(2)}</span> Q${finalPrice.toFixed(2)}`;
            const badge = document.createElement('div');
            badge.style.fontSize = '0.7rem';
            badge.style.background = '#d63031';
            badge.style.color = 'white';
            badge.style.padding = '1px 5px';
            badge.style.borderRadius = '3px';
            badge.style.display = 'inline-block';
            badge.textContent = 'Oferta';
            priceEl.appendChild(badge);
        } else {
            priceEl.textContent = `Q${price.toFixed(2)}`;
        }

        const bottom = document.createElement('div');
        bottom.style.display = 'flex';
        bottom.style.justifyContent = 'space-between';
        bottom.style.alignItems = 'center';
        bottom.style.marginTop = 'auto';

        const qtyControls = document.createElement('div');
        qtyControls.className = 'qty-controls';

        const minusBtn = document.createElement('button');
        minusBtn.className = 'qty-btn';
        minusBtn.type = 'button';
        minusBtn.setAttribute('aria-label', `Disminuir cantidad de ${toText(item && item.name)}`);
        minusBtn.innerHTML = '<i class="fas fa-minus" style="font-size:10px" aria-hidden="true"></i>';
        minusBtn.addEventListener('click', () => updateSidebarQty(index, -1));

        const qtyText = document.createElement('span');
        qtyText.style.fontSize = '0.9rem';
        qtyText.style.fontWeight = '500';
        qtyText.style.width = '24px';
        qtyText.style.textAlign = 'center';
        qtyText.setAttribute('aria-label', `Cantidad: ${quantity}`);
        qtyText.textContent = String(quantity);

        const plusBtn = document.createElement('button');
        plusBtn.className = 'qty-btn';
        plusBtn.type = 'button';
        plusBtn.setAttribute('aria-label', `Aumentar cantidad de ${toText(item && item.name)}`);
        plusBtn.innerHTML = '<i class="fas fa-plus" style="font-size:10px" aria-hidden="true"></i>';
        plusBtn.addEventListener('click', () => updateSidebarQty(index, 1));

        qtyControls.appendChild(minusBtn);
        qtyControls.appendChild(qtyText);
        qtyControls.appendChild(plusBtn);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-item-btn';
        removeBtn.type = 'button';
        removeBtn.setAttribute('aria-label', `Eliminar ${toText(item && item.name)} del carrito`);
        removeBtn.textContent = 'Eliminar';
        removeBtn.addEventListener('click', () => removeSidebarItem(index));

        bottom.appendChild(qtyControls);
        bottom.appendChild(removeBtn);

        details.appendChild(title);
        details.appendChild(meta);
        details.appendChild(priceEl);
        details.appendChild(bottom);

        row.appendChild(img);
        row.appendChild(details);
        container.appendChild(row);
    });

    totalEl.textContent = `Q${total.toFixed(2)}`;
}

window.updateSidebarQty = function updateSidebarQty(index, delta) {
    const cart = getCart();

    if (!cart[index]) {
        return;
    }

    cart[index].quantity = Number(cart[index].quantity || 0) + delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }

    saveCart(cart);
};

window.removeSidebarItem = function removeSidebarItem(index) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
};

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
