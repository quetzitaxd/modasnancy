/**
 * config.js
 * Configuracion centralizada del frontend para modasnancy.
 * Modifica estos valores para adaptar la tienda a un nuevo cliente.
 */

const BRAND_CONFIG = {
    NAME: 'Modas Nancy',
    SHORT_NAME: 'Modas Nancy',
    EMAIL: 'soporte@modasnancy.com',
    PHONE: '+50200000000',
    CITY: 'Ciudad de Guatemala',
    COUNTRY: 'Guatemala',
    INSTAGRAM: '#',
    FACEBOOK: '#',
    TIKTOK: '#',
    WHATSAPP: 'https://wa.me/50200000000'
};

const CURRENCY_CONFIG = {
    SYMBOL: 'Q',
    CODE: 'GTQ',
    DECIMALS: 2
};

const SHIPPING_CONFIG = {
    CAPITAL_COST: 25,
    CAPITAL_FREE_THRESHOLD: 500,
    DEPARTMENT_COST: 40,
    CAPITAL_DEPARTMENTS: ['Guatemala']
};

const API_CONFIG = {
    BASE_URL: '', // relativo al mismo dominio
    TIMEOUT_MS: 15000
};

const PWA_CONFIG = {
    CACHE_VERSION: 'v1',
    OFFLINE_PAGE: '/offline.html'
};

const CART_CONFIG = {
    STORAGE_KEY: 'modasnancy_cart',
    MAX_ITEMS: 50
};

// Helper para formatear dinero
function formatMoney(amount) {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed)) return `${CURRENCY_CONFIG.SYMBOL}0.00`;
    return `${CURRENCY_CONFIG.SYMBOL}${parsed.toFixed(CURRENCY_CONFIG.DECIMALS)}`;
}

// Helper para texto seguro
function safeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

// Helper para imagen segura
function safeImageUrl(value, fallback) {
    const raw = safeText(value);
    if (!raw) return fallback;
    if (raw.startsWith('/')) return raw;
    try {
        const url = new URL(raw, window.location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch { /* fallback */ }
    return fallback;
}

// Exportar para modulos (si se usa ES modules) o asignar a window
window.BRAND_CONFIG = BRAND_CONFIG;
window.CURRENCY_CONFIG = CURRENCY_CONFIG;
window.SHIPPING_CONFIG = SHIPPING_CONFIG;
window.API_CONFIG = API_CONFIG;
window.PWA_CONFIG = PWA_CONFIG;
window.CART_CONFIG = CART_CONFIG;
window.formatMoney = formatMoney;
window.safeText = safeText;
window.safeImageUrl = safeImageUrl;
