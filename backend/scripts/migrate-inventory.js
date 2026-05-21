'use strict';

const fsSync = require('fs');
const path = require('path');

// Cargar entorno si existe
try {
    const dotenv = require('dotenv');
    const envPath = fsSync.existsSync(path.join(__dirname, '..', '..', '.env'))
        ? path.join(__dirname, '..', '..', '.env')
        : path.join(__dirname, '..', '.env');
    dotenv.config({ path: envPath });
} catch (e) {
    // Docker ya provee las variables
}

const db = require('../db');
const inventoryService = require('../inventory-service');

async function migrateInventory() {
    console.log('--- Iniciando Migración de Inventario ---');

    if (!(await db.verifyConnection())) {
        console.error('ERROR: No se pudo conectar a la base de datos.');
        process.exit(1);
    }

    const pool = db.createPool();

    // Obtener todas las variantes existentes
    const [variants] = await pool.query(
        `SELECT v.sku, v.product_id, p.name AS product_name
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         ORDER BY v.product_id, v.sku`
    );

    console.log(`Se encontraron ${variants.length} variantes para inicializar.`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const variant of variants) {
        try {
            const [existing] = await pool.query('SELECT 1 FROM inventory WHERE sku = ?', [variant.sku]);
            if (existing.length > 0) {
                skipped += 1;
                continue;
            }

            await inventoryService.ensureInventoryRecord(variant.product_id, variant.sku, 0, 5);
            created += 1;
            console.log(`- Inventario creado para SKU: ${variant.sku} (${variant.product_name})`);
        } catch (err) {
            errors += 1;
            console.error(`- Error con SKU ${variant.sku}: ${err.message}`);
        }
    }

    console.log(`\n--- Resumen ---`);
    console.log(`Creados: ${created}`);
    console.log(`Ya existentes (saltados): ${skipped}`);
    console.log(`Errores: ${errors}`);
    console.log(`Total variantes: ${variants.length}`);
    console.log('\n--- Migración de Inventario Finalizada ---');
    process.exit(0);
}

migrateInventory();
