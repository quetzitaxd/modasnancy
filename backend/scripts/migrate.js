'use strict';

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const pathAlias = require('path');

// Cargar entorno si existe (opcional)
try {
    const dotenv = require('dotenv');
    const envPath = fsSync.existsSync(path.join(__dirname, '..', '..', '.env')) 
        ? path.join(__dirname, '..', '..', '.env') 
        : path.join(__dirname, '..', '.env');
    dotenv.config({ path: envPath });
} catch (e) {
    // Si no está dotenv o no se encuentra el archivo, ignoramos (Docker ya provee las variables)
}

const db = require('../db');

/**
 * Lógica de parseo heredada del sistema antiguo de archivos.
 */
const parseInfoLegacy = (content) => {
    const cleanContent = String(content || '').replace(/^\uFEFF/, '');
    const lines = cleanContent.split(/\r?\n/);
    const obj = {};

    for (const line of lines) {
        if (!line.trim()) continue;
        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) continue;

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        obj[key] = value;
    }

    // Normalización mínima
    obj.name = obj.name || '';
    obj.price = (obj.price || '').trim();
    obj.category = obj.category || 'otros';
    obj.description = obj.description || '';

    if (obj.sizes) {
        obj.sizes = obj.sizes.split(',').map((item) => item.trim()).filter(Boolean);
    } else {
        obj.sizes = [];
    }

    if (obj.colors) {
        try {
            const parsedColors = JSON.parse(obj.colors);
            obj.colors = Array.isArray(parsedColors) ? parsedColors : [];
        } catch {
            obj.colors = [];
        }
    } else {
        obj.colors = [];
    }
    
    obj.wholesale_enabled = String(obj.wholesale_enabled) === '1';
    obj.wholesale_min_qty = parseInt(obj.wholesale_min_qty) || 0;
    obj.wholesale_discount_percent = parseFloat(obj.wholesale_discount_percent) || 0;
    obj.is_active = String(obj.is_active) !== '0';

    return obj;
};

const normalizeHexColor = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    const match = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return '#d1a3a4';
    if (raw.length === 4) return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
    return raw;
};

const normalizeString = (str) => {
    return String(str || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
};

const generateSku = (productId, colorName, size) => {
    const parts = [normalizeString(productId)];
    if (colorName) parts.push(normalizeString(colorName));
    if (size) parts.push(normalizeString(size));
    return parts.filter(Boolean).join('-');
};

async function migrate() {
    console.log('--- Iniciando Migración de Archivos a Base de Datos ---');
    
    // Ruta de datos (ajustada para el contenedor Docker)
    const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(__dirname, '..', 'data');
    const PRODUCTS_DIR = path.join(DATA_DIR, 'products');

    console.log(`Buscando productos en: ${PRODUCTS_DIR}`);

    if (!fsSync.existsSync(PRODUCTS_DIR)) {
        console.error('ERROR: La carpeta de productos no existe.');
        process.exit(1);
    }

    if (!(await db.verifyConnection())) {
        console.error('ERROR: No se pudo conectar a la base de datos. Verifica tu entorno.');
        process.exit(1);
    }

    const pool = db.createPool();
    const entries = await fs.readdir(PRODUCTS_DIR, { withFileTypes: true });
    const productFolders = entries.filter(e => e.isDirectory()).map(e => e.name);

    console.log(`Se encontraron ${productFolders.length} carpetas de productos.`);

    for (const folderId of productFolders) {
        console.log(`\nProcesando [${folderId}]...`);
        
        try {
            // Verificar si ya existe en DB
            const [rows] = await pool.query('SELECT id FROM products WHERE id = ?', [folderId]);
            if (rows.length > 0) {
                console.log(`- El producto ya existe en la base de datos. Saltando.`);
                continue;
            }

            const productPath = path.join(PRODUCTS_DIR, folderId);
            const infoPath = path.join(productPath, 'info.txt');
            let info = { name: folderId, category: 'otros', price: null, description: '', is_active: 1 };

            if (fsSync.existsSync(infoPath)) {
                const content = await fs.readFile(infoPath, 'utf-8');
                info = parseInfoLegacy(content);
                console.log(`- info.txt encontrado para "${info.name}"`);
            } else {
                console.log(`- No se encontró info.txt. Usando datos básicos.`);
            }

            // Inserción en DB
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                await connection.query(
                    'INSERT INTO products (id, name, description, category, price, is_active, wholesale_enabled, wholesale_min_qty, wholesale_discount_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        folderId,
                        info.name || folderId,
                        info.description || '',
                        info.category || 'otros',
                        info.price || null,
                        info.is_active ? 1 : 0,
                        info.wholesale_enabled ? 1 : 0,
                        info.wholesale_min_qty || 0,
                        info.wholesale_discount_percent || 0
                    ]
                );

                // Generar variantes básicas si no hay info.txt o fallba
                const sizes = info.sizes && info.sizes.length > 0 ? info.sizes : ['Unica'];
                const colors = info.colors && info.colors.length > 0 ? info.colors : [{ name: 'Estandar', hex: '#000000' }];

                for (const size of sizes) {
                    for (const color of colors) {
                        const variantName = color.name || color.label || 'Estandar';
                        const variantHex = normalizeHexColor(color.hex || color.color || '#000000');
                        const sku = generateSku(folderId, variantName, size);

                        await connection.query(
                            'INSERT INTO product_variants (product_id, sku, price, size, color_name, color_hex) VALUES (?, ?, ?, ?, ?, ?)',
                            [folderId, sku, null, size, variantName, variantHex]
                        );
                    }
                }

                await connection.commit();
                console.log(`- MIGRADO EXITOSAMENTE.`);
            } catch (dbErr) {
                await connection.rollback();
                console.error(`- Error al insertar en DB: ${dbErr.message}`);
            } finally {
                connection.release();
            }

        } catch (err) {
            console.error(`- Error procesando carpeta ${folderId}: ${err.message}`);
        }
    }

    console.log('\n--- Migración Finalizada ---');
    process.exit(0);
}

migrate();
