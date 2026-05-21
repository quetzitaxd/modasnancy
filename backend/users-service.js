'use strict';

/**
 * users-service.js
 *
 * CRUD de usuarios del sistema con roles.
 */

const crypto = require('crypto');
const db = require('./db');

const ROLES = new Set(['admin', 'vendedor', 'operador_pedidos', 'operador_stock']);

const toSafeString = (value) => String(value || '').trim();

const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
};

const verifyPassword = (password, stored) => {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
};

const requireDb = async () => {
    if (!(await db.verifyConnection())) {
        throw new Error('Base de datos no disponible');
    }
};

const getUserByUsername = async (username) => {
    await requireDb();
    const pool = db.createPool();
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ? AND is_active = 1', [toSafeString(username)]);
    return rows[0] || null;
};

const getUserById = async (id) => {
    await requireDb();
    const pool = db.createPool();
    const [rows] = await pool.query('SELECT id, username, name, email, role, is_active, created_at FROM users WHERE id = ?', [Number(id)]);
    return rows[0] || null;
};

const getAllUsers = async () => {
    await requireDb();
    const pool = db.createPool();
    const [rows] = await pool.query('SELECT id, username, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC');
    return rows;
};

const createUser = async ({ username, password, name, email, role }) => {
    await requireDb();
    const safeUsername = toSafeString(username);
    const safeName = toSafeString(name);
    const safeRole = toSafeString(role).toLowerCase();

    if (!safeUsername || !password || !safeName) {
        throw new Error('username, password y name son requeridos');
    }
    if (!ROLES.has(safeRole)) {
        throw new Error(`Rol invalido. Permitidos: ${[...ROLES].join(', ')}`);
    }

    const pool = db.createPool();
    const passwordHash = hashPassword(password);

    try {
        const [result] = await pool.query(
            'INSERT INTO users (username, password_hash, name, email, role) VALUES (?, ?, ?, ?, ?)',
            [safeUsername, passwordHash, safeName, toSafeString(email) || null, safeRole]
        );
        return getUserById(result.insertId);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            throw new Error('El nombre de usuario ya existe');
        }
        throw err;
    }
};

const updateUser = async (id, { name, email, role, is_active, password }) => {
    await requireDb();
    const safeId = Number(id);
    if (!safeId || safeId <= 0) throw new Error('ID invalido');

    const pool = db.createPool();
    const updates = [];
    const values = [];

    if (name !== undefined) {
        updates.push('name = ?');
        values.push(toSafeString(name));
    }
    if (email !== undefined) {
        updates.push('email = ?');
        values.push(toSafeString(email) || null);
    }
    if (role !== undefined) {
        const safeRole = toSafeString(role).toLowerCase();
        if (!ROLES.has(safeRole)) throw new Error('Rol invalido');
        updates.push('role = ?');
        values.push(safeRole);
    }
    if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active ? 1 : 0);
    }
    if (password) {
        updates.push('password_hash = ?');
        values.push(hashPassword(password));
    }

    if (updates.length === 0) {
        throw new Error('No hay campos para actualizar');
    }

    values.push(safeId);
    const [result] = await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) throw new Error('Usuario no encontrado');
    return getUserById(safeId);
};

const deleteUser = async (id) => {
    await requireDb();
    const safeId = Number(id);
    if (!safeId || safeId <= 0) throw new Error('ID invalido');

    const pool = db.createPool();

    // Verificar que no sea el último admin
    const [userRows] = await pool.query('SELECT role FROM users WHERE id = ?', [safeId]);
    if (userRows.length === 0) throw new Error('Usuario no encontrado');

    if (userRows[0].role === 'admin') {
        const [adminCount] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE role = ? AND is_active = 1', ['admin']);
        if (adminCount[0].count <= 1) {
            throw new Error('No se puede eliminar el último administrador activo');
        }
    }

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [safeId]);
    if (result.affectedRows === 0) throw new Error('Usuario no encontrado');
    return { success: true };
};

const authenticateUser = async (username, password) => {
    const user = await getUserByUsername(username);
    if (!user) return null;
    if (!verifyPassword(password, user.password_hash)) return null;
    return {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
    };
};

const ensureAdminExists = async () => {
    await requireDb();
    const pool = db.createPool();
    const [rows] = await pool.query('SELECT 1 FROM users WHERE role = ? LIMIT 1', ['admin']);
    if (rows.length === 0) {
        const adminUser = process.env.ADMIN_USER || 'admin';
        const adminPass = process.env.ADMIN_PASS || crypto.randomBytes(16).toString('base64url');
        try {
            await createUser({
                username: adminUser,
                password: adminPass,
                name: 'Administrador',
                email: null,
                role: 'admin'
            });
            if (!process.env.ADMIN_PASS) {
                console.warn(`[Users] Admin creado con password aleatorio. Anótalo: ${adminPass}`);
            } else {
                console.log(`[Users] Admin creado: ${adminUser}`);
            }
        } catch (err) {
            console.error('[Users] Error creando admin por defecto:', err.message);
        }
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    getUserByUsername,
    createUser,
    updateUser,
    deleteUser,
    authenticateUser,
    ensureAdminExists,
    ROLES
};
