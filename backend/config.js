'use strict';

/**
 * Configuración centralizada del backend.
 * Toda constante de negocio, marca o infraestructura debe vivir aquí.
 */

const path = require('path');
const fs = require('fs');

// ── Helpers ─────────────────────────────────────────────────────────────────
const toSafeString = (value) => String(value || '').trim();
const toInt = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
};

// ── Paths ───────────────────────────────────────────────────────────────────
const resolveDataDir = () => {
    if (process.env.DATA_DIR) {
        return path.resolve(process.env.DATA_DIR);
    }
    const containerPath = path.resolve(__dirname, 'data');
    if (fs.existsSync(containerPath)) {
        return containerPath;
    }
    return path.resolve(__dirname, '..', 'data');
};

const DATA_DIR = resolveDataDir();
const TMP_DIR = path.join(DATA_DIR, 'tmp');

// ── Branding ────────────────────────────────────────────────────────────────
const BRAND = {
    NAME: toSafeString(process.env.BRAND_NAME) || 'Modas Nancy',
    EMAIL: toSafeString(process.env.BRAND_EMAIL) || 'soporte@modasnancy.com',
    PHONE: toSafeString(process.env.BRAND_PHONE) || '+50200000000',
    CITY: toSafeString(process.env.BRAND_CITY) || 'Ciudad de Guatemala',
    COUNTRY: toSafeString(process.env.BRAND_COUNTRY) || 'Guatemala'
};

// ── Currency ────────────────────────────────────────────────────────────────
const CURRENCY = {
    SYMBOL: toSafeString(process.env.CURRENCY_SYMBOL) || 'Q',
    CODE: toSafeString(process.env.CURRENCY_CODE) || 'GTQ'
};

// ── Shipping (Guatemala) ────────────────────────────────────────────────────
const SHIPPING = {
    CAPITAL_COST: toInt(process.env.SHIPPING_CAPITAL_COST, 25),
    CAPITAL_FREE_THRESHOLD: toInt(process.env.SHIPPING_CAPITAL_FREE_THRESHOLD, 500),
    DEPARTMENT_COST: toInt(process.env.SHIPPING_DEPARTMENT_COST, 25),
    CAPITAL_DEPARTMENTS: (process.env.SHIPPING_CAPITAL_DEPARTMENTS || 'Guatemala').split(',').map(s => s.trim()).filter(Boolean)
};

// ── CORS ────────────────────────────────────────────────────────────────────
const getCorsOrigins = () => {
    const raw = process.env.CORS_ORIGIN;
    if (!raw) return true;
    const origins = raw.split(',').map(s => s.trim()).filter(Boolean);
    return origins.length > 0 ? origins : true;
};

// ── Server ──────────────────────────────────────────────────────────────────
const SERVER = {
    PORT: toInt(process.env.PORT, 3000),
    NODE_ENV: toSafeString(process.env.NODE_ENV) || 'development',
    DB_ENABLED: toSafeString(process.env.DB_ENABLED) === 'true'
};

// ── Security ────────────────────────────────────────────────────────────────
const SECURITY = {
    ADMIN_TOKEN_SECRET: toSafeString(process.env.ADMIN_TOKEN_SECRET),
    ADMIN_TOKEN_TTL_SECONDS: toInt(process.env.ADMIN_TOKEN_TTL_SECONDS, 28800),
    ADMIN_USER: toSafeString(process.env.ADMIN_USER) || 'admin',
    ADMIN_PASS: toSafeString(process.env.ADMIN_PASS) || 'admin'
};

// ── Database ────────────────────────────────────────────────────────────────
const DB = {
    HOST: toSafeString(process.env.DB_HOST) || 'db',
    NAME: toSafeString(process.env.DB_NAME) || 'modasnancy_db',
    USER: toSafeString(process.env.DB_USER) || 'modasnancy_user',
    PASSWORD: toSafeString(process.env.DB_PASSWORD) || '',
    ROOT_PASSWORD: toSafeString(process.env.DB_ROOT_PASSWORD) || ''
};

// ── Uploads ─────────────────────────────────────────────────────────────────
const UPLOAD = {
    MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
    MAX_FILES: 10,
    ALLOWED_MIME: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
};
const RECEIPT_DIR = path.join(DATA_DIR, 'receipts');

// ── Rate Limits ─────────────────────────────────────────────────────────────
const RATE_LIMITS = {
    LOGIN: {
        windowMs: 15 * 60 * 1000,
        max: 5,
        skipSuccessfulRequests: true,
        keyPrefix: 'login'
    },
    ORDERS: {
        windowMs: 15 * 60 * 1000,
        max: 30,
        keyPrefix: 'orders'
    },
    GENERAL: {
        windowMs: 15 * 60 * 1000,
        max: 1000,
        keyPrefix: 'general',
        skipPaths: ['/api/login', '/api/orders', '/api/webhooks']
    }
};

// ── CuboPago ────────────────────────────────────────────────────────────────
const CUBOPAGO = {
    ENVIRONMENT: (toSafeString(process.env.CUBOPAGO_ENVIRONMENT) || 'sandbox').toLowerCase(),
    get BASE_URL() {
        if (process.env.CUBOPAGO_BASE_URL) {
            return process.env.CUBOPAGO_BASE_URL;
        }
        return this.ENVIRONMENT === 'production'
            ? 'api-payment.cubopago.com'
            : 'api-payment-sandbox.cubopago.com';
    },
    API_KEY: toSafeString(process.env.CUBOPAGO_API_KEY),
    TIMEOUT_MS: 60000
};

// ── Allowed Values ──────────────────────────────────────────────────────────
const ALLOWED = {
    ORDER_STATUSES: new Set(['pendiente', 'confirmado', 'enviado'])
};

module.exports = {
    BRAND,
    CURRENCY,
    SHIPPING,
    SERVER,
    SECURITY,
    DB,
    UPLOAD,
    RATE_LIMITS,
    CUBOPAGO,
    ALLOWED,
    PATHS: {
        DATA_DIR,
        TMP_DIR,
        RECEIPT_DIR,
        ORDERS_FILE: path.join(DATA_DIR, 'orders.json')
    },
    getCorsOrigins
};
