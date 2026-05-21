const db = require('./db');

const TZ_GT = '-06:00';

let dashboardCache = null;
let dashboardCacheTime = 0;
const CACHE_TTL_MS = 30000;

function todayGtClause(column) {
    return `DATE(CONVERT_TZ(${column}, '+00:00', '${TZ_GT}')) = CURDATE()`;
}

function thisMonthGtClause(column) {
    return `YEAR(CONVERT_TZ(${column}, '+00:00', '${TZ_GT}')) = YEAR(CURDATE()) AND MONTH(CONVERT_TZ(${column}, '+00:00', '${TZ_GT}')) = MONTH(CURDATE())`;
}

async function getDashboardSummary() {
    const now = Date.now();
    if (dashboardCache && (now - dashboardCacheTime) < CACHE_TTL_MS) {
        return dashboardCache;
    }

    const pool = db.createPool();
    const conn = await pool.getConnection();
    try {
        // Ventas hoy (solo pedidos no cancelados)
        const [[salesToday]] = await conn.query(
            `SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE status != 'cancelado' AND ${todayGtClause('created_at')}`
        );
        // Ventas del mes
        const [[salesMonth]] = await conn.query(
            `SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE status != 'cancelado' AND ${thisMonthGtClause('created_at')}`
        );
        // Pedidos pendientes
        const [[pendingOrders]] = await conn.query(
            `SELECT COUNT(*) AS count FROM orders WHERE status = 'pendiente'`
        );
        // Productos activos
        const [[activeProducts]] = await conn.query(
            `SELECT COUNT(*) AS count FROM products WHERE is_active = 1`
        );
        // Alertas de stock
        const [[stockAlerts]] = await conn.query(
            `SELECT COUNT(*) AS count FROM inventory WHERE quantity <= min_stock_level`
        );
        // Total clientes
        const [[totalCustomers]] = await conn.query(
            `SELECT COUNT(*) AS count FROM customers`
        );
        // Movimientos hoy
        const [[movementsToday]] = await conn.query(
            `SELECT COUNT(*) AS count FROM inventory_movements WHERE ${todayGtClause('created_at')}`
        );
        // Total pedidos hoy
        const [[ordersToday]] = await conn.query(
            `SELECT COUNT(*) AS count FROM orders WHERE ${todayGtClause('created_at')}`
        );

        const result = {
            salesToday: Number(salesToday.total) || 0,
            salesMonth: Number(salesMonth.total) || 0,
            pendingOrders: Number(pendingOrders.count) || 0,
            activeProducts: Number(activeProducts.count) || 0,
            stockAlerts: Number(stockAlerts.count) || 0,
            totalCustomers: Number(totalCustomers.count) || 0,
            movementsToday: Number(movementsToday.count) || 0,
            ordersToday: Number(ordersToday.count) || 0
        };

        dashboardCache = result;
        dashboardCacheTime = Date.now();

        return result;
    } finally {
        conn.release();
    }
}

async function getLowStockAlerts(limit = 5) {
    const pool = db.createPool();
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT i.sku, i.quantity, i.min_stock_level, p.name AS product_name
             FROM inventory i
             JOIN products p ON i.product_id = p.id
             WHERE i.quantity <= i.min_stock_level
             ORDER BY i.quantity ASC, i.min_stock_level ASC
             LIMIT ?`,
            [limit]
        );
        return rows;
    } finally {
        conn.release();
    }
}

async function getRecentOrders(limit = 5) {
    const pool = db.createPool();
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT id, customer_name, total, status, payment_method, source, created_at
             FROM orders
             ORDER BY created_at DESC
             LIMIT ?`,
            [limit]
        );
        return rows;
    } finally {
        conn.release();
    }
}

async function getRecentAudit(limit = 5) {
    const pool = db.createPool();
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT table_name, record_id, action, changed_by, changed_at
             FROM audit_logs
             ORDER BY changed_at DESC
             LIMIT ?`,
            [limit]
        );
        return rows;
    } finally {
        conn.release();
    }
}

async function getTopProducts(limit = 5) {
    const pool = db.createPool();
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT oi.product_id, oi.product_name, SUM(oi.quantity) AS total_sold, SUM(oi.price * oi.quantity) AS total_revenue
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE o.status != 'cancelado'
             GROUP BY oi.product_id, oi.product_name
             ORDER BY total_sold DESC
             LIMIT ?`,
            [limit]
        );
        return rows;
    } finally {
        conn.release();
    }
}

async function getTopCustomers(limit = 5) {
    const pool = db.createPool();
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT id, name, phone, order_count, total_spent
             FROM customers
             ORDER BY total_spent DESC
             LIMIT ?`,
            [limit]
        );
        return rows;
    } finally {
        conn.release();
    }
}

async function getVendorPerformance() {
    const pool = db.createPool();
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT COALESCE(created_by, 'Catálogo') AS vendor, COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_sales
             FROM orders
             WHERE status != 'cancelado'
             GROUP BY COALESCE(created_by, 'Catálogo')
             ORDER BY total_sales DESC`
        );
        return rows;
    } finally {
        conn.release();
    }
}

async function getSalesTrend(days = 7) {
    const pool = db.createPool();
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT DATE(CONVERT_TZ(created_at, '+00:00', '${TZ_GT}')) AS day, COALESCE(SUM(total), 0) AS total
             FROM orders
             WHERE status != 'cancelado'
               AND created_at >= DATE_SUB(CONVERT_TZ(NOW(), '+00:00', '${TZ_GT}'), INTERVAL ? DAY)
             GROUP BY day
             ORDER BY day ASC`,
            [days]
        );

        const [[todayRow]] = await conn.query(
            `SELECT DATE(CONVERT_TZ(NOW(), '+00:00', '${TZ_GT}')) AS today`
        );
        const todayValue = todayRow && todayRow.today;
        let today;
        if (typeof todayValue === 'string' && todayValue.trim()) {
            today = new Date(todayValue + 'T12:00:00');
        } else {
            today = new Date();
        }
        if (Number.isNaN(today.getTime())) {
            today = new Date();
        }

        const result = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const iso = d.toISOString().slice(0, 10);
            const found = rows.find((r) => {
                // r.day may be a date string like 'YYYY-MM-DD' or an invalid value.
                try {
                    const dayVal = r && r.day;
                    if (dayVal == null) return false;
                    const dayStr = String(dayVal);
                    // Compare as string to avoid Date parsing issues with invalid dates
                    return dayStr.slice(0, 10) === iso;
                } catch {
                    return false;
                }
            });
            result.push({
                day: iso,
                label: d.toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric' }),
                total: found ? Number(found.total) : 0
            });
        }
        return result;
    } finally {
        conn.release();
    }
}

async function getOrderStatusDistribution() {
    const pool = db.createPool();
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT status, COUNT(*) AS count FROM orders GROUP BY status`
        );
        const map = { pendiente: 0, confirmado: 0, enviado: 0, cancelado: 0 };
        let total = 0;
        rows.forEach((r) => {
            const key = String(r.status).toLowerCase();
            const count = Number(r.count) || 0;
            if (map[key] !== undefined) map[key] = count;
            total += count;
        });
        return { ...map, total };
    } finally {
        conn.release();
    }
}

module.exports = {
    getDashboardSummary,
    getLowStockAlerts,
    getRecentOrders,
    getRecentAudit,
    getTopProducts,
    getTopCustomers,
    getVendorPerformance,
    getSalesTrend,
    getOrderStatusDistribution
};
