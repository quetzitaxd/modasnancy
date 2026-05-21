'use strict';

/**
 * inventory-service.js
 *
 * Módulo de inventario modular y escalable.
 * - Control de existencias por SKU (variante)
 * - Movimientos trazables (entradas, salidas, ajustes)
 * - Alertas de stock bajo
 * - Integración con pedidos
 */

const db = require('./db');

class InventoryError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

const MOVEMENT_TYPES = new Set(['entrada', 'salida', 'ajuste']);

const toSafeString = (value) => String(value || '').trim();

const requireDb = async () => {
    if (!(await db.verifyConnection())) {
        throw new InventoryError('Base de datos no disponible', 503);
    }
};

// ─── Inventario base ──────────────────────────────────────────────────────────

/**
 * Obtiene el registro de inventario para un SKU.
 */
const getInventoryBySku = async (sku) => {
    await requireDb();
    const pool = db.createPool();
    const [rows] = await pool.query(
        `SELECT i.*, p.name AS product_name, v.size, v.color_name, v.color_hex
         FROM inventory i
         JOIN products p ON p.id = i.product_id
         JOIN product_variants v ON v.sku = i.sku
         WHERE i.sku = ?`,
        [toSafeString(sku)]
    );
    return rows[0] || null;
};

/**
 * Lista todo el inventario con info del producto.
 */
const getAllInventory = async () => {
    await requireDb();
    const pool = db.createPool();
    const [rows] = await pool.query(
        `SELECT i.*, p.name AS product_name, v.size, v.color_name, v.color_hex
         FROM inventory i
         JOIN products p ON p.id = i.product_id
         JOIN product_variants v ON v.sku = i.sku
         ORDER BY p.name, v.size, v.color_name`
    );
    return rows;
};

/**
 * Obtiene inventario para un producto completo.
 */
const getInventoryByProduct = async (productId) => {
    await requireDb();
    const pool = db.createPool();
    const [rows] = await pool.query(
        `SELECT i.*, p.name AS product_name, v.size, v.color_name, v.color_hex
         FROM inventory i
         JOIN products p ON p.id = i.product_id
         JOIN product_variants v ON v.sku = i.sku
         WHERE i.product_id = ?
         ORDER BY v.size, v.color_name`,
        [toSafeString(productId)]
    );
    return rows;
};

/**
 * Inicializa el inventario para una variante si no existe.
 * Útil cuando se crean productos nuevos o al migrar.
 */
const ensureInventoryRecord = async (productId, sku, initialQuantity = 0, minStockLevel = 5) => {
    await requireDb();
    const pool = db.createPool();
    const safeSku = toSafeString(sku);
    const safeProductId = toSafeString(productId);

    const [existing] = await pool.query('SELECT 1 FROM inventory WHERE sku = ?', [safeSku]);
    if (existing.length === 0) {
        await pool.query(
            `INSERT INTO inventory (product_id, sku, quantity, min_stock_level)
             VALUES (?, ?, ?, ?)`,
            [safeProductId, safeSku, Math.max(0, Number(initialQuantity) || 0), Math.max(0, Number(minStockLevel) || 5)]
        );
    }
};

/**
 * Asegura que todas las variantes de un producto tengan registro de inventario.
 */
const ensureProductInventory = async (productId) => {
    await requireDb();
    const pool = db.createPool();
    const [variants] = await pool.query(
        'SELECT sku FROM product_variants WHERE product_id = ?',
        [toSafeString(productId)]
    );
    for (const variant of variants) {
        await ensureInventoryRecord(productId, variant.sku);
    }
};

// ─── Movimientos ──────────────────────────────────────────────────────────────

/**
 * Registra un movimiento de inventario.
 */
const recordMovement = async (conn, { productId, sku, type, quantity, previousQuantity, newQuantity, reason, referenceId, createdBy }) => {
    const safeType = toSafeString(type).toLowerCase();
    if (!MOVEMENT_TYPES.has(safeType)) {
        throw new InventoryError(`Tipo de movimiento inválido: ${safeType}`);
    }

    await conn.query(
        `INSERT INTO inventory_movements
         (product_id, sku, movement_type, quantity, previous_quantity, new_quantity, reason, reference_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            toSafeString(productId),
            toSafeString(sku),
            safeType,
            Math.abs(Number(quantity) || 0),
            Number(previousQuantity) || 0,
            Number(newQuantity) || 0,
            reason ? String(reason).slice(0, 255) : null,
            referenceId ? String(referenceId).slice(0, 100) : null,
            createdBy ? String(createdBy).slice(0, 100) : null
        ]
    );
};

/**
 * Obtiene historial de movimientos con filtros opcionales.
 */
const getMovements = async ({ sku, productId, type, limit = 100, offset = 0 } = {}) => {
    await requireDb();
    const pool = db.createPool();

    const conditions = [];
    const params = [];

    if (sku) {
        conditions.push('m.sku = ?');
        params.push(toSafeString(sku));
    }
    if (productId) {
        conditions.push('m.product_id = ?');
        params.push(toSafeString(productId));
    }
    if (type && MOVEMENT_TYPES.has(toSafeString(type).toLowerCase())) {
        conditions.push('m.movement_type = ?');
        params.push(toSafeString(type).toLowerCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
        `SELECT m.*, p.name AS product_name
         FROM inventory_movements m
         JOIN products p ON p.id = m.product_id
         ${whereClause}
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, Math.max(1, Number(limit) || 100), Math.max(0, Number(offset) || 0)]
    );

    const [countResult] = await pool.query(
        `SELECT COUNT(*) AS total FROM inventory_movements m ${whereClause}`,
        params
    );

    return {
        movements: rows,
        total: countResult[0]?.total || 0
    };
};

// ─── Operaciones de stock ─────────────────────────────────────────────────────

/**
 * Añade stock (entrada).
 */
const addStock = async (sku, quantity, { reason, referenceId, createdBy } = {}) => {
    await requireDb();
    const pool = db.createPool();
    const safeSku = toSafeString(sku);
    const qty = Math.max(0, Number(quantity) || 0);

    if (qty <= 0) {
        throw new InventoryError('La cantidad debe ser mayor a 0');
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `SELECT i.*, v.product_id FROM inventory i
             JOIN product_variants v ON v.sku = i.sku
             WHERE i.sku = ? FOR UPDATE`,
            [safeSku]
        );

        if (rows.length === 0) {
            throw new InventoryError(`SKU no encontrado en inventario: ${safeSku}`, 404);
        }

        const record = rows[0];
        const previousQuantity = Number(record.quantity) || 0;
        const newQuantity = previousQuantity + qty;

        await conn.query(
            'UPDATE inventory SET quantity = ? WHERE sku = ?',
            [newQuantity, safeSku]
        );

        await recordMovement(conn, {
            productId: record.product_id,
            sku: safeSku,
            type: 'entrada',
            quantity: qty,
            previousQuantity,
            newQuantity,
            reason: reason || 'Entrada de mercancía',
            referenceId,
            createdBy
        });

        await conn.commit();
        return { sku: safeSku, previousQuantity, newQuantity };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

/**
 * Descuenta stock (salida).
 */
const removeStock = async (sku, quantity, { reason, referenceId, createdBy } = {}) => {
    await requireDb();
    const pool = db.createPool();
    const safeSku = toSafeString(sku);
    const qty = Math.max(0, Number(quantity) || 0);

    if (qty <= 0) {
        throw new InventoryError('La cantidad debe ser mayor a 0');
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `SELECT i.*, v.product_id FROM inventory i
             JOIN product_variants v ON v.sku = i.sku
             WHERE i.sku = ? FOR UPDATE`,
            [safeSku]
        );

        if (rows.length === 0) {
            throw new InventoryError(`SKU no encontrado en inventario: ${safeSku}`, 404);
        }

        const record = rows[0];
        const previousQuantity = Number(record.quantity) || 0;

        if (previousQuantity < qty) {
            throw new InventoryError(
                `Stock insuficiente para SKU ${safeSku}. Disponible: ${previousQuantity}, Solicitado: ${qty}`,
                409
            );
        }

        const newQuantity = previousQuantity - qty;

        await conn.query(
            'UPDATE inventory SET quantity = ? WHERE sku = ?',
            [newQuantity, safeSku]
        );

        await recordMovement(conn, {
            productId: record.product_id,
            sku: safeSku,
            type: 'salida',
            quantity: qty,
            previousQuantity,
            newQuantity,
            reason: reason || 'Salida de mercancía',
            referenceId,
            createdBy
        });

        await conn.commit();
        return { sku: safeSku, previousQuantity, newQuantity };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

/**
 * Ajuste manual de stock.
 */
const adjustStock = async (sku, newQuantity, { reason, createdBy } = {}) => {
    await requireDb();
    const pool = db.createPool();
    const safeSku = toSafeString(sku);
    const targetQty = Number(newQuantity);

    if (!Number.isInteger(targetQty) || targetQty < 0) {
        throw new InventoryError('La cantidad debe ser un entero mayor o igual a 0');
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `SELECT i.*, v.product_id FROM inventory i
             JOIN product_variants v ON v.sku = i.sku
             WHERE i.sku = ? FOR UPDATE`,
            [safeSku]
        );

        if (rows.length === 0) {
            throw new InventoryError(`SKU no encontrado en inventario: ${safeSku}`, 404);
        }

        const record = rows[0];
        const previousQuantity = Number(record.quantity) || 0;

        await conn.query(
            'UPDATE inventory SET quantity = ? WHERE sku = ?',
            [targetQty, safeSku]
        );

        await recordMovement(conn, {
            productId: record.product_id,
            sku: safeSku,
            type: 'ajuste',
            quantity: Math.abs(targetQty - previousQuantity),
            previousQuantity,
            newQuantity: targetQty,
            reason: reason || 'Ajuste manual de inventario',
            referenceId: null,
            createdBy
        });

        await conn.commit();
        return { sku: safeSku, previousQuantity, newQuantity: targetQty };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

/**
 * Actualiza el nivel mínimo de stock para una variante.
 */
const updateMinStockLevel = async (sku, minStockLevel) => {
    await requireDb();
    const pool = db.createPool();
    const safeSku = toSafeString(sku);
    const minLevel = Math.max(0, Number(minStockLevel) || 0);

    const [result] = await pool.query(
        'UPDATE inventory SET min_stock_level = ? WHERE sku = ?',
        [minLevel, safeSku]
    );

    if (result.affectedRows === 0) {
        throw new InventoryError(`SKU no encontrado en inventario: ${safeSku}`, 404);
    }

    return { sku: safeSku, min_stock_level: minLevel };
};

// ─── Alertas de stock bajo ────────────────────────────────────────────────────

/**
 * Obtiene variantes con stock bajo o agotado.
 */
const getLowStockAlerts = async () => {
    await requireDb();
    const pool = db.createPool();
    const [rows] = await pool.query(
        `SELECT i.*, p.name AS product_name, v.size, v.color_name, v.color_hex
         FROM inventory i
         JOIN products p ON p.id = i.product_id
         JOIN product_variants v ON v.sku = i.sku
         WHERE i.quantity <= i.min_stock_level
         ORDER BY i.quantity ASC, p.name`
    );
    return rows;
};

/**
 * Verifica si un SKU tiene stock suficiente.
 * @param {boolean} forUpdate - Si true, usa FOR UPDATE (para transacciones)
 */
const hasEnoughStock = async (sku, requiredQuantity, { conn, forUpdate = false } = {}) => {
    const queryConn = conn || db.createPool();
    const lockClause = forUpdate ? ' FOR UPDATE' : '';
    const [rows] = await queryConn.query(
        `SELECT quantity FROM inventory WHERE sku = ?${lockClause}`,
        [toSafeString(sku)]
    );

    if (rows.length === 0) {
        return { available: 0, enough: false };
    }

    const available = Number(rows[0].quantity) || 0;
    return { available, enough: available >= Number(requiredQuantity) };
};

// ─── Batch operations para pedidos ────────────────────────────────────────────

/**
 * Versión para usar dentro de una transacción existente.
 * NO maneja commit/rollback (eso lo hace el caller).
 */
const deductStockForOrderWithConnection = async (conn, items, { orderId, createdBy } = {}) => {
    for (const item of items) {
        const safeSku = toSafeString(item.sku);
        const qty = Math.max(0, Number(item.quantity) || 0);

        if (!safeSku || qty <= 0) {
            throw new InventoryError('SKU y cantidad válidos son requeridos');
        }

        const [rows] = await conn.query(
            `SELECT i.*, v.product_id FROM inventory i
             JOIN product_variants v ON v.sku = i.sku
             WHERE i.sku = ? FOR UPDATE`,
            [safeSku]
        );

        if (rows.length === 0) {
            const [variantRows] = await conn.query(
                'SELECT product_id FROM product_variants WHERE sku = ?',
                [safeSku]
            );
            if (variantRows.length === 0) {
                throw new InventoryError(`SKU no encontrado: ${safeSku}`, 404);
            }
            await conn.query(
                'INSERT INTO inventory (product_id, sku, quantity, min_stock_level) VALUES (?, ?, 0, 5)',
                [variantRows[0].product_id, safeSku]
            );
            throw new InventoryError(
                `Stock insuficiente para SKU ${safeSku}. Disponible: 0, Solicitado: ${qty}`,
                409
            );
        }

        const record = rows[0];
        const previousQuantity = Number(record.quantity) || 0;

        if (previousQuantity < qty) {
            throw new InventoryError(
                `Stock insuficiente para SKU ${safeSku} (${record.product_id}). Disponible: ${previousQuantity}, Solicitado: ${qty}`,
                409
            );
        }

        const newQuantity = previousQuantity - qty;

        await conn.query(
            'UPDATE inventory SET quantity = ? WHERE sku = ?',
            [newQuantity, safeSku]
        );

        await recordMovement(conn, {
            productId: record.product_id,
            sku: safeSku,
            type: 'salida',
            quantity: qty,
            previousQuantity,
            newQuantity,
            reason: 'Venta por pedido',
            referenceId: orderId ? String(orderId) : null,
            createdBy
        });
    }

    return true;
};

/**
 * Descuenta stock para múltiples SKUs (usado al crear pedidos).
 * Devuelve true si todo OK, o lanza error con detalle si falta stock.
 */
const deductStockForOrder = async (items, { orderId, createdBy } = {}) => {
    // items: [{ sku, quantity }]
    await requireDb();
    const pool = db.createPool();
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        await deductStockForOrderWithConnection(conn, items, { orderId, createdBy });
        await conn.commit();
        return true;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

// ─── Restaurar stock de orden cancelada ───────────────────────────────────────

/**
 * Restaura el stock de una orden cancelada/fallida.
 * Lee order_items y devuelve las cantidades al inventario.
 */
const restoreStockForOrder = async (orderId) => {
    await requireDb();
    const pool = db.createPool();

    const [items] = await pool.query(
        `SELECT variant_sku AS sku, quantity, product_id
         FROM order_items
         WHERE order_id = ?`,
        [orderId]
    );

    if (items.length === 0) {
        return { restored: 0 };
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        for (const item of items) {
            const safeSku = toSafeString(item.sku);
            const qty = Math.max(0, Number(item.quantity) || 0);

            if (!safeSku || qty <= 0) continue;

            const [rows] = await conn.query(
                `SELECT i.*, v.product_id FROM inventory i
                 JOIN product_variants v ON v.sku = i.sku
                 WHERE i.sku = ? FOR UPDATE`,
                [safeSku]
            );

            let record;
            let productId;

            if (rows.length === 0) {
                const [variantRows] = await conn.query(
                    'SELECT product_id FROM product_variants WHERE sku = ?',
                    [safeSku]
                );
                if (variantRows.length === 0) continue;

                productId = variantRows[0].product_id;
                await conn.query(
                    'INSERT INTO inventory (product_id, sku, quantity, min_stock_level) VALUES (?, ?, 0, 5)',
                    [productId, safeSku]
                );
                record = { quantity: 0 };
            } else {
                record = rows[0];
                productId = record.product_id;
            }

            const previousQuantity = Number(record.quantity) || 0;
            const newQuantity = previousQuantity + qty;

            await conn.query(
                'UPDATE inventory SET quantity = ? WHERE sku = ?',
                [newQuantity, safeSku]
            );

            await recordMovement(conn, {
                productId,
                sku: safeSku,
                type: 'entrada',
                quantity: qty,
                previousQuantity,
                newQuantity,
                reason: `Restauración por cancelación de pedido #${orderId}`,
                referenceId: String(orderId),
                createdBy: 'system:payments'
            });
        }

        await conn.commit();
        return { restored: items.length };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    getInventoryBySku,
    getAllInventory,
    getInventoryByProduct,
    ensureInventoryRecord,
    ensureProductInventory,
    addStock,
    removeStock,
    adjustStock,
    updateMinStockLevel,
    getLowStockAlerts,
    hasEnoughStock,
    deductStockForOrder,
    deductStockForOrderWithConnection,
    restoreStockForOrder,
    getMovements,
    InventoryError,
    MOVEMENT_TYPES
};
