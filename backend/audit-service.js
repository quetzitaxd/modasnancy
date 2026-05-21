'use strict';

/**
 * audit-service.js
 *
 * Registro de auditoria: quien hizo y deshizo.
 */

const db = require('./db');

const toSafeString = (value) => String(value || '').trim();

const requireDb = async () => {
    if (!(await db.verifyConnection())) {
        throw new Error('Base de datos no disponible');
    }
};

const safeStringify = (value) => {
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
};

const log = async ({ tableName, recordId, action, oldValues, newValues, changedBy }) => {
    await requireDb();
    const pool = db.createPool();
    await pool.query(
        `INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, changed_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            toSafeString(tableName),
            toSafeString(recordId),
            toSafeString(action),
            oldValues ? safeStringify(oldValues) : null,
            newValues ? safeStringify(newValues) : null,
            toSafeString(changedBy)
        ]
    );
};

const getLogs = async ({ tableName, recordId, action, limit = 100, offset = 0 } = {}) => {
    await requireDb();
    const pool = db.createPool();
    const conditions = [];
    const params = [];

    if (tableName) {
        conditions.push('table_name = ?');
        params.push(toSafeString(tableName));
    }
    if (recordId) {
        conditions.push('record_id = ?');
        params.push(toSafeString(recordId));
    }
    if (action) {
        conditions.push('action = ?');
        params.push(toSafeString(action));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
        `SELECT * FROM audit_logs ${whereClause} ORDER BY changed_at DESC LIMIT ? OFFSET ?`,
        [...params, Math.max(1, Number(limit) || 100), Math.max(0, Number(offset) || 0)]
    );

    const [countResult] = await pool.query(
        `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`,
        params
    );

    return {
        logs: rows,
        total: countResult[0]?.total || 0
    };
};

module.exports = {
    log,
    getLogs
};
