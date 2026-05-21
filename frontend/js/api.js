/**
 * api.js
 * Wrapper de fetch con timeout, manejo de errores y cache offline.
 */

async function apiFetch(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

    try {
        const res = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Error ${res.status}`);
        }

        // Si es 204 No Content, retornar null
        if (res.status === 204) return null;

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await res.json();
        }
        return await res.text();
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('La solicitud tardo demasiado. Revisa tu conexion.');
        }
        if (!navigator.onLine) {
            throw new Error('Sin conexion a internet. Algunas funciones no estan disponibles.');
        }
        throw err;
    }
}

async function getProducts() {
    return apiFetch('/api/products');
}

async function getProduct(id) {
    return apiFetch(`/api/products/${encodeURIComponent(id)}`);
}

async function createOrder(payload) {
    return apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

async function payOrder(orderId, cardData, email) {
    return apiFetch(`/api/orders/${orderId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ card: cardData, ...(email ? { email } : {}) })
    });
}

async function getLivePackages() {
    return apiFetch('/api/live/packages');
}

async function getLivePackage(code) {
    return apiFetch(`/api/live/packages/${encodeURIComponent(code)}`);
}

async function createLiveOrder(payload) {
    return apiFetch('/api/live/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

window.apiFetch = apiFetch;
window.getProducts = getProducts;
window.getProduct = getProduct;
window.createOrder = createOrder;
window.payOrder = payOrder;
window.getLivePackages = getLivePackages;
window.getLivePackage = getLivePackage;
window.createLiveOrder = createLiveOrder;
