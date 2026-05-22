'use strict';

/**
 * orders-service.js
 *
 * Lógica de pedidos en base de datos (MariaDB).
 * - Precios SIEMPRE calculados en backend (nunca del frontend)
 * - Snapshot completo del producto en el momento del pedido
 * - Transacción atómica: rollback total si algo falla
 * - Preparado para inventario futuro (variant_sku como referencia principal)
 */

const db = require('./db');
const config = require('./config');
const inventoryService = require('./inventory-service');
const customersService = require('./customers-service');
const packagesService = require('./packages-service');

const ALLOWED_STATUSES = new Set(['pendiente', 'confirmado', 'enviado', 'cancelado']);

const VALID_TRANSITIONS = {
    pendiente: new Set(['confirmado', 'cancelado']),
    confirmado: new Set(['enviado']),
    enviado: new Set([]),
    cancelado: new Set([])
};
const ALLOWED_PAYMENT_METHODS = new Set(['efectivo', 'cubopago', 'transferencia']);
const ALLOWED_PAYMENT_STATUSES = new Set(['pendiente', 'pagado', 'fallido', 'reembolsado']);

class OrderError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

// ─── Validaciones de entrada ──────────────────────────────────────────────────

/**
 * Devuelve un string limpio o lanza OrderError si está vacío.
 */
const toSafeString = (value) => String(value || '').trim();

const requireString = (value, fieldName) => {
    const raw = value === null || value === undefined ? '' : String(value);
    const clean = raw.trim();
    if (!clean) {
        throw new OrderError(`El campo '${fieldName}' es obligatorio y no puede estar vacío`);
    }

    return clean;
};

/**
 * Valida y devuelve un entero positivo.
 */
const requirePositiveInt = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new OrderError(`${fieldName} debe ser un número entero mayor a 0`);
    }

    return parsed;
};

/**
 * Valida el payload completo del frontend.
 * NUNCA acepta price ni total del cliente.
 */
const validateOrderPayload = (body) => {
    const customer_name = requireString(body?.customer_name, 'customer_name');
    const phone         = requireString(body?.phone,          'phone');
    const address       = requireString(body?.address,        'address');
    const city          = requireString(body?.city,           'city');

    const rawItems = body?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw new OrderError('items debe ser un arreglo no vacío');
    }

    const items = rawItems.map((item, index) => {
        const sku      = requireString(item?.sku, `items[${index}].sku`);
        const quantity = requirePositiveInt(item?.quantity, `items[${index}].quantity`);

        return { sku, quantity };
        // NOTA: price/total del frontend se ignoran completamente
    });

    // Validar método de pago
    const rawPaymentMethod = String(body?.payment_method || 'efectivo').toLowerCase().trim();
    const payment_method = ALLOWED_PAYMENT_METHODS.has(rawPaymentMethod) ? rawPaymentMethod : 'efectivo';

    // Opcionales
    const email = body?.email ? String(body.email).trim() : null;
    const notes = body?.notes ? String(body.notes).trim() : null;
    const discount_amount = parseFloat(body?.discount_amount) || 0;
    const payment_receipt_url = body?.payment_receipt_url ? String(body.payment_receipt_url).trim() : null;

    return { customer_name, phone, email, address, city, notes, items, payment_method, discount_amount, payment_receipt_url };
};

// ─── Resolución de precio (igual que products-service) ────────────────────────

const parseDecimalToCents = (value) => {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    const match = raw.match(/^(-?)(\d+)(?:\.(\d+))?$/);
    if (!match) return null;

    const sign     = match[1] === '-' ? -1 : 1;
    const whole    = Number(match[2]);
    const decimals = `${match[3] || ''}000`;
    let cents      = whole * 100 + Number(decimals.slice(0, 2));
    if (Number(decimals[2] || '0') >= 5) cents += 1;

    return cents * sign;
};

const centsToDecimal = (cents) => Number((cents / 100).toFixed(2));

/**
 * Resuelve el precio final de una variante:
 * usa v.price si existe, si no hereda p.base_price.
 * Lanza si el resultado es null o <= 0.
 */
const resolvePrice = (variantPrice, basePrice, sku) => {
    const raw     = variantPrice !== null && variantPrice !== undefined ? variantPrice : basePrice;
    const cents   = parseDecimalToCents(raw);

    if (cents === null || cents <= 0) {
        throw new OrderError(`No se pudo resolver un precio valido para el SKU: ${sku}`, 400);
    }

    return centsToDecimal(cents);
};

// ─── Lookup de variante por SKU ───────────────────────────────────────────────

/**
 * Busca la variante en DB y devuelve un snapshot completo.
 * Lanza OrderError 400 si el SKU no existe.
 */
const fetchVariantBySkuSnapshot = async (conn, sku) => {
    const [rows] = await conn.query(
        `SELECT
            v.sku,
            v.price        AS variant_price,
            v.size,
            v.color_name,
            p.id           AS product_id,
            p.name         AS product_name,
            p.price        AS base_price,
            p.sale_enabled,
            p.sale_price,
            p.wholesale_enabled,
            p.wholesale_min_qty,
            p.wholesale_discount_percent,
            p.bundle_2x_enabled,
            p.bundle_2x_price
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         WHERE TRIM(v.sku) = TRIM(?)`,
        [sku]
    );

    if (rows.length === 0) {
        throw new OrderError(`SKU no encontrado: "${sku}". El producto o variante seleccionada ya no está disponible.`, 400);
    }

    const row        = rows[0];
    const basePrice  = resolvePrice(row.variant_price, row.base_price, sku);
    const salePrice  = parseFloat(row.sale_price || 0);
    const effectivePrice = (row.sale_enabled && salePrice > 0) ? salePrice : basePrice;

    return {
        variant_sku:  row.sku,
        product_id:   row.product_id,
        product_name: row.product_name,
        size:         row.size,
        color_name:   row.color_name,
        price:        effectivePrice,
        wholesale_enabled: !!row.wholesale_enabled,
        wholesale_min_qty: row.wholesale_min_qty || 0,
        wholesale_discount_percent: parseFloat(row.wholesale_discount_percent || 0),
        bundle_2x_enabled: !!row.bundle_2x_enabled,
        bundle_2x_price: parseFloat(row.bundle_2x_price || 0)
    };
};

// ─── Crear pedido ─────────────────────────────────────────────────────────────

/**
 * Crea un pedido completo con transacción atómica.
 * Devuelve { orderId, total }.
 */
const createOrder = async (body, { createdBy, source } = {}) => {
    if (!(await db.verifyConnection())) {
        throw new OrderError('Base de datos no disponible', 503);
    }

    const payload = validateOrderPayload(body);
    const pool    = db.createPool();
    const conn    = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // ── Paso 1: resolver snapshots ────────────────────────────────────
        const resolvedItems = [];
        const qtyByProduct = {};

        for (const item of payload.items) {
            const snapshot = await fetchVariantBySkuSnapshot(conn, item.sku);
            
            if (!qtyByProduct[snapshot.product_id]) {
                qtyByProduct[snapshot.product_id] = 0;
            }
            qtyByProduct[snapshot.product_id] += item.quantity;

            resolvedItems.push({
                ...snapshot,
                quantity: item.quantity
            });
        }

        // ── Paso 2: calcular total con descuentos ─────────────────────────
        let totalCents = 0;

        // Agrupar items por producto para aplicar bundle 2x
        const itemsByProduct = {};
        for (const item of resolvedItems) {
            if (!itemsByProduct[item.product_id]) itemsByProduct[item.product_id] = [];
            itemsByProduct[item.product_id].push(item);
        }

        for (const [productId, productItems] of Object.entries(itemsByProduct)) {
            const totalProductQty = qtyByProduct[productId];
            const firstItem = productItems[0];
            const bundleEnabled = firstItem.bundle_2x_enabled && firstItem.bundle_2x_price > 0;
            let productTotalCents = 0;

            if (bundleEnabled && totalProductQty >= 2) {
                const unitPriceCents = Math.round(firstItem.price * 100);
                const bundlePriceCents = Math.round(firstItem.bundle_2x_price * 100);
                const pairs = Math.floor(totalProductQty / 2);
                const singles = totalProductQty % 2;
                productTotalCents = (pairs * bundlePriceCents) + (singles * unitPriceCents);
            } else {
                // Precio normal + mayorista si aplica
                for (const item of productItems) {
                    let itemPrice = item.price;
                    if (item.wholesale_enabled && totalProductQty >= item.wholesale_min_qty && item.wholesale_discount_percent > 0) {
                        const discountFactor = 1 - (item.wholesale_discount_percent / 100);
                        itemPrice = item.price * discountFactor;
                    }
                    productTotalCents += Math.round(itemPrice * 100) * item.quantity;
                }
            }

            totalCents += productTotalCents;

            // Guardar applied_price para el snapshot
            // Si bundle aplica, distribuimos proporcionalmente; si no, usamos el precio calculado
            if (bundleEnabled && totalProductQty >= 2) {
                const avgPrice = productTotalCents / totalProductQty;
                for (const item of productItems) {
                    item.applied_price = Number((avgPrice / 100).toFixed(2));
                }
            } else {
                for (const item of productItems) {
                    let itemPrice = item.price;
                    if (item.wholesale_enabled && totalProductQty >= item.wholesale_min_qty && item.wholesale_discount_percent > 0) {
                        const discountFactor = 1 - (item.wholesale_discount_percent / 100);
                        itemPrice = item.price * discountFactor;
                    }
                    item.applied_price = itemPrice;
                }
            }
        }

        const total = centsToDecimal(totalCents);
        const discount = Math.min(payload.discount_amount, total);
        const finalTotal = Math.max(total - discount, 0);

        // ── Paso 3: insertar order ─────────────────────────────────────────
        const paymentStatus = payload.payment_method === 'transferencia' ? 'pendiente' : 'pendiente';

        const [orderResult] = await conn.query(
            `INSERT INTO orders (customer_name, phone, email, address, city, notes, total, discount_amount, payment_method, payment_status, payment_receipt_url, created_by, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [payload.customer_name, payload.phone, payload.email, payload.address, payload.city, payload.notes, finalTotal, discount, payload.payment_method, paymentStatus, payload.payment_receipt_url, createdBy || null, source || 'catalogo']
        );

        const orderId = orderResult.insertId;

        // ── Paso 3: insertar order_items (snapshot completo) ───────────────
        for (const item of resolvedItems) {
            await conn.query(
                `INSERT INTO order_items
                    (order_id, variant_sku, product_id, product_name, size, color_name, price, quantity)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    item.variant_sku,
                    item.product_id,
                    item.product_name,
                    item.size,
                    item.color_name,
                    item.applied_price || item.price,
                    item.quantity
                ]
            );
        }

        // ── Paso 4: descontar stock del inventario (dentro de la misma transacción) ──
        try {
            const stockItems = resolvedItems.map((item) => ({
                sku: item.variant_sku,
                quantity: item.quantity
            }));
            await inventoryService.deductStockForOrderWithConnection(conn, stockItems, {
                orderId,
                createdBy: createdBy || 'system:orders'
            });
        } catch (stockErr) {
            // Relanzar como OrderError para que el caller lo maneje correctamente
            throw new OrderError(stockErr.message, stockErr.status || 409);
        }

        await conn.commit();

        // ── Guardar/actualizar cliente persistente ──
        try {
            await customersService.upsertCustomer({
                customer_name: payload.customer_name,
                phone: payload.phone,
                email: payload.email,
                address: payload.address,
                city: payload.city,
                notes: payload.notes,
                total
            });
        } catch (custErr) {
            console.warn(`[Orders] No se pudo guardar cliente para orden ${orderId}: ${custErr.message}`);
        }

        return { orderId, total, payment_method: payload.payment_method };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

// ─── Listar pedidos (admin) ───────────────────────────────────────────────────

/**
 * Devuelve todos los pedidos con sus ítems.
 */
const getAllOrders = async () => {
    if (!(await db.verifyConnection())) {
        throw new OrderError('Base de datos no disponible', 503);
    }

    const pool = db.createPool();

    const [orders] = await pool.query(
        `SELECT * FROM orders ORDER BY created_at DESC`
    );

    if (orders.length === 0) {
        return [];
    }

    const orderIds     = orders.map((o) => o.id);
    const placeholders = orderIds.map(() => '?').join(',');

    const [items] = await pool.query(
        `SELECT * FROM order_items WHERE order_id IN (${placeholders})`,
        orderIds
    );

    // Agrupar ítems por order_id
    const itemsByOrder = {};
    for (const item of items) {
        if (!itemsByOrder[item.order_id]) {
            itemsByOrder[item.order_id] = [];
        }
        itemsByOrder[item.order_id].push(item);
    }

    return orders.map((order) => ({
        ...order,
        items: itemsByOrder[order.id] || []
    }));
};

// ─── Listar pedidos por vendedor ──────────────────────────────────────────────

const getOrdersBySeller = async (username) => {
    if (!(await db.verifyConnection())) {
        throw new OrderError('Base de datos no disponible', 503);
    }

    const pool = db.createPool();
    const [orders] = await pool.query(
        `SELECT * FROM orders WHERE created_by = ? ORDER BY created_at DESC`,
        [String(username || '').trim()]
    );

    if (orders.length === 0) return [];

    const orderIds = orders.map((o) => o.id);
    const placeholders = orderIds.map(() => '?').join(',');
    const [items] = await pool.query(
        `SELECT * FROM order_items WHERE order_id IN (${placeholders})`,
        orderIds
    );

    const itemsByOrder = {};
    for (const item of items) {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item);
    }

    return orders.map((order) => ({ ...order, items: itemsByOrder[order.id] || [] }));
};

// ─── Actualizar estado (admin) ─────────────────────────────────────────────────

/**
 * Cambia el status de un pedido.
 */
const updateOrderStatus = async (orderId, status, trackingNumber, { force = false } = {}) => {
    if (!(await db.verifyConnection())) {
        throw new OrderError('Base de datos no disponible', 503);
    }

    const cleanStatus = String(status || '').toLowerCase().trim();
    if (!ALLOWED_STATUSES.has(cleanStatus)) {
        throw new OrderError(`Estado invalido. Valores permitidos: ${[...ALLOWED_STATUSES].join(', ')}`);
    }

    const pool = db.createPool();

    // Obtener estado actual para validar transicion
    const [orderRows] = await pool.query(
        `SELECT status, payment_status FROM orders WHERE id = ?`,
        [orderId]
    );

    if (orderRows.length === 0) {
        throw new OrderError('Pedido no encontrado', 404);
    }

    const currentStatus = orderRows[0].status;

    if (!force) {
        const allowedNext = VALID_TRANSITIONS[currentStatus];

        if (!allowedNext || !allowedNext.has(cleanStatus)) {
            throw new OrderError(
                `Transicion no permitida: no se puede cambiar de "${currentStatus}" a "${cleanStatus}"`,
                409
            );
        }
    }

    const cleanTracking = trackingNumber ? String(trackingNumber).trim() : null;

    if (cleanStatus === 'enviado' && !cleanTracking) {
        throw new OrderError('El numero de guia es obligatorio para marcar como enviado', 400);
    }

    const [result] = await pool.query(
        `UPDATE orders SET status = ?, tracking_number = ? WHERE id = ?`,
        [cleanStatus, cleanTracking || null, orderId]
    );

    if (result.affectedRows === 0) {
        throw new OrderError('Pedido no encontrado', 404);
    }

    // Restaurar stock al cancelar (solo si no estaba ya cancelado)
    if (cleanStatus === 'cancelado' && currentStatus !== 'cancelado') {
        try {
            // Verificar si es pedido live para restaurar stock de paquetes
            const [orderInfo] = await pool.query('SELECT source FROM orders WHERE id = ?', [orderId]);
            const orderSource = orderInfo.length > 0 ? orderInfo[0].source : null;

            if (orderSource === 'live') {
                const [liveItems] = await pool.query(
                    'SELECT variant_sku, quantity FROM order_items WHERE order_id = ?',
                    [orderId]
                );
                const packageItems = liveItems
                    .filter((item) => item.variant_sku && item.variant_sku.startsWith('PAQUETE-'))
                    .map((item) => ({
                        code: item.variant_sku.replace('PAQUETE-', ''),
                        quantity: item.quantity
                    }));
                if (packageItems.length > 0) {
                    await packagesService.restoreStock(packageItems);
                }
            } else {
                await inventoryService.restoreStockForOrder(orderId);
            }
        } catch (restoreErr) {
            console.error(`[Orders] Error restaurando stock para orden ${orderId}:`, restoreErr.message);
        }
    }

    return { success: true, status: cleanStatus, tracking_number: cleanTracking || null };
};

// ─── Procesar pago CuboPago ───────────────────────────────────────────────────

const paymentsService = require('./payments-service');

/**
 * Procesa el pago de una orden con CuboPago.
 * Devuelve { success, transactionId, authorization }.
 * Si falla, devuelve { success: false, error }.
 */
const processOrderPayment = async (orderId, card, customerEmail) => {
    if (!(await db.verifyConnection())) {
        throw new OrderError('Base de datos no disponible', 503);
    }

    const pool = db.createPool();
    const [orderRows] = await pool.query(
        `SELECT * FROM orders WHERE id = ?`,
        [orderId]
    );

    if (orderRows.length === 0) {
        throw new OrderError('Pedido no encontrado', 404);
    }

    const order = orderRows[0];

    if (order.payment_method !== 'cubopago') {
        throw new OrderError('Este pedido no requiere pago con tarjeta', 400);
    }

    if (order.payment_status === 'pagado') {
        throw new OrderError('Este pedido ya fue pagado', 400);
    }

    // Validar datos de tarjeta mínimos (NO almacenar nunca)
    if (!card || typeof card !== 'object') {
        throw new OrderError('Datos de tarjeta requeridos', 400);
    }
    if (!card.holder || !card.number || !card.cvv || !card.month || !card.year) {
        throw new OrderError('Datos de tarjeta incompletos', 400);
    }

    const isRetry = order.status === 'cancelado' && order.payment_status === 'fallido';

    try {
        const chargeResult = await paymentsService.chargeCard({
            amount: Number(order.total),
            orderId: String(order.id),
            description: `Pedido #${order.id} - ${config.BRAND.NAME}`,
            customerName: order.customer_name,
            customerEmail: customerEmail,
            customerPhone: order.phone,
            card: {
                holder: String(card.holder),
                number: String(card.number),
                cvv: String(card.cvv),
                month: String(card.month),
                year: String(card.year)
            }
        });

        // Pago exitoso — actualizar orden
        await pool.query(
            `UPDATE orders
             SET payment_status = 'pagado',
                 status = 'confirmado',
                 cubopago_transaction_id = ?,
                 cubopago_authorization = ?
             WHERE id = ?`,
            [chargeResult.transactionId, chargeResult.authorization, orderId]
        );

        // Si es retry, descontar stock nuevamente (fue restaurado al fallar)
        if (isRetry) {
            const [orderItems] = await pool.query(
                'SELECT variant_sku AS sku, quantity FROM order_items WHERE order_id = ?',
                [orderId]
            );
            if (orderItems.length > 0) {
                if (order.source === 'live') {
                    const packageItems = orderItems
                        .filter((item) => item.sku && item.sku.startsWith('PAQUETE-'))
                        .map((item) => ({
                            package_code: item.sku.replace('PAQUETE-', ''),
                            quantity: item.quantity
                        }));
                    if (packageItems.length > 0) {
                        const conn = await pool.getConnection();
                        try {
                            await conn.beginTransaction();
                            await packagesService.deductStockWithConnection(conn, packageItems);
                            await conn.commit();
                        } catch (err) {
                            await conn.rollback();
                            throw err;
                        } finally {
                            conn.release();
                        }
                    }
                } else {
                    await inventoryService.deductStockForOrder(orderItems, {
                        orderId,
                        createdBy: 'system:retry'
                    });
                }
            }
        }

        return {
            success: true,
            transactionId: chargeResult.transactionId,
            authorization: chargeResult.authorization
        };
    } catch (paymentErr) {
        // Pago falló — marcar como fallido
        await pool.query(
            `UPDATE orders
             SET payment_status = 'fallido',
                 status = 'cancelado'
             WHERE id = ?`,
            [orderId]
        );

        // Solo restaurar stock si no es retry (en retry el stock no fue descontado aún)
        if (!isRetry) {
            try {
                if (order.source === 'live') {
                    const [liveItems] = await pool.query(
                        'SELECT variant_sku, quantity FROM order_items WHERE order_id = ?',
                        [orderId]
                    );
                    const packageItems = liveItems
                        .filter((item) => item.variant_sku && item.variant_sku.startsWith('PAQUETE-'))
                        .map((item) => ({
                            code: item.variant_sku.replace('PAQUETE-', ''),
                            quantity: item.quantity
                        }));
                    if (packageItems.length > 0) {
                        await packagesService.restoreStock(packageItems);
                    }
                } else {
                    await inventoryService.restoreStockForOrder(orderId);
                }
            } catch (restoreErr) {
                console.error(`Error restaurando stock para orden ${orderId}:`, restoreErr.message);
            }
        }

        throw new OrderError(
            paymentErr.message || 'El pago fue rechazado. Por favor intenta con otro método.',
            paymentErr.status || 402
        );
    }
};

// ─── Confirmar pago vía webhook ───────────────────────────────────────────────

/**
 * Confirma el pago de una orden cuando CuboPago envía el webhook.
 * Busca por cubopago_transaction_id y actualiza el estado.
 */
const confirmPaymentByWebhook = async (referenceId, webhookData) => {
    if (!referenceId) {
        throw new OrderError('referenceId requerido', 400);
    }

    if (!(await db.verifyConnection())) {
        throw new OrderError('Base de datos no disponible', 503);
    }

    const pool = db.createPool();

    // Buscar la orden por transactionId
    const [orderRows] = await pool.query(
        `SELECT * FROM orders WHERE cubopago_transaction_id = ?`,
        [referenceId]
    );

    if (orderRows.length === 0) {
        return { found: false, referenceId };
    }

    const order = orderRows[0];

    // Si ya estaba pagado, no hacemos nada (idempotencia)
    if (order.payment_status === 'pagado') {
        return { found: true, orderId: order.id, alreadyPaid: true };
    }

    // Actualizar a pagado y confirmado
    const authCode = webhookData?.authorizationCode || webhookData?.authorization || order.cubopago_authorization;

    await pool.query(
        `UPDATE orders
         SET payment_status = 'pagado',
             status = 'confirmado',
             cubopago_authorization = ?
         WHERE id = ?`,
        [authCode, order.id]
    );

    return { found: true, orderId: order.id, alreadyPaid: false };
};

// ─── Crear pedido desde Live (paquetes) ─────────────────────────────────────

/**
 * Crea un pedido de venta en directo (live shopping).
 * El cliente compra uno o mas paquetes predefinidos con stock propio.
 * Envio fijo Q25.
 *
 * Payload esperado:
 * {
 *   customer_name, phone, email?, address, city, notes?,
 *   payment_method,
 *   packages: [ { code, quantity }, ... ]
 * }
 */
const createLiveOrder = async (body) => {
    if (!(await db.verifyConnection())) {
        throw new OrderError('Base de datos no disponible', 503);
    }

    const customer_name = requireString(body?.customer_name, 'customer_name');
    const phone         = requireString(body?.phone, 'phone');
    const address       = requireString(body?.address, 'address');
    const city          = requireString(body?.city, 'city');
    const email         = body?.email ? String(body.email).trim() : null;
    const notes         = body?.notes ? String(body.notes).trim() : null;

    const rawPackages = body?.packages;
    if (!Array.isArray(rawPackages) || rawPackages.length === 0) {
        throw new OrderError('Debes incluir al menos un paquete');
    }

    const paymentMethod = String(body?.payment_method || 'efectivo').toLowerCase().trim();
    if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
        throw new OrderError('Metodo de pago invalido');
    }

    const rawDiscount = body?.discount_amount;
    const discountAmount = (typeof rawDiscount === 'number' && !isNaN(rawDiscount) && rawDiscount > 0)
        ? Number(rawDiscount.toFixed(2))
        : 0;
    const receiptUrl = body?.payment_receipt_url ? String(body.payment_receipt_url).trim() : null;

    // Resolver paquetes y calcular total
    const resolvedPackages = [];
    let subtotalCents = 0;

    for (const entry of rawPackages) {
        const code = toSafeString(entry?.code || entry?.package_code);
        const qty  = requirePositiveInt(entry?.quantity, 'quantity');

        const pkg = await packagesService.getPackageByCode(code);
        if (!pkg) {
            throw new OrderError(`Paquete no encontrado: "${code}"`, 400);
        }
        if (!pkg.is_active) {
            throw new OrderError(`Paquete inactivo: "${code}"`, 400);
        }

        resolvedPackages.push({
            code: pkg.code,
            name: pkg.name,
            price: Number(pkg.price),
            quantity: qty
        });

        subtotalCents += Math.round(Number(pkg.price) * 100) * qty;
    }

    // Envio fijo Q25
    const SHIPPING_CENTS = 25 * 100;
    const discountCents = Math.round(discountAmount * 100);
    const totalCents = subtotalCents + SHIPPING_CENTS - discountCents;
    const total = centsToDecimal(totalCents);
    const shippingCost = centsToDecimal(SHIPPING_CENTS);

    const pool = db.createPool();
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // Descontar stock de paquetes
        const stockItems = resolvedPackages.map((p) => ({
            package_code: p.code,
            quantity: p.quantity
        }));
        await packagesService.deductStockWithConnection(conn, stockItems);

        // Insertar orden
        const paymentStatus = paymentMethod === 'efectivo' ? 'pendiente' : 'pendiente';
        const [orderResult] = await conn.query(
            `INSERT INTO orders (customer_name, phone, email, address, city, notes, total, discount_amount, status, payment_method, payment_status, shipping_cost, payment_receipt_url, created_by, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?, 'live')`,
            [customer_name, phone, email, address, city, notes, total, discountAmount, paymentMethod, paymentStatus, shippingCost, receiptUrl, null]
        );

        const orderId = orderResult.insertId;

        // Insertar order_items (snapshot de paquetes)
        for (const pkg of resolvedPackages) {
            await conn.query(
                `INSERT INTO order_items (order_id, variant_sku, product_id, product_name, size, color_name, price, quantity)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    `PAQUETE-${pkg.code}`,
                    `PKG-${pkg.code}`,
                    pkg.name,
                    'N/A',
                    'N/A',
                    pkg.price,
                    pkg.quantity
                ]
            );
        }

        await conn.commit();

        // Guardar/actualizar cliente
        try {
            await customersService.upsertCustomer({
                customer_name, phone, email, address, city, notes, total
            });
        } catch (custErr) {
            console.warn(`[Orders] No se pudo guardar cliente para orden live ${orderId}: ${custErr.message}`);
        }

        return { orderId, total, payment_method: paymentMethod };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    createOrder,
    createLiveOrder,
    getAllOrders,
    getOrdersBySeller,
    updateOrderStatus,
    processOrderPayment,
    confirmPaymentByWebhook,
    ALLOWED_STATUSES,
    ALLOWED_PAYMENT_METHODS,
    // Exportar internals para tests
    __test: {
        validateOrderPayload,
        resolvePrice,
        requirePositiveInt
    }
};
