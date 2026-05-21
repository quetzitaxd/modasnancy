const db = require('../db');
(async () => {
    const p = db.createPool();
    const [r1] = await p.query('SELECT COUNT(*) as c FROM products');
    const [r2] = await p.query('SELECT COUNT(*) as c FROM product_variants');
    const [r3] = await p.query('SELECT COUNT(*) as c FROM inventory');
    console.log('Productos:', r1[0].c, '| Variantes:', r2[0].c, '| Inventario:', r3[0].c);
    process.exit(0);
})();
