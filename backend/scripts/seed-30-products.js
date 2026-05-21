'use strict';

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Cargar entorno
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const db = require('../db');

const PRODUCTS_DIR = path.join(__dirname, '..', '..', 'products');

const CATEGORIES = ['vestidos', 'blusas', 'faldas', 'pantalones', 'shorts', 'tops', 'conjuntos', 'kimonos', 'enterizos', 'conjuntos-lenceria'];

const PRODUCT_NAMES = [
    'Vestido Floral Largo', 'Blusa Satén Elegante', 'Falda Plisada Midi', 'Pantalón Wide Leg', 'Short Denim Casual',
    'Top Crop Encaje', 'Conjunto Verano Chic', 'Kimono Boho Playero', 'Enterizo Elegante Noche', 'Vestido Cocktail Rojo',
    'Blusa Manga Lino', 'Falda Lápiz Negra', 'Pantalón Cargo Utility', 'Short Lino Fresco', 'Top Halter Fiesta',
    'Conjunto Lencería Floral', 'Kimono Seda Oriental', 'Vestido Maxi Playero', 'Blusa Cruzada Verano', 'Falda Círculo Vuelo',
    'Pantalón Palazzo Elegante', 'Short Tiro Alto', 'Top Básico Algodón', 'Conjunto Deportivo Active', 'Vestido Bodycon Verde',
    'Blusa Volantes Romántica', 'Falda Cuadros Escocesa', 'Pantalón Chino Clásico', 'Short Mezclilla Roto', 'Top Tubo Brillante'
];

const SIZES_POOL = ['XS', 'S', 'M', 'L', 'XL', 'Unica'];

const COLORS_POOL = [
    { name: 'Negro', hex: '#1a1a1a' },
    { name: 'Blanco', hex: '#f8f8f8' },
    { name: 'Rojo', hex: '#c0392b' },
    { name: 'Azul', hex: '#2980b9' },
    { name: 'Rosa', hex: '#e84393' },
    { name: 'Verde', hex: '#27ae60' },
    { name: 'Beige', hex: '#d4b895' },
    { name: 'Gris', hex: '#7f8c8d' },
    { name: 'Nude', hex: '#e5c0a8' },
    { name: 'Lila', hex: '#9b59b6' },
    { name: 'Coral', hex: '#ff7675' },
    { name: 'Amarillo', hex: '#f1c40f' },
    { name: 'Vino', hex: '#6b1c3b' },
    { name: 'Teal', hex: '#1abc9c' },
    { name: 'Marino', hex: '#2c3e50' }
];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr, count) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

let globalSkuCounter = 1000;
function generateSKU(productId, size, color, index) {
    const sizeCode = size.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 3);
    const colorCode = color.substring(1, 4).toUpperCase();
    globalSkuCounter++;
    return `PRD-${String(globalSkuCounter).padStart(5, '0')}-${sizeCode}${colorCode}`;
}

async function seed() {
    console.log('Verificando conexión a la base de datos...');

    if (!(await db.verifyConnection())) {
        console.error('ERROR: No hay conexión a la base de datos.');
        process.exit(1);
    }

    const pool = db.createPool();
    let created = 0;
    let skipped = 0;

    for (let i = 0; i < PRODUCT_NAMES.length; i++) {
        const productId = `demo-${String(i + 1).padStart(3, '0')}`;
        const name = PRODUCT_NAMES[i];
        const category = CATEGORIES[i % CATEGORIES.length];
        const price = randomInt(15000, 125000);
        const description = `Producto de prueba: ${name}. Ideal para ${category}. Comodidad y estilo en un solo diseño.`;

        try {
            // Verificar si ya existe
            const [existing] = await pool.query('SELECT id FROM products WHERE id = ?', [productId]);
            if (existing.length > 0) {
                console.log(`  [SKIP] ${productId} ya existe.`);
                skipped++;
                continue;
            }

            // Crear carpeta del producto
            const productPath = path.join(PRODUCTS_DIR, productId);
            await fs.mkdir(productPath, { recursive: true });

            // Elegir tallas y colores aleatorios
            const numSizes = randomInt(2, 4);
            const numColors = randomInt(1, 3);
            const sizes = pickRandom(SIZES_POOL, numSizes);
            const colors = pickRandom(COLORS_POOL, numColors);

            // Generar variantes
            const variants = [];
            let variantIdx = 0;
            for (const size of sizes) {
                for (const color of colors) {
                    variants.push({
                        sku: generateSKU(productId, size, color.hex, variantIdx++),
                        size,
                        color_name: color.name,
                        color_hex: color.hex,
                        price
                    });
                }
            }

            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                await connection.query(
                    'INSERT INTO products (id, name, description, category, price, is_active, wholesale_enabled, wholesale_min_qty, wholesale_discount_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [productId, name, description, category, price, 1, 0, 0, 0]
                );

                for (const variant of variants) {
                    await connection.query(
                        'INSERT INTO product_variants (product_id, sku, price, size, color_name, color_hex) VALUES (?, ?, ?, ?, ?, ?)',
                        [productId, variant.sku, variant.price, variant.size, variant.color_name, variant.color_hex]
                    );
                }

                for (const variant of variants) {
                    const stock = randomInt(0, 35);
                    await connection.query(
                        `INSERT INTO inventory (product_id, sku, quantity, min_stock_level)
                         VALUES (?, ?, ?, 5)
                         ON DUPLICATE KEY UPDATE product_id = product_id`,
                        [productId, variant.sku, stock]
                    );
                }

                await connection.commit();
                created++;
                console.log(`  [OK] ${productId} - ${name} (${variants.length} variantes)`);
            } catch (err) {
                await connection.rollback();
                console.error(`  [ERR] ${productId}:`, err.message);
            } finally {
                connection.release();
            }
        } catch (err) {
            console.error(`  [ERR] ${productId}:`, err.message);
        }
    }

    console.log(`\nResumen: ${created} creados, ${skipped} omitidos.`);
    process.exit(0);
}

seed().catch((err) => {
    console.error('Error fatal:', err);
    process.exit(1);
});
