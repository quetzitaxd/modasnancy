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
    DEPARTMENT_COST: 25,
    CAPITAL_DEPARTMENTS: ['Guatemala']
};

// Detectar si está corriendo en ambiente de App Nativa (Capacitor)
const isNativeApp = !!(
    window.Capacitor ||
    (window.Android && typeof window.Android === 'object') ||
    (window.webkit && window.webkit.messageHandlers) ||
    window.location.origin.startsWith('capacitor://') ||
    (window.location.origin.startsWith('http://localhost') && !window.location.port) ||
    window.location.pathname.includes('android_asset')
);
window.isNativeApp = isNativeApp;

const API_CONFIG = {
    // Si corre como app nativa, apuntar al servidor de producción.
    BASE_URL: isNativeApp ? 'https://modasnancy.com' : '',
    TIMEOUT_MS: 15000
};

// Interceptar fetch global para redirigir rutas relativas al servidor en la App Nativa
if (isNativeApp) {
    const originalFetch = window.fetch;
    window.fetch = function (resource, init) {
        if (typeof resource === 'string' && resource.startsWith('/')) {
            resource = `https://modasnancy.com${resource}`;
        }
        return originalFetch(resource, init);
    };
}

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
    
    // Si es una ruta relativa en Capacitor, la cargamos desde el servidor de producción
    if (raw.startsWith('/')) {
        return isNativeApp ? `https://modasnancy.com${raw}` : raw;
    }
    try {
        const url = new URL(raw, window.location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
            // Resolver localhost o capacitor local origin al servidor real
            if (isNativeApp && (url.host === 'localhost' || url.protocol === 'capacitor:')) {
                return `https://modasnancy.com${url.pathname}${url.search}`;
            }
            return url.href;
        }
    } catch { /* fallback */ }
    return fallback;
}

// Exportar para modulos (si se usa ES modules) o asignar a window
window.isNativeApp = isNativeApp;
window.BRAND_CONFIG = BRAND_CONFIG;
window.CURRENCY_CONFIG = CURRENCY_CONFIG;
window.SHIPPING_CONFIG = SHIPPING_CONFIG;
window.API_CONFIG = API_CONFIG;
window.PWA_CONFIG = PWA_CONFIG;
window.CART_CONFIG = CART_CONFIG;
window.formatMoney = formatMoney;
window.safeText = safeText;
window.safeImageUrl = safeImageUrl;

