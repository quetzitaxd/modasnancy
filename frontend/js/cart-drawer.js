/**
 * cart-drawer.js
 * Cart drawer / modal component for modasnancy.com
 * Mobile: sidebar from right | Desktop: centered modal
 */

(function() {
    'use strict';

    // Inject drawer HTML if not present
    function ensureDrawerExists() {
        if (document.getElementById('cart-drawer')) return;

        const drawerHtml = `
            <div class="cart-drawer-overlay" id="cart-drawer-overlay" onclick="closeCartDrawer()"></div>
            <div class="cart-drawer" id="cart-drawer" aria-label="Carrito">
                <div class="cart-drawer__header">
                    <h3>Carrito</h3>
                    <button class="cart-drawer__close" onclick="closeCartDrawer()" aria-label="Cerrar carrito">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="cart-drawer__body" id="cart-drawer-body">
                    <div class="cart-drawer__empty" id="cart-drawer-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                        <h4>Tu carrito esta vacio</h4>
                        <p>Agrega productos para comenzar tu compra</p>
                        <button onclick="closeCartDrawer()">Seguir comprando</button>
                    </div>
                    <div id="cart-drawer-items" style="display:none;"></div>
                </div>
                <div class="cart-drawer__footer" id="cart-drawer-footer" style="display:none;">
                    <div class="cart-drawer__total">
                        <span>Total</span>
                        <span id="cart-drawer-total">Q0.00</span>
                    </div>
                    <a href="/checkout.html" class="cart-drawer__btn" id="cart-drawer-checkout-btn">
                        Proceder al pago
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </a>
                    <button class="cart-drawer__btn-outline" onclick="window.Cart && window.Cart.clear(); renderCartDrawer();">Vaciar carrito</button>
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = drawerHtml;
        document.body.appendChild(div);
    }

    function getCartItems() {
        return (window.Cart && window.Cart._items) || (window.getCart && window.getCart()) || [];
    }

    function getProducts() {
        return (window.Cart && window.Cart._products) || [];
    }

    function findProduct(id) {
        const products = getProducts();
        if (!products || !products.length) return null;
        return products.find(function(p) { return String(p.id) === String(id); }) || null;
    }

    function formatPrice(price) {
        if (typeof window.formatMoney === 'function') {
            return window.formatMoney(price);
        }
        return 'Q' + (Number(price) || 0).toFixed(2);
    }

    function safeText(str) {
        if (typeof window.safeText === 'function') {
            return window.safeText(str);
        }
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function safeImageUrl(url, fallback) {
        if (typeof window.safeImageUrl === 'function') {
            return window.safeImageUrl(url, fallback);
        }
        return url || fallback || '/assets/placeholder.svg';
    }

    window.openCartDrawer = function() {
        ensureDrawerExists();
        renderCartDrawer();
        const overlay = document.getElementById('cart-drawer-overlay');
        const drawer = document.getElementById('cart-drawer');
        if (overlay) overlay.classList.add('open');
        if (drawer) drawer.classList.add('open');
        document.body.style.overflow = 'hidden';
    };

    window.closeCartDrawer = function() {
        const overlay = document.getElementById('cart-drawer-overlay');
        const drawer = document.getElementById('cart-drawer');
        if (overlay) overlay.classList.remove('open');
        if (drawer) drawer.classList.remove('open');
        document.body.style.overflow = '';
    };

    function makeKey(item) {
        return (item.product_id || '') + '::' + (item.size || 'Unica') + '::' + (item.color_name || '');
    }

    function renderCartDrawer() {
        ensureDrawerExists();
        const items = getCartItems();
        const emptyEl = document.getElementById('cart-drawer-empty');
        const itemsContainer = document.getElementById('cart-drawer-items');
        const footer = document.getElementById('cart-drawer-footer');
        const totalEl = document.getElementById('cart-drawer-total');

        if (!items || items.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            if (itemsContainer) itemsContainer.style.display = 'none';
            if (footer) footer.style.display = 'none';
            if (totalEl) totalEl.textContent = formatPrice(0);
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';
        if (itemsContainer) itemsContainer.style.display = 'block';
        if (footer) footer.style.display = 'block';

        itemsContainer.innerHTML = '';
        let total = 0;

        items.forEach(function(item, index) {
            const product = findProduct(item.product_id);
            const price = product ? Number(product.price) : 0;
            const originalPrice = product ? Number(product.original_price) : 0;
            const qty = Number(item.quantity) || 1;
            const itemTotal = price * qty;
            total += itemTotal;

            const div = document.createElement('div');
            div.className = 'cart-drawer__item';
            div.innerHTML = `
                <div class="cart-drawer__item-img">
                    <img src="${safeImageUrl(item.image, '/assets/placeholder.svg')}" alt="${safeText(product ? product.name : 'Producto')}" loading="lazy" onerror="this.src='/assets/placeholder.svg'">
                </div>
                <div class="cart-drawer__item-info">
                    <div>
                        <div class="cart-drawer__item-name">${safeText(product ? product.name : 'Producto')}</div>
                        <div class="cart-drawer__item-meta">${item.color_name ? safeText(item.color_name) + ' / ' : ''}${safeText(item.size || 'Unica').toUpperCase()}</div>
                        <div class="cart-drawer__item-price">
                            ${formatPrice(price)}
                            ${originalPrice > price ? `<span class="cart-drawer__item-price-old">${formatPrice(originalPrice)}</span>` : ''}
                        </div>
                    </div>
                    <div class="cart-drawer__item-actions">
                        <div class="cart-drawer__qty">
                            <button type="button" onclick="window.CartDrawerUpdateQty(${index}, -1)" aria-label="Restar">-</button>
                            <span>${qty}</span>
                            <button type="button" onclick="window.CartDrawerUpdateQty(${index}, 1)" aria-label="Sumar">+</button>
                        </div>
                        <button class="cart-drawer__remove" type="button" onclick="window.CartDrawerRemove(${index})">Eliminar</button>
                    </div>
                </div>
            `;
            itemsContainer.appendChild(div);
        });

        if (totalEl) totalEl.textContent = formatPrice(total);
    }

    window.CartDrawerUpdateQty = function(index, delta) {
        const items = getCartItems();
        if (!items[index]) return;
        const item = items[index];
        if (window.Cart && typeof window.Cart.updateQty === 'function') {
            const key = makeKey(item);
            window.Cart.updateQty(key, delta);
            renderCartDrawer();
        }
    };

    window.CartDrawerRemove = function(index) {
        const items = getCartItems();
        if (!items[index]) return;
        const item = items[index];
        if (window.Cart && typeof window.Cart.remove === 'function') {
            const key = makeKey(item);
            window.Cart.remove(key);
            renderCartDrawer();
            if (typeof window.showToast === 'function') {
                window.showToast('Producto eliminado del carrito');
            }
        }
    };

    // Listen for cart updates
    document.addEventListener('cart:updated', function() {
        renderCartDrawer();
    });

    // Close on escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeCartDrawer();
        }
    });

    // Expose render function
    window.renderCartDrawer = renderCartDrawer;
})();
