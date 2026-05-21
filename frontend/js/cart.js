/**
 * cart.js
 * Logica pura del carrito: localStorage, calculos, promociones.
 * Compatible con el backend de modasnancy.
 */

function getCart() {
    try {
        const parsed = JSON.parse(localStorage.getItem(CART_CONFIG.STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_CONFIG.STORAGE_KEY, JSON.stringify(cart));
    updateCartCount();
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
}

function clearCart() {
    localStorage.removeItem(CART_CONFIG.STORAGE_KEY);
    updateCartCount();
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: [] }));
}

function addToCart(item) {
    const cart = getCart();
    const existingIndex = cart.findIndex(
        (c) => c.sku === item.sku && c.size === item.size && c.color_name === item.color_name
    );

    if (existingIndex >= 0) {
        cart[existingIndex].quantity = (cart[existingIndex].quantity || 0) + (item.quantity || 1);
    } else {
        if (cart.length >= CART_CONFIG.MAX_ITEMS) {
            showToast('Carrito lleno. Elimina productos para agregar mas.');
            return false;
        }
        cart.push({
            product_id: item.product_id,
            sku: item.sku,
            name: item.name,
            price: item.price,
            size: item.size,
            color_name: item.color_name,
            color_hex: item.color_hex,
            image: item.image,
            quantity: item.quantity || 1,
            sale_enabled: item.sale_enabled,
            original_price: item.original_price,
            wholesale_enabled: item.wholesale_enabled,
            wholesale_min_qty: item.wholesale_min_qty,
            wholesale_discount_percent: item.wholesale_discount_percent,
            bundle_2x_enabled: item.bundle_2x_enabled,
            bundle_2x_price: item.bundle_2x_price
        });
    }

    saveCart(cart);
    showToast(`${safeText(item.name)} agregado al carrito`);
    return true;
}

function removeFromCart(index) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
}

function updateCartQty(index, delta) {
    const cart = getCart();
    if (!cart[index]) return;
    cart[index].quantity = (cart[index].quantity || 0) + delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }
    saveCart(cart);
}

function updateCartCount() {
    const cart = getCart();
    const total = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    document.querySelectorAll('[data-cart-count]').forEach((el) => {
        el.textContent = String(total);
        el.style.display = total > 0 ? 'flex' : 'none';
    });
}

/**
 * Calcula el total del carrito aplicando promociones activas.
 * @param {Array} [products] - Lista de productos frescos de la API (opcional)
 */
function calculateCartTotal(products) {
    const cart = getCart();
    if (cart.length === 0) return 0;

    const qtyByProduct = {};
    cart.forEach((item) => {
        const pid = item.product_id || item.sku;
        qtyByProduct[pid] = (qtyByProduct[pid] || 0) + (Number(item.quantity) || 0);
    });

    return cart.reduce((sum, item) => {
        const pid = item.product_id || item.sku;
        const totalQty = qtyByProduct[pid] || 0;

        // Usar datos frescos si estan disponibles
        const fresh = Array.isArray(products) ? products.find((p) => p.id === item.product_id) : null;
        const price = Number(fresh ? fresh.price : item.price) || 0;
        const wholesale_enabled = fresh ? fresh.wholesale_enabled : item.wholesale_enabled;
        const wholesale_min_qty = fresh ? fresh.wholesale_min_qty : item.wholesale_min_qty;
        const wholesale_discount_percent = fresh ? fresh.wholesale_discount_percent : item.wholesale_discount_percent;
        const bundle_2x_enabled = fresh ? fresh.bundle_2x_enabled : item.bundle_2x_enabled;
        const bundle_2x_price = fresh ? fresh.bundle_2x_price : item.bundle_2x_price;

        let finalPrice = price;

        if (wholesale_enabled && totalQty >= wholesale_min_qty && wholesale_discount_percent > 0) {
            finalPrice = price * (1 - wholesale_discount_percent / 100);
        } else if (bundle_2x_enabled && bundle_2x_price > 0 && totalQty >= 2) {
            const pairs = Math.floor(totalQty / 2);
            const singles = totalQty % 2;
            const totalBundle = pairs * bundle_2x_price + singles * price;
            finalPrice = totalBundle / totalQty;
        }

        return sum + finalPrice * (Number(item.quantity) || 1);
    }, 0);
}

// Inicializar contador al cargar
document.addEventListener('DOMContentLoaded', updateCartCount);

window.getCart = getCart;
window.saveCart = saveCart;
window.clearCart = clearCart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartQty = updateCartQty;
window.calculateCartTotal = calculateCartTotal;
