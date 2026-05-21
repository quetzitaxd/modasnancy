let pool = null;

const createPool = () => {
    if (pool) {
        return pool;
    }

    const mysql = require('mysql2/promise');
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'db',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'tienda_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    return pool;
};

const verifyConnection = async () => {
    if (process.env.DB_ENABLED !== 'true') {
        console.log('Database system is DISABLED (DB_ENABLED != true). Falling back to Filesystem.');
        return false;
    }

    try {
        const currentPool = createPool();
        const connection = await currentPool.getConnection();
        try {
            await connection.query('SELECT 1');
            console.log('Database system is ENABLED and CONNECTED.');
            return true;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('CRITICAL: Database system is ENABLED but CONNECTION FAILED:', err.message);
        return false;
    }
};

module.exports = {
    createPool,
    verifyConnection
};
