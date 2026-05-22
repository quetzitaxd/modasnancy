require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fsSync = require('fs');
const fs = fsSync.promises;
const rateLimit = require('express-rate-limit');

const config = require('./config');
const auth = require('./auth-service');
const productsService = require('./products-service');
const ordersService = require('./orders-service');
const inventoryService = require('./inventory-service');
const usersService = require('./users-service');
const auditService = require('./audit-service');
const customersService = require('./customers-service');
const dashboardService = require('./dashboard-service');
const packagesService = require('./packages-service');
const db = require('./db');

const app = express();
app.disable('x-powered-by');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `login:${req.ip}`,
    message: { error: 'Demasiados intentos de acceso. Espera 15 minutos e intenta de nuevo.' }
});

const ordersLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `orders:${req.ip}`,
    message: { error: 'Demasiadas solicitudes de pedido. Intenta mas tarde.' }
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `general:${req.ip}`,
    skip: (req) => {
        const url = req.path || '';
        return url === '/api/login' || url.startsWith('/api/orders') || url.startsWith('/api/webhooks');
    },
    message: { error: 'Limite de solicitudes superado. Intenta mas tarde.' }
});

app.use('/api/', generalLimiter);

const DATA_DIR = config.PATHS.DATA_DIR;
const TMP_DIR = config.PATHS.TMP_DIR;
// orders.json conservado solo como respaldo histórico (lectura manual si se necesita)
const ORDERS_FILE = config.PATHS.ORDERS_FILE;

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const toSafeString = (value) => String(value || '').trim();

const parsePositiveInt = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new HttpError(400, `${fieldName} invalido`);
    }

    return parsed;
};

const parseNonNegativeInt = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new HttpError(400, `${fieldName} invalido`);
    }

    return parsed;
};

const toMoneyCents = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new HttpError(400, `${fieldName} invalido`);
    }

    return Math.round(parsed * 100);
};

const normalizeColorHex = (value) => {
    const raw = toSafeString(value).toLowerCase();
    const match = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

    if (!match) {
        return '';
    }

    if (raw.length === 4) {
        return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
    }

    return raw;
};

app.use(cors({ origin: config.getCorsOrigins() }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

const uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, `${crypto.randomUUID()}${ext}`);
    }
});

const upload = multer({
    storage: uploadStorage,
    limits: {
        fileSize: config.UPLOAD.MAX_FILE_SIZE,
        files: config.UPLOAD.MAX_FILES
    },
    fileFilter: (req, file, cb) => {
        if (!config.UPLOAD.ALLOWED_MIME.has(file.mimetype)) {
            return cb(new HttpError(400, 'Solo se permiten imagenes JPG, PNG, WEBP o GIF'));
        }

        cb(null, true);
    }
});

const uploadProductImages = (req, res, next) => {
    // Si la petición es JSON, no procesamos con multer
    if (!req.is('multipart/form-data')) {
        return next();
    }

    upload.array('images', 10)(req, res, (err) => {
        if (!err) {
            return next();
        }

        const status = err instanceof HttpError ? err.status : 400;
        return res.status(status).json({ error: err.message || 'Error en la carga de archivos' });
    });
};

const ensureStorage = async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(TMP_DIR, { recursive: true });
    await productsService.ensureDirectories();
    await usersService.ensureAdminExists();
};

// ─── Auth endpoints ───────────────────────────────────────────────────────────

app.post('/api/login', loginLimiter, async (req, res) => {
    const username = toSafeString(req.body?.username);
    const password = toSafeString(req.body?.password);

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contrasena son requeridos' });
    }

    const user = await auth.authenticateAnyUser(username, password);
    if (!user) {
        return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = auth.createToken({
        sub: user.username,
        sub_id: user.id || null,
        name: user.name,
        role: user.role
    });

    return res.json({ token, expires_in: auth.TOKEN_TTL_SECONDS, role: user.role, name: user.name });
});

app.post('/api/refresh', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    try {
        const oldToken = authHeader.slice(7).trim();
        const payload = auth.verifyToken(oldToken);

        const newToken = auth.createToken({
            sub: payload.sub,
            sub_id: payload.sub_id || null,
            name: payload.name,
            role: payload.role
        });

        return res.json({ token: newToken, expires_in: auth.TOKEN_TTL_SECONDS });
    } catch {
        return res.status(401).json({ error: 'Token invalido o expirado' });
    }
});

// ─── Products endpoints ───────────────────────────────────────────────────────

app.get('/api/products', async (req, res) => {
    try {
        let products = await productsService.getAllProducts();

        let isAdmin = false;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            try {
                const payload = auth.verifyToken(token);
                if (payload && (payload.role === 'admin' || payload.role === 'vendedor' || payload.role === 'operador_stock')) {
                    isAdmin = true;
                }
            } catch {
                // ignore invalid token for public listing
            }
        }

        if (!isAdmin) {
            products = products.filter((p) => p.is_active === true || p.is_active === 1 || p.is_active === 'true');
        }

        return res.json(products);
    } catch {
        return res.status(500).json({ error: 'Error al cargar productos' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await productsService.getProduct(req.params.id);

        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        return res.json(product);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

app.post('/api/products', auth.requireAuth(['admin','operador_stock']), uploadProductImages, async (req, res) => {
    try {
        const id = toSafeString(req.body?.id);
        const name = toSafeString(req.body?.name);

        if (!id || !name) {
            throw new HttpError(400, 'id y name son requeridos');
        }

        let created = await productsService.createProduct(id, {
            name,
            price: req.body?.price,
            description: req.body?.description,
            sizes: req.body?.sizes,
            category: req.body?.category,
            colors: req.body?.colors,
            variants: req.body?.variants,
            wholesale_enabled: req.body?.wholesale_enabled,
            wholesale_min_qty: req.body?.wholesale_min_qty,
            wholesale_discount_percent: req.body?.wholesale_discount_percent,
            sale_enabled: req.body?.sale_enabled,
            sale_price: req.body?.sale_price,
            bundle_2x_enabled: req.body?.bundle_2x_enabled,
            bundle_2x_price: req.body?.bundle_2x_price
        }, { createdBy: req.user?.username || req.user?.name || 'admin' });

        if (req.files && req.files.length > 0) {
            created = await productsService.addProductImages(created.id, req.files);
        }

        // Auditoria
        try {
            await auditService.log({
                tableName: 'products',
                recordId: created.id,
                action: 'create',
                newValues: created,
                changedBy: req.user?.username || 'admin'
            });
        } catch (auditErr) {
            console.error('[Audit] Error logging product create:', auditErr.message);
        }

        return res.status(201).json(created);
    } catch (err) {
        await productsService.cleanupTempFiles(req.files || []);

        const status = err instanceof HttpError ? err.status : 400;
        return res.status(status).json({ error: err.message || 'No se pudo crear el producto' });
    }
});

app.put('/api/products/:id', auth.requireAuth(['admin','operador_stock']), uploadProductImages, async (req, res) => {
    try {
        const oldProduct = await productsService.getProduct(req.params.id);
        let updated = await productsService.updateProduct(req.params.id, req.body || {}, { updatedBy: req.user?.username || req.user?.name || 'admin' });

        if (req.files && req.files.length > 0) {
            updated = await productsService.addProductImages(updated.id, req.files);
        }

        // Auditoria
        try {
            await auditService.log({
                tableName: 'products',
                recordId: updated.id,
                action: 'update',
                oldValues: oldProduct,
                newValues: updated,
                changedBy: req.user?.username || 'admin'
            });
        } catch (auditErr) {
            console.error('[Audit] Error logging product update:', auditErr.message);
        }

        return res.json(updated);
    } catch (err) {
        await productsService.cleanupTempFiles(req.files || []);
        const status = err.message === 'Producto no encontrado' ? 404 : 400;
        return res.status(status).json({ error: err.message });
    }
});

app.delete('/api/products/:id', auth.requireAdmin, async (req, res) => {
    try {
        const oldProduct = await productsService.getProduct(req.params.id);
        const success = await productsService.deleteProduct(req.params.id);

        if (!success) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Auditoria
        try {
            await auditService.log({
                tableName: 'products',
                recordId: req.params.id,
                action: 'delete',
                oldValues: oldProduct,
                changedBy: req.user?.username || 'admin'
            });
        } catch (auditErr) {
            console.error('[Audit] Error logging product delete:', auditErr.message);
        }

        return res.json({ success: true });
    } catch {
        return res.status(500).json({ error: 'No se pudo eliminar el producto' });
    }
});

app.delete('/api/products/:id/images/:filename', auth.requireAdmin, async (req, res) => {
    try {
        await productsService.deleteProductImage(req.params.id, req.params.filename);
        return res.json({ success: true });
    } catch (err) {
        const status = err.message === 'Imagen no encontrada' ? 404 : 400;
        return res.status(status).json({ error: err.message });
    }
});

// ─── Receipt upload endpoint ───────────────────────────────────────────────

const receiptStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = config.PATHS.RECEIPT_DIR;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, `recibo-${crypto.randomUUID()}${ext}`);
    }
});
const receiptUpload = multer({
    storage: receiptStorage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
        if (!allowed.has(file.mimetype)) {
            return cb(new Error('Solo se permiten imagenes JPG, PNG, WEBP o PDF'));
        }
        cb(null, true);
    }
});

app.post('/api/upload-receipt', receiptUpload.single('receipt'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibio ningun archivo' });
        }
        const url = `/receipts/${req.file.filename}`;
        return res.json({ success: true, url });
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Error subiendo comprobante' });
    }
});

// ─── Orders endpoints (DB-backed) ────────────────────────────────────────────

app.post('/api/orders', ordersLimiter, async (req, res) => {
    try {
        const { orderId, total } = await ordersService.createOrder(req.body || {}, { source: 'catalogo' });
        return res.status(201).json({ success: true, orderId, total });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error guardando pedido' });
    }
});

app.get('/api/orders', auth.requireAuth(['admin','operador_pedidos']), async (req, res) => {
    try {
        const orders = await ordersService.getAllOrders();
        return res.json(orders);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'No se pudieron cargar los pedidos' });
    }
});

app.put('/api/orders/:id', auth.requireAuth(['admin','operador_pedidos']), async (req, res) => {
    try {
        const oldOrder = (await ordersService.getAllOrders()).find(o => String(o.id) === String(req.params.id));
        const result = await ordersService.updateOrderStatus(
            req.params.id,
            req.body?.status,
            req.body?.tracking_number,
            { force: req.body?.force === true }
        );

        // Auditoria
        try {
            await auditService.log({
                tableName: 'orders',
                recordId: String(req.params.id),
                action: 'update',
                oldValues: oldOrder ? { status: oldOrder.status, tracking_number: oldOrder.tracking_number } : null,
                newValues: result,
                changedBy: req.user?.username || 'admin'
            });
        } catch (auditErr) {
            console.error('[Audit] Error logging order update:', auditErr.message);
        }

        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'No se pudo actualizar el pedido' });
    }
});

// ─── Live / Packages endpoints (Admin) ────────────────────────────────────────

app.get('/api/packages', auth.requireAdmin, async (req, res) => {
    try {
        const packages = await packagesService.getAllPackages();
        return res.json(packages);
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Error al cargar paquetes' });
    }
});

app.post('/api/packages', auth.requireAdmin, uploadProductImages, async (req, res) => {
    try {
        const data = { ...(req.body || {}) };
        if (req.files && req.files.length > 0) {
            data.image_file = req.files[0].path;
        }
        const pkg = await packagesService.createPackage(data, { createdBy: req.user?.username || req.user?.name || 'admin' });
        return res.status(201).json(pkg);
    } catch (err) {
        await productsService.cleanupTempFiles(req.files || []);
        const status = err.status || 400;
        return res.status(status).json({ error: err.message || 'Error al crear paquete' });
    }
});

app.put('/api/packages/:id', auth.requireAdmin, uploadProductImages, async (req, res) => {
    try {
        const data = { ...(req.body || {}) };
        if (req.files && req.files.length > 0) {
            data.image_file = req.files[0].path;
        }
        const pkg = await packagesService.updatePackage(req.params.id, data);
        return res.json(pkg);
    } catch (err) {
        await productsService.cleanupTempFiles(req.files || []);
        const status = err.status || (err.message === 'Paquete no encontrado' ? 404 : 400);
        return res.status(status).json({ error: err.message || 'Error al actualizar paquete' });
    }
});

app.delete('/api/packages/:id', auth.requireAdmin, async (req, res) => {
    try {
        await packagesService.deletePackage(req.params.id);
        return res.json({ success: true });
    } catch (err) {
        const status = err.status || (err.message === 'Paquete no encontrado' ? 404 : 400);
        return res.status(status).json({ error: err.message || 'Error al eliminar paquete' });
    }
});

// ─── Live shopping (public endpoints) ─────────────────────────────────────────

app.get('/api/live/packages', async (req, res) => {
    try {
        const packages = await packagesService.getActivePackages();
        return res.json(packages);
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Error al cargar paquetes' });
    }
});

app.get('/api/live/packages/:code', async (req, res) => {
    try {
        const pkg = await packagesService.getPackageByCode(req.params.code);
        if (!pkg || !pkg.is_active) {
            return res.status(404).json({ error: 'Paquete no encontrado o inactivo' });
        }
        return res.json(pkg);
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Error al cargar paquete' });
    }
});

const liveOrdersLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `live_orders:${req.ip}`,
    message: { error: 'Demasiadas solicitudes de pedido. Intenta mas tarde.' }
});

app.post('/api/live/orders', liveOrdersLimiter, async (req, res) => {
    try {
        const { orderId, total, payment_method } = await ordersService.createLiveOrder(req.body || {});
        return res.status(201).json({ success: true, orderId, total, payment_method });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error guardando pedido' });
    }
});

// ─── Vendedor endpoints ───────────────────────────────────────────────────────

app.get('/api/vendedor/products', auth.requireAuth(['admin','vendedor']), async (req, res) => {
    try {
        let products = await productsService.getAllProducts();
        products = products.filter((p) => p.is_active === true || p.is_active === 1 || p.is_active === 'true');
        return res.json(products);
    } catch {
        return res.status(500).json({ error: 'Error al cargar productos' });
    }
});

app.post('/api/vendedor/orders', auth.requireAuth(['admin','vendedor']), ordersLimiter, async (req, res) => {
    try {
        const { orderId, total } = await ordersService.createOrder(req.body || {}, {
            createdBy: req.user?.username || req.user?.name,
            source: 'vendedor'
        });

        // Auditoria
        try {
            await auditService.log({
                tableName: 'orders',
                recordId: String(orderId),
                action: 'create',
                newValues: { orderId, total, source: 'vendedor', createdBy: req.user?.username || req.user?.name },
                changedBy: req.user?.username || req.user?.name || 'vendedor'
            });
        } catch (auditErr) {
            console.error('[Audit] Error logging vendedor order create:', auditErr.message);
        }

        return res.status(201).json({ success: true, orderId, total });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error guardando pedido' });
    }
});

app.get('/api/vendedor/orders', auth.requireAuth(['admin','vendedor']), async (req, res) => {
    try {
        const username = req.user?.username || req.user?.name;
        const orders = await ordersService.getOrdersBySeller(username);
        return res.json(orders);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'No se pudieron cargar los pedidos' });
    }
});

// ─── Customers endpoints ─────────────────────────────────────────────────────

app.get('/api/customers', auth.requireAuth(['admin','operador_pedidos']), async (req, res) => {
    try {
        const customers = await customersService.getAllCustomers();
        return res.json(customers);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error al cargar clientes' });
    }
});

app.post('/api/customers', auth.requireAuth(['admin','operador_pedidos']), async (req, res) => {
    try {
        const result = await customersService.createCustomer(req.body || {});
        return res.status(201).json(result);
    } catch (err) {
        const status = err.status || 400;
        return res.status(status).json({ error: err.message || 'Error al crear cliente' });
    }
});

app.get('/api/customers/:id', auth.requireAuth(['admin','operador_pedidos']), async (req, res) => {
    try {
        const customer = await customersService.getCustomerById(req.params.id);
        return res.json(customer);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error al cargar cliente' });
    }
});

app.put('/api/customers/:id', auth.requireAuth(['admin','operador_pedidos']), async (req, res) => {
    try {
        const result = await customersService.updateCustomer(req.params.id, req.body || {});
        return res.json(result);
    } catch (err) {
        const status = err.status || 400;
        return res.status(status).json({ error: err.message || 'Error al actualizar cliente' });
    }
});

app.delete('/api/customers/:id', auth.requireAdmin, async (req, res) => {
    try {
        await customersService.deleteCustomer(req.params.id);
        return res.json({ success: true });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error al eliminar cliente' });
    }
});

app.get('/api/customers/:id/orders', auth.requireAuth(['admin','operador_pedidos']), async (req, res) => {
    try {
        const customer = await customersService.getCustomerById(req.params.id);
        const orders = await customersService.getCustomerOrders(customer.phone, customer.name);
        return res.json(orders);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error al cargar pedidos del cliente' });
    }
});

// ─── Payment endpoint (CuboPago) ─────────────────────────────────────────────

app.post('/api/orders/:id/pay', ordersLimiter, async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const card = req.body?.card;
        const email = req.body?.email;

        if (!orderId || !Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({ error: 'ID de pedido invalido' });
        }
        if (!card || typeof card !== 'object') {
            return res.status(400).json({ error: 'Datos de tarjeta requeridos' });
        }
        if (!card.holder || !card.number || !card.cvv || !card.month || !card.year) {
            return res.status(400).json({ error: 'Datos de tarjeta incompletos' });
        }

        // NOTA DE SEGURIDAD: los datos de tarjeta nunca se almacenan ni se loggean.
        // Se envían directamente a CuboPago y luego se descartan.
        const result = await ordersService.processOrderPayment(orderId, {
            holder: String(card.holder),
            number: String(card.number),
            cvv: String(card.cvv),
            month: String(card.month),
            year: String(card.year)
        }, email ? String(email).trim() : undefined);
        return res.json({ success: true, ...result });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error procesando pago' });
    }
});

// ─── Webhook endpoint (CuboPago) ─────────────────────────────────────────────

app.post('/api/webhooks/cubopago', async (req, res) => {
    // Responder inmediatamente 200 OK para que CuboPago no reintente
    res.status(200).json({ received: true });

    try {
        const payload = req.body || {};
        const referenceId = payload?.referenceId || payload?.reference_id || payload?.id || null;

        // Guardar log del webhook para auditoria
        const pool = db.createPool();
        await pool.query(
            `INSERT INTO webhook_logs (provider, event_type, reference_id, payload)
             VALUES (?, ?, ?, ?)`,
            [
                'cubopago',
                payload?.status || payload?.event || 'unknown',
                referenceId,
                JSON.stringify(payload)
            ]
        );

        console.log(`[Webhook CuboPago] Recibido. status=${payload?.status} referenceId=${referenceId}`);

        // Confirmar pago si el webhook indica éxito
        const webhookStatus = String(payload?.status || '').toLowerCase();
        if (referenceId && (webhookStatus === 'approved' || webhookStatus === 'success' || webhookStatus === 'completed')) {
            try {
                const result = await ordersService.confirmPaymentByWebhook(referenceId, payload);
                console.log(`[Webhook CuboPago] Pago confirmado:`, JSON.stringify(result));
            } catch (confirmErr) {
                console.error(`[Webhook CuboPago] Error confirmando pago para ${referenceId}:`, confirmErr.message);
            }
        }
    } catch (err) {
        console.error('[Webhook CuboPago] Error procesando webhook:', err.message);
    }
});

// ─── Inventory endpoints ─────────────────────────────────────────────────────

app.get('/api/inventory', auth.requireAuth(['admin','operador_stock']), async (req, res) => {
    try {
        const inventory = await inventoryService.getAllInventory();
        return res.json(inventory);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error al cargar inventario' });
    }
});

app.get('/api/inventory/alerts', auth.requireAuth(['admin','operador_stock']), async (req, res) => {
    try {
        const alerts = await inventoryService.getLowStockAlerts();
        return res.json(alerts);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error al cargar alertas' });
    }
});

app.get('/api/inventory/movements', auth.requireAuth(['admin','operador_stock']), async (req, res) => {
    try {
        const sku = toSafeString(req.query?.sku) || undefined;
        const productId = toSafeString(req.query?.productId) || undefined;
        const type = toSafeString(req.query?.type) || undefined;
        const limit = req.query?.limit ? parsePositiveInt(req.query.limit, 'limit') : 100;
        const offset = req.query?.offset ? parseNonNegativeInt(req.query.offset, 'offset') : 0;

        const result = await inventoryService.getMovements({ sku, productId, type, limit, offset });
        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error al cargar movimientos' });
    }
});

app.post('/api/inventory/adjust', auth.requireAuth(['admin','operador_stock']), async (req, res) => {
    try {
        const sku = toSafeString(req.body?.sku);
        const quantity = Number(req.body?.quantity);
        const reason = toSafeString(req.body?.reason);

        if (!sku) {
            return res.status(400).json({ error: 'SKU es requerido' });
        }

        if (!Number.isInteger(quantity) || quantity < 0) {
            return res.status(400).json({ error: 'Cantidad debe ser un entero >= 0' });
        }

        const result = await inventoryService.adjustStock(sku, quantity, {
            reason: reason || 'Ajuste manual desde panel admin',
            createdBy: req.user?.username || req.user?.name || 'admin'
        });

        // Auditoria
        try {
            await auditService.log({
                tableName: 'inventory',
                recordId: sku,
                action: 'update',
                newValues: result,
                changedBy: req.user?.username || 'admin'
            });
        } catch (auditErr) {
            console.error('[Audit] Error logging inventory adjust:', auditErr.message);
        }

        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error al ajustar inventario' });
    }
});

app.post('/api/inventory/entry', auth.requireAuth(['admin','operador_stock']), async (req, res) => {
    try {
        const sku = toSafeString(req.body?.sku);
        const quantity = Number(req.body?.quantity);
        const reason = toSafeString(req.body?.reason);

        if (!sku) {
            return res.status(400).json({ error: 'SKU es requerido' });
        }

        const qty = parsePositiveInt(quantity, 'quantity');

        const result = await inventoryService.addStock(sku, qty, {
            reason: reason || 'Entrada manual desde panel admin',
            createdBy: req.user?.username || req.user?.name || 'admin'
        });

        // Auditoria
        try {
            await auditService.log({
                tableName: 'inventory',
                recordId: sku,
                action: 'update',
                newValues: result,
                changedBy: req.user?.username || 'admin'
            });
        } catch (auditErr) {
            console.error('[Audit] Error logging inventory entry:', auditErr.message);
        }

        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error al registrar entrada' });
    }
});

app.put('/api/inventory/:sku/min-stock', auth.requireAuth(['admin','operador_stock']), async (req, res) => {
    try {
        const sku = toSafeString(req.params.sku);
        const minStock = Number(req.body?.min_stock_level);

        if (!sku) {
            return res.status(400).json({ error: 'SKU inválido' });
        }

        if (!Number.isInteger(minStock) || minStock < 0) {
            return res.status(400).json({ error: 'min_stock_level debe ser un entero >= 0' });
        }

        const result = await inventoryService.updateMinStockLevel(sku, minStock);
        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Error al actualizar nivel mínimo' });
    }
});

// ─── Users endpoints (Admin only) ─────────────────────────────────────────────

app.get('/api/users', auth.requireAdmin, async (req, res) => {
    try {
        const users = await usersService.getAllUsers();
        return res.json(users);
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Error al cargar usuarios' });
    }
});

app.post('/api/users', auth.requireAdmin, async (req, res) => {
    try {
        const user = await usersService.createUser(req.body || {});

        // Auditoria
        try {
            await auditService.log({
                tableName: 'users',
                recordId: String(user.id),
                action: 'create',
                newValues: user,
                changedBy: req.user?.username || 'admin'
            });
        } catch (auditErr) {
            console.error('[Audit] Error logging user create:', auditErr.message);
        }

        return res.status(201).json(user);
    } catch (err) {
        return res.status(400).json({ error: err.message || 'Error al crear usuario' });
    }
});

app.put('/api/users/:id', auth.requireAdmin, async (req, res) => {
    try {
        const user = await usersService.updateUser(req.params.id, req.body || {});

        // Auditoria
        try {
            await auditService.log({
                tableName: 'users',
                recordId: String(req.params.id),
                action: 'update',
                newValues: user,
                changedBy: req.user?.username || 'admin'
            });
        } catch (auditErr) {
            console.error('[Audit] Error logging user update:', auditErr.message);
        }

        return res.json(user);
    } catch (err) {
        const status = err.message === 'Usuario no encontrado' ? 404 : 400;
        return res.status(status).json({ error: err.message || 'Error al actualizar usuario' });
    }
});

app.delete('/api/users/:id', auth.requireAdmin, async (req, res) => {
    try {
        await usersService.deleteUser(req.params.id);

        // Auditoria
        try {
            await auditService.log({
                tableName: 'users',
                recordId: String(req.params.id),
                action: 'delete',
                changedBy: req.user?.username || 'admin'
            });
        } catch (auditErr) {
            console.error('[Audit] Error logging user delete:', auditErr.message);
        }

        return res.json({ success: true });
    } catch (err) {
        const status = err.message === 'Usuario no encontrado' ? 404 : 400;
        return res.status(status).json({ error: err.message || 'Error al eliminar usuario' });
    }
});

// ─── Dashboard endpoint (Admin only) ──────────────────────────────────────────

app.get('/api/dashboard', auth.requireAdmin, async (req, res) => {
    try {
        const [
            summary,
            lowStock,
            recentOrders,
            recentAudit,
            topProducts,
            topCustomers,
            vendorPerformance,
            salesTrend,
            orderStatusDistribution
        ] = await Promise.all([
            dashboardService.getDashboardSummary(),
            dashboardService.getLowStockAlerts(5),
            dashboardService.getRecentOrders(5),
            dashboardService.getRecentAudit(5),
            dashboardService.getTopProducts(5),
            dashboardService.getTopCustomers(5),
            dashboardService.getVendorPerformance(),
            dashboardService.getSalesTrend(7),
            dashboardService.getOrderStatusDistribution()
        ]);

        return res.json({
            summary,
            lowStock,
            recentOrders,
            recentAudit,
            topProducts,
            topCustomers,
            vendorPerformance,
            salesTrend,
            orderStatusDistribution
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        return res.status(500).json({ error: err.message || 'Error al cargar dashboard' });
    }
});

// ─── Audit endpoints (Admin only) ─────────────────────────────────────────────

app.get('/api/audit', auth.requireAdmin, async (req, res) => {
    try {
        const tableName = toSafeString(req.query?.table) || undefined;
        const recordId = toSafeString(req.query?.record) || undefined;
        const action = toSafeString(req.query?.action) || undefined;
        const limit = req.query?.limit ? parsePositiveInt(req.query.limit, 'limit') : 100;
        const offset = req.query?.offset ? parseNonNegativeInt(req.query.offset, 'offset') : 0;

        const result = await auditService.getLogs({ tableName, recordId, action, limit, offset });
        return res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Error al cargar auditoria' });
    }
});

const PORT = config.SERVER.PORT;

ensureStorage()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Backend corriendo en el puerto ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('No se pudo inicializar almacenamiento:', err.message);
        process.exit(1);
    });
