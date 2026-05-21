const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const db = require('./db');

const resolveDataDir = () => {
    if (process.env.DATA_DIR) {
        return path.resolve(process.env.DATA_DIR);
    }

    const containerPath = path.resolve(__dirname, 'data');
    if (fsSync.existsSync(containerPath)) {
        return containerPath;
    }

    return path.resolve(__dirname, '..', 'data');
};

const DATA_DIR = resolveDataDir();
const PRODUCTS_DIR = path.join(DATA_DIR, 'products');

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const ensureDirectories = async () => {
    await fs.mkdir(PRODUCTS_DIR, { recursive: true });
};

const sanitizeProductId = (id) => {
    if (typeof id !== 'string') {
        throw new Error('id must be a string');
    }

    const safeId = id.trim().replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!safeId) {
        throw new Error('id invalido');
    }

    return safeId;
};

const getProductPath = (id) => path.join(PRODUCTS_DIR, sanitizeProductId(id));

const normalizeString = (str) => {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');
};

const generateSku = (productId, colorName, size) => {
    const parts = [normalizeString(productId)];

    if (colorName) parts.push(normalizeString(colorName));
    if (size) parts.push(normalizeString(size));

    return parts.filter(Boolean).join('-');
};

const normalizeHexColor = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    const match = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) {
        return '#d1a3a4';
    }

    if (raw.length === 4) {
        return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
    }

    return raw;
};

const hasPriceValue = (value) => {
    return value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');
};

const parseDecimalToCents = (value) => {
    if (!hasPriceValue(value)) {
        return null;
    }

    const raw = String(value).trim();
    const match = raw.match(/^(-?)(\d+)(?:\.(\d+))?$/);
    if (!match) {
        return null;
    }

    const sign = match[1] === '-' ? -1 : 1;
    const whole = Number(match[2]);
    const decimals = `${match[3] || ''}000`;
    let cents = (whole * 100) + Number(decimals.slice(0, 2));

    if (Number(decimals[2] || '0') >= 5) {
        cents += 1;
    }

    return cents * sign;
};

const centsToDecimalString = (cents) => {
    const abs = Math.abs(cents);
    const whole = Math.floor(abs / 100);
    const decimal = String(abs % 100).padStart(2, '0');
    return `${cents < 0 ? '-' : ''}${whole}.${decimal}`;
};

const centsToMoneyNumber = (cents) => Number((cents / 100).toFixed(2));

const normalizeOptionalPrice = (value, fieldLabel) => {
    if (!hasPriceValue(value)) {
        return null;
    }

    const cents = parseDecimalToCents(value);
    if (cents === null) {
        throw new Error(`${fieldLabel} invalido`);
    }

    if (cents <= 0) {
        throw new Error(`${fieldLabel} debe ser mayor a 0`);
    }

    return centsToDecimalString(cents);
};

const priceToResponseNumber = (value) => {
    const cents = parseDecimalToCents(value);
    if (cents === null || cents <= 0) {
        return null;
    }

    return centsToMoneyNumber(cents);
};

const resolveRequiredPrice = (primaryPrice, fallbackPrice, contextLabel) => {
    const finalPrice = priceToResponseNumber(primaryPrice) ?? priceToResponseNumber(fallbackPrice);
    if (finalPrice === null) {
        throw new Error(`No se pudo resolver un precio valido para ${contextLabel}`);
    }

    return Number(finalPrice.toFixed(2));
};

const parseSizesInput = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }

    return [];
};

const parseColorsInput = (value) => {
    if (!value) {
        return [];
    }

    let source = value;
    if (typeof value === 'string') {
        try {
            source = JSON.parse(value);
        } catch {
            return [];
        }
    }

    if (!Array.isArray(source)) {
        return [];
    }

    return source
        .map((item, index) => {
            const name = String(item?.name || item?.label || item?.value || '').trim();
            const hex = normalizeHexColor(item?.hex || item?.color || item?.code);

            if (!name && !hex) {
                return null;
            }

            return {
                name: name || `Color ${index + 1}`,
                hex
            };
        })
        .filter(Boolean);
};

const buildVariantsFromLegacyInputs = (productId, data) => {
    const sizes = parseSizesInput(data?.sizes);
    const colors = parseColorsInput(data?.colors);
    const sizesList = sizes.length > 0 ? sizes : ['Unica'];
    const colorsList = colors.length > 0 ? colors : [{ name: 'Estandar', hex: '#000000' }];
    const variants = [];

    for (const size of sizesList) {
        for (const color of colorsList) {
            variants.push({
                sku: generateSku(productId, color.name, size),
                price: null,
                size,
                color_name: color.name,
                color_hex: color.hex
            });
        }
    }

    return variants;
};

const resolveVariantsInput = (variants, productId, data) => {
    let source = variants;
    if (typeof source === 'string') {
        try {
            source = JSON.parse(source);
        } catch {
            source = null;
        }
    }

    if (Array.isArray(source) && source.length > 0) {
        return source;
    }

    return buildVariantsFromLegacyInputs(productId, data);
};

const validateAndNormalizeVariants = (variants, productId, basePrice) => {
    if (!Array.isArray(variants) || variants.length === 0) {
        throw new Error('Debe proveer al menos una variante explicita en el array variants');
    }

    const seenCombos = new Set();
    const result = [];
    const hasBasePrice = hasPriceValue(basePrice);

    let hasInvalidInheritance = false;

    for (const variant of variants) {
        const size = String(variant?.size || '').trim();
        const colorName = String(variant?.color_name || '').trim();
        const colorHex = String(variant?.color_hex || '').trim();
        const parsedPrice = hasPriceValue(variant?.price)
            ? normalizeOptionalPrice(variant.price, 'El precio de la variante')
            : null;

        if (!hasBasePrice && parsedPrice === null) {
            hasInvalidInheritance = true;
        }

        if (!size) {
            throw new Error('Cada variante debe tener un size (talla) requerido');
        }

        if (!colorName) {
            throw new Error('Cada variante debe tener un color_name requerido');
        }

        const normalizedSize = normalizeString(size);
        const normalizedColor = normalizeString(colorName);
        const comboKey = `${normalizedSize}|${normalizedColor}`;

        if (seenCombos.has(comboKey)) {
            throw new Error(`Variante duplicada: No pueden existir dos variantes con la misma combinacion (size: ${size}, color_name: ${colorName})`);
        }

        seenCombos.add(comboKey);

        result.push({
            sku: generateSku(productId, colorName, size),
            price: parsedPrice,
            size: normalizedSize,
            color_name: normalizedColor,
            color_hex: normalizeHexColor(colorHex)
        });
    }

    if (hasInvalidInheritance) {
        throw new Error('Debe definir precio en el producto o en todas las variantes');
    }

    return result;
};

const normalizeProductData = (data) => {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const description = typeof data.description === 'string' ? data.description.trim() : '';
    const category = typeof data.category === 'string' && data.category.trim() ? data.category.trim() : 'otros';
    const price = normalizeOptionalPrice(data.price, 'El precio base');

    if (!name) {
        throw new Error('name requerido');
    }

    const wholesale_enabled = data.wholesale_enabled === true || data.wholesale_enabled === 1 || data.wholesale_enabled === '1' || data.wholesale_enabled === 'true' ? 1 : 0;
    const wholesale_min_qty = Math.max(0, parseInt(data.wholesale_min_qty) || 0);
    const wholesale_discount_percent = Math.max(0, parseFloat(data.wholesale_discount_percent) || 0);
    const is_active = data.is_active === false || data.is_active === 0 || data.is_active === 'false' ? 0 : 1;
    const sale_enabled = data.sale_enabled === true || data.sale_enabled === 1 || data.sale_enabled === '1' || data.sale_enabled === 'true' ? 1 : 0;
    const sale_price = normalizeOptionalPrice(data.sale_price, 'El precio de oferta');
    const bundle_2x_enabled = data.bundle_2x_enabled === true || data.bundle_2x_enabled === 1 || data.bundle_2x_enabled === '1' || data.bundle_2x_enabled === 'true' ? 1 : 0;
    const bundle_2x_price = normalizeOptionalPrice(data.bundle_2x_price, 'El precio de bundle 2x');

    return {
        name,
        description,
        category,
        price,
        wholesale_enabled,
        wholesale_min_qty,
        wholesale_discount_percent,
        is_active,
        sale_enabled,
        sale_price,
        bundle_2x_enabled,
        bundle_2x_price
    };
};

const listProductImages = async (productPath, id) => {
    try {
        const files = await fs.readdir(productPath);
        return files
            .filter((file) => ALLOWED_IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
            .sort((a, b) => a.localeCompare(b))
            .map((file) => `/products/${id}/${file}`);
    } catch {
        return [];
    }
};

const mapProductDbToFrontend = (dbProduct, variants, images) => {
    const sizes = new Set();
    const colorsMap = new Map();
    let totalStock = 0;

    const resolvedVariants = (Array.isArray(variants) ? variants : []).map((variant) => {
        const finalPrice = resolveRequiredPrice(
            variant?.price,
            dbProduct?.price,
            `la variante ${variant?.sku || variant?.size || dbProduct?.id || 'sin-sku'}`
        );

        if (variant?.size) {
            sizes.add(variant.size);
        }

        if (variant?.color_name) {
            colorsMap.set(variant.color_name, {
                name: variant.color_name,
                hex: variant.color_hex || '#000000'
            });
        }

        const stockQty = Number(variant?.quantity) || 0;
        totalStock += stockQty;

        return {
            ...variant,
            price: finalPrice,
            stock: stockQty,
            min_stock_level: Number(variant?.min_stock_level) || 5
        };
    });

    const resolvedBasePrice = priceToResponseNumber(dbProduct?.price) ?? (resolvedVariants[0] ? resolvedVariants[0].price : null);
    if (resolvedBasePrice === null) {
        throw new Error(`El producto ${dbProduct?.id || 'sin-id'} no tiene un precio resoluble`);
    }

    const saleEnabled = !!dbProduct.sale_enabled;
    const salePrice = priceToResponseNumber(dbProduct?.sale_price);
    const effectivePrice = (saleEnabled && salePrice !== null && salePrice > 0) ? salePrice : resolvedBasePrice;

    return {
        id: dbProduct.id,
        name: dbProduct.name,
        description: dbProduct.description,
        category: dbProduct.category,
        price: Number(effectivePrice.toFixed(2)),
        original_price: Number(resolvedBasePrice.toFixed(2)),
        sale_enabled: saleEnabled,
        sale_price: salePrice ?? null,
        sizes: Array.from(sizes),
        colors: Array.from(colorsMap.values()),
        variants: resolvedVariants,
        total_stock: totalStock,
        wholesale_enabled: !!dbProduct.wholesale_enabled,
        wholesale_min_qty: dbProduct.wholesale_min_qty || 0,
        wholesale_discount_percent: parseFloat(dbProduct.wholesale_discount_percent || 0),
        bundle_2x_enabled: !!dbProduct.bundle_2x_enabled,
        bundle_2x_price: priceToResponseNumber(dbProduct?.bundle_2x_price) ?? null,
        is_active: dbProduct.is_active === undefined ? true : !!dbProduct.is_active,
        created_by: dbProduct.created_by || null,
        updated_by: dbProduct.updated_by || null,
        images
    };
};

const getProduct = async (id) => {
    await ensureDirectories();
    const safeId = sanitizeProductId(id);

    if (await db.verifyConnection()) {
        try {
            const pool = db.createPool();
            const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [safeId]);
            if (rows.length > 0) {
                const [variants] = await pool.query(
                    `SELECT v.*, i.quantity, i.min_stock_level
                     FROM product_variants v
                     LEFT JOIN inventory i ON i.sku = v.sku
                     WHERE v.product_id = ?
                     ORDER BY v.size, v.color_name`,
                    [safeId]
                );
                const images = await listProductImages(getProductPath(safeId), safeId);
                return mapProductDbToFrontend(rows[0], variants, images);
            }
            return null;
        } catch (err) {
            console.error('DB getProduct Error:', err);
            throw new Error('Error al obtener producto de la base de datos');
        }
    } else {
        throw new Error('Base de datos no disponible');
    }
};

const getAllProducts = async () => {
    await ensureDirectories();

    if (await db.verifyConnection()) {
        try {
            const pool = db.createPool();
            const [productsRows] = await pool.query('SELECT * FROM products ORDER BY created_at DESC');

            const products = [];
            const productIds = productsRows.map((p) => p.id);

            let variantsByProduct = {};
            if (productIds.length > 0) {
                const placeholders = productIds.map(() => '?').join(',');
                const [variantsRows] = await pool.query(
                    `SELECT v.*, i.quantity, i.min_stock_level
                     FROM product_variants v
                     LEFT JOIN inventory i ON i.sku = v.sku
                     WHERE v.product_id IN (${placeholders})
                     ORDER BY v.size, v.color_name`,
                    productIds
                );

                for (const variant of variantsRows) {
                    if (!variantsByProduct[variant.product_id]) {
                        variantsByProduct[variant.product_id] = [];
                    }
                    variantsByProduct[variant.product_id].push(variant);
                }
            }

            for (const productRow of productsRows) {
                try {
                    const variants = variantsByProduct[productRow.id] || [];
                    const images = await listProductImages(getProductPath(productRow.id), productRow.id);
                    products.push(mapProductDbToFrontend(productRow, variants, images));
                } catch (productErr) {
                    console.error(`DB getAllProducts skipped ${productRow.id}:`, productErr.message);
                }
            }

            return products;
        } catch (err) {
            console.error('DB getAllProducts Error:', err);
            throw new Error('Error al cargar productos desde la base de datos');
        }
    } else {
        throw new Error('Base de datos no disponible');
    }
};

const createProduct = async (id, data, { createdBy } = {}) => {
    await ensureDirectories();

    const safeId = sanitizeProductId(id);
    const productPath = getProductPath(safeId);

    if (await db.verifyConnection()) {
        const pool = db.createPool();
        const [rows] = await pool.query('SELECT 1 FROM products WHERE id = ?', [safeId]);
        if (rows.length > 0) {
            throw new Error('El producto ya existe en la base de datos');
        }
    }

    const normalized = normalizeProductData(data);
    const variantsInput = resolveVariantsInput(data?.variants, safeId, data);
    const validVariants = validateAndNormalizeVariants(variantsInput, safeId, normalized.price);

    // Usamos recursive: true para que no falle si la carpeta ya existe (casos de migración)
    await fs.mkdir(productPath, { recursive: true });

    if (await db.verifyConnection()) {
        const pool = db.createPool();
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();
            await connection.query(
                'INSERT INTO products (id, name, description, category, price, is_active, wholesale_enabled, wholesale_min_qty, wholesale_discount_percent, sale_enabled, sale_price, bundle_2x_enabled, bundle_2x_price, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    safeId,
                    normalized.name,
                    normalized.description,
                    normalized.category,
                    normalized.price,
                    normalized.is_active,
                    normalized.wholesale_enabled,
                    normalized.wholesale_min_qty,
                    normalized.wholesale_discount_percent,
                    normalized.sale_enabled,
                    normalized.sale_price,
                    normalized.bundle_2x_enabled,
                    normalized.bundle_2x_price,
                    createdBy || null
                ]
            );

            for (const variant of validVariants) {
                try {
                    await connection.query(
                        'INSERT INTO product_variants (product_id, sku, price, size, color_name, color_hex) VALUES (?, ?, ?, ?, ?, ?)',
                        [safeId, variant.sku, variant.price, variant.size, variant.color_name, variant.color_hex]
                    );
                } catch (variantErr) {
                    if (variantErr.code === 'ER_DUP_ENTRY') {
                        throw new Error(`Error de Integridad: El SKU '${variant.sku}' ya se encuentra registrado o existe duplicidad.`);
                    }
                    throw variantErr;
                }
            }

            // Inicializar registros de inventario para cada variante (misma transaccion)
            for (const variant of validVariants) {
                await connection.query(
                    `INSERT INTO inventory (product_id, sku, quantity, min_stock_level)
                     VALUES (?, ?, 0, 5)
                     ON DUPLICATE KEY UPDATE product_id = product_id`,
                    [safeId, variant.sku]
                );
            }

            await connection.commit();
            return getProduct(safeId);
        } catch (dbErr) {
            await connection.rollback();
            // No borramos la carpeta porque podría tener imágenes que queramos conservar
            throw dbErr;
        } finally {
            connection.release();
        }
    } else {
        throw new Error('Base de datos no disponible para crear producto');
    }
};

const updateProduct = async (id, data, { updatedBy } = {}) => {
    await ensureDirectories();

    const safeId = sanitizeProductId(id);
    const current = await getProduct(safeId);

    if (!current) {
        throw new Error('Producto no encontrado');
    }

    const merged = {
        name: data.name ?? current.name,
        price: data.price !== undefined ? data.price : current.price,
        description: data.description ?? current.description,
        category: data.category ?? current.category,
        wholesale_enabled: data.wholesale_enabled !== undefined ? data.wholesale_enabled : current.wholesale_enabled,
        wholesale_min_qty: data.wholesale_min_qty !== undefined ? data.wholesale_min_qty : current.wholesale_min_qty,
        wholesale_discount_percent: data.wholesale_discount_percent !== undefined ? data.wholesale_discount_percent : current.wholesale_discount_percent,
        sale_enabled: data.sale_enabled !== undefined ? data.sale_enabled : current.sale_enabled,
        sale_price: data.sale_price !== undefined ? data.sale_price : current.sale_price,
        bundle_2x_enabled: data.bundle_2x_enabled !== undefined ? data.bundle_2x_enabled : current.bundle_2x_enabled,
        bundle_2x_price: data.bundle_2x_price !== undefined ? data.bundle_2x_price : current.bundle_2x_price,
        is_active: data.is_active !== undefined ? data.is_active : current.is_active,
        // Crucial: preserve colors and sizes for variant regeneration
        colors: data.colors !== undefined ? data.colors : current.colors,
        sizes: data.sizes !== undefined ? data.sizes : current.sizes
    };

    const normalized = normalizeProductData(merged);

    // Solo regenerar variantes si los inputs explícitos producirían variantes válidas,
    // o si se envió un array de variants directamente.
    // Esto evita destruir variantes existentes cuando tallas/colores vienen vacíos por error.
    const parsedSizes = parseSizesInput(data?.sizes);
    const parsedColors = parseColorsInput(data?.colors);
    const hasExplicitVariants = data.variants !== undefined && data.variants !== null && data.variants !== '';
    const shouldRegenerate = (parsedSizes.length > 0 && parsedColors.length > 0) || hasExplicitVariants;

    const variantsInput = shouldRegenerate
        ? resolveVariantsInput(data.variants, safeId, merged)
        : current.variants;
    const validVariants = validateAndNormalizeVariants(variantsInput, safeId, normalized.price);

    if (await db.verifyConnection()) {
        const pool = db.createPool();
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            await connection.query(
                'UPDATE products SET name=?, description=?, category=?, price=?, is_active=?, wholesale_enabled=?, wholesale_min_qty=?, wholesale_discount_percent=?, sale_enabled=?, sale_price=?, bundle_2x_enabled=?, bundle_2x_price=?, updated_by=? WHERE id=?',
                [
                    normalized.name,
                    normalized.description,
                    normalized.category,
                    normalized.price,
                    normalized.is_active,
                    normalized.wholesale_enabled,
                    normalized.wholesale_min_qty,
                    normalized.wholesale_discount_percent,
                    normalized.sale_enabled,
                    normalized.sale_price,
                    normalized.bundle_2x_enabled,
                    normalized.bundle_2x_price,
                    updatedBy || null,
                    safeId
                ]
            );

            await connection.query('DELETE FROM product_variants WHERE product_id=?', [safeId]);

            for (const variant of validVariants) {
                try {
                    await connection.query(
                        'INSERT INTO product_variants (product_id, sku, price, size, color_name, color_hex) VALUES (?, ?, ?, ?, ?, ?)',
                        [safeId, variant.sku, variant.price, variant.size, variant.color_name, variant.color_hex]
                    );
                } catch (variantErr) {
                    if (variantErr.code === 'ER_DUP_ENTRY') {
                        throw new Error(`Error de Integridad: El SKU '${variant.sku}' ya se encuentra registrado o existe duplicidad.`);
                    }
                    throw variantErr;
                }
            }

            // Asegurar que todas las variantes tengan registro de inventario (misma transaccion)
            for (const variant of validVariants) {
                await connection.query(
                    `INSERT INTO inventory (product_id, sku, quantity, min_stock_level)
                     VALUES (?, ?, 0, 5)
                     ON DUPLICATE KEY UPDATE product_id = product_id`,
                    [safeId, variant.sku]
                );
            }

            await connection.commit();
            return getProduct(safeId);
        } catch (dbErr) {
            await connection.rollback();
            throw dbErr;
        } finally {
            connection.release();
        }
    } else {
        throw new Error('Base de datos no disponible para actualizar producto');
    }
};

const moveUploadedFile = async (source, destination) => {
    try {
        await fs.rename(source, destination);
    } catch {
        await fs.copyFile(source, destination);
        await fs.unlink(source);
    }
};

const addProductImages = async (id, files) => {
    await ensureDirectories();

    const safeId = sanitizeProductId(id);
    const productPath = getProductPath(safeId);

    for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const ext = path.extname(file.originalname || '').toLowerCase();

        if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
            throw new Error('Formato de imagen no permitido');
        }

        const filename = `image-${Date.now()}-${index}${ext}`;
        const destination = path.join(productPath, filename);
        await moveUploadedFile(file.path, destination);
    }

    return getProduct(safeId);
};

const cleanupTempFiles = async (files) => {
    for (const file of files || []) {
        try {
            await fs.unlink(file.path);
        } catch {
            // best effort cleanup
        }
    }
};

const deleteProduct = async (id) => {
    await ensureDirectories();
    const safeId = sanitizeProductId(id);

    if (await db.verifyConnection()) {
        const pool = db.createPool();
        const [result] = await pool.query('DELETE FROM products WHERE id = ?', [safeId]);

        if (result.affectedRows === 0) {
            throw new Error('Producto no encontrado en la base de datos');
        }

        const productPath = getProductPath(safeId);
        try {
            await fs.rm(productPath, { recursive: true, force: true });
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error('FS deleteProduct Error:', err.message);
            }
        }

        return true;
    }

    throw new Error('Base de datos no disponible');
};

const deleteProductImage = async (id, filename) => {
    await ensureDirectories();
    const safeId = sanitizeProductId(id);
    const productPath = getProductPath(safeId);
    
    // Validar nombre de archivo para evitar path traversal
    const safeFilename = path.basename(filename);
    const ext = path.extname(safeFilename).toLowerCase();
    
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        throw new Error('Archivo no valido para eliminar');
    }

    const fullPath = path.join(productPath, safeFilename);
    try {
        await fs.access(fullPath);
        await fs.unlink(fullPath);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            throw new Error('Imagen no encontrada');
        }
        throw err;
    }
};

module.exports = {
    PRODUCTS_DIR,
    ensureDirectories,
    sanitizeProductId,
    getAllProducts,
    getProduct,
    createProduct,
    updateProduct,
    addProductImages,
    deleteProductImage,
    cleanupTempFiles,
    deleteProduct,
    __test: {
        normalizeProductData,
        validateAndNormalizeVariants,
        mapProductDbToFrontend,
        parseDecimalToCents,
        centsToDecimalString,
        priceToResponseNumber,
        resolveVariantsInput
    }
};
