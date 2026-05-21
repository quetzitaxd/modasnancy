const db = require('../db');

const migrations = [
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS email VARCHAR(150) DEFAULT NULL",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method ENUM('efectivo', 'cubopago') DEFAULT 'efectivo'",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status ENUM('pendiente', 'pagado', 'fallido', 'reembolsado') DEFAULT 'pendiente'",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cubopago_transaction_id VARCHAR(255)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cubopago_authorization VARCHAR(255)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE orders MODIFY COLUMN status ENUM('pendiente', 'confirmado', 'enviado', 'cancelado') DEFAULT 'pendiente'"
];

(async () => {
    const pool = db.createPool();
    for (const sql of migrations) {
        try {
            await pool.query(sql);
            console.log('OK:', sql.substring(0, 70));
        } catch (err) {
            console.error('ERR:', sql.substring(0, 70), '|', err.message);
        }
    }
    console.log('\nMigracion completada.');
    process.exit(0);
})();
