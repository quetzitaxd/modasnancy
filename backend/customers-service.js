'use strict';

/**
 * customers-service.js
 *
 * CRUD de clientes persistentes.
 * - phone es UNIQUE (identificador principal).
 * - Se auto-pobla desde orders-service.createOrder mediante upsertCustomer().
 */

const db = require('./db');

class CustomerError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

const toSafeString = (value) => String(value || '').trim();

const requireString = (value, fieldName) => {
    const clean = toSafeString(value);
    if (!clean) {
        throw new CustomerError(`El campo '${fieldName}' es obligatorio`);
    }
    return clean;
};

// ─── Upsert: inserta o actualiza cliente desde un pedido ──────────────────────

const upsertCustomer = async ({
    customer_name,
    phone,
    email,
    address,
    city,
    notes,
    total
}) => {
    if (!(await db.verifyConnection())) {
        throw new CustomerError('Base de datos no disponible', 503);
    }

    const name  = requireString(customer_name, 'customer_name');
    const cleanPhone = requireString(phone, 'phone');
    const cleanEmail = email ? toSafeString(email) : null;
    const cleanAddress = address ? toSafeString(address) : null;
    const cleanCity = city ? toSafeString(city) : null;
    const cleanNotes = notes ? toSafeString(notes) : null;
    const spent = Number(total) || 0;

    const pool = db.createPool();

    // Buscar si ya existe
    const [existing] = await pool.query(
        'SELECT id, order_count, total_spent FROM customers WHERE phone = ?',
        [cleanPhone]
    );

    if (existing.length > 0) {
        const customer = existing[0];
        const newOrderCount = (customer.order_count || 0) + 1;
        const newTotalSpent = Number(customer.total_spent || 0) + spent;

        await pool.query(
            `UPDATE customers
             SET name = ?, email = ?, address = ?, city = ?, notes = ?,
                 order_count = ?, total_spent = ?
             WHERE id = ?`,
            [name, cleanEmail, cleanAddress, cleanCity, cleanNotes, newOrderCount, newTotalSpent, customer.id]
        );

        return { id: customer.id, updated: true };
    }

    const [result] = await pool.query(
        `INSERT INTO customers (name, phone, email, address, city, notes, order_count, total_spent)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [name, cleanPhone, cleanEmail, cleanAddress, cleanCity, cleanNotes, spent]
    );

    return { id: result.insertId, updated: false };
};

// ─── Listar todos ─────────────────────────────────────────────────────────────

const getAllCustomers = async () => {
    if (!(await db.verifyConnection())) {
        throw new CustomerError('Base de datos no disponible', 503);
    }

    const pool = db.createPool();
    const [rows] = await pool.query(
        `SELECT * FROM customers ORDER BY updated_at DESC`
    );

    return rows;
};

// ─── Obtener por ID ───────────────────────────────────────────────────────────

const getCustomerById = async (id) => {
    if (!(await db.verifyConnection())) {
        throw new CustomerError('Base de datos no disponible', 503);
    }

    const pool = db.createPool();
    const [rows] = await pool.query(
        'SELECT * FROM customers WHERE id = ?',
        [Number(id)]
    );

    if (rows.length === 0) {
        throw new CustomerError('Cliente no encontrado', 404);
    }

    return rows[0];
};

// ─── Pedidos de un cliente (buscados por teléfono) ────────────────────────────

const getCustomerOrders = async (phone, customerName) => {
    if (!(await db.verifyConnection())) {
        throw new CustomerError('Base de datos no disponible', 503);
    }

    const pool = db.createPool();
    const cleanPhone = toSafeString(phone);
    const cleanName = toSafeString(customerName);

    let orders;

    if (cleanPhone) {
        [orders] = await pool.query(
            `SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC`,
            [cleanPhone]
        );
    }

    if ((!orders || orders.length === 0) && cleanName) {
        [orders] = await pool.query(
            `SELECT * FROM orders WHERE customer_name = ? ORDER BY created_at DESC`,
            [cleanName]
        );
    }

    if (!orders || orders.length === 0) {
        return [];
    }

    const orderIds = orders.map((o) => o.id);
    const placeholders = orderIds.map(() => '?').join(',');

    const [items] = await pool.query(
        `SELECT * FROM order_items WHERE order_id IN (${placeholders})`,
        orderIds
    );

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

// ─── Crear manualmente ────────────────────────────────────────────────────────

const createCustomer = async (body) => {
    if (!(await db.verifyConnection())) {
        throw new CustomerError('Base de datos no disponible', 503);
    }

    const name  = requireString(body?.name, 'name');
    const phone = requireString(body?.phone, 'phone');
    const email = body?.email ? toSafeString(body.email) : null;
    const address = body?.address ? toSafeString(body.address) : null;
    const city = body?.city ? toSafeString(body.city) : null;
    const notes = body?.notes ? toSafeString(body.notes) : null;

    const pool = db.createPool();

    try {
        const [result] = await pool.query(
            `INSERT INTO customers (name, phone, email, address, city, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, phone, email, address, city, notes]
        );

        return { id: result.insertId };
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            throw new CustomerError('Ya existe un cliente con ese numero de telefono', 409);
        }
        throw err;
    }
};

// ─── Actualizar ───────────────────────────────────────────────────────────────

const updateCustomer = async (id, body) => {
    if (!(await db.verifyConnection())) {
        throw new CustomerError('Base de datos no disponible', 503);
    }

    const name = body?.name ? toSafeString(body.name) : null;
    const phone = body?.phone ? toSafeString(body.phone) : null;
    const email = body?.email !== undefined ? (body.email ? toSafeString(body.email) : null) : undefined;
    const address = body?.address !== undefined ? (body.address ? toSafeString(body.address) : null) : undefined;
    const city = body?.city !== undefined ? (body.city ? toSafeString(body.city) : null) : undefined;
    const notes = body?.notes !== undefined ? (body.notes ? toSafeString(body.notes) : null) : undefined;

    if (name !== null && !name) {
        throw new CustomerError('El nombre no puede estar vacio', 400);
    }

    const pool = db.createPool();
    const fields = [];
    const values = [];

    if (name) { fields.push('name = ?'); values.push(name); }
    if (phone) { fields.push('phone = ?'); values.push(phone); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (address !== undefined) { fields.push('address = ?'); values.push(address); }
    if (city !== undefined) { fields.push('city = ?'); values.push(city); }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }

    if (fields.length === 0) {
        throw new CustomerError('No hay campos para actualizar', 400);
    }

    values.push(Number(id));

    try {
        const [result] = await pool.query(
            `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new CustomerError('Cliente no encontrado', 404);
        }

        return { success: true };
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            throw new CustomerError('Ya existe un cliente con ese numero de telefono', 409);
        }
        throw err;
    }
};

// ─── Eliminar ─────────────────────────────────────────────────────────────────

const deleteCustomer = async (id) => {
    if (!(await db.verifyConnection())) {
        throw new CustomerError('Base de datos no disponible', 503);
    }

    const pool = db.createPool();
    const [result] = await pool.query(
        'UPDATE customers SET is_active = 0 WHERE id = ?',
        [Number(id)]
    );

    if (result.affectedRows === 0) {
        throw new CustomerError('Cliente no encontrado', 404);
    }

    return { success: true };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    upsertCustomer,
    getAllCustomers,
    getCustomerById,
    getCustomerOrders,
    createCustomer,
    updateCustomer,
    deleteCustomer
};
