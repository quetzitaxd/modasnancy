'use strict';

/**
 * packages-service.js
 *
 * CRUD de paquetes para venta en directo (live shopping).
 * Cada paquete es un producto independiente con stock propio.
 */

const db = require('./db');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const DATA_DIR = (() => {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  const containerPath = path.resolve(__dirname, '..', 'data');
  if (fs.existsSync(containerPath)) return containerPath;
  return path.resolve(__dirname, '..', '..', 'data');
})();

const PACKAGES_DIR = path.join(DATA_DIR, 'packages');

class PackageError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const toSafeString = (value) => String(value || '').trim();

const requireDb = async () => {
  if (!(await db.verifyConnection())) {
    throw new PackageError('Base de datos no disponible', 503);
  }
};

const ensureDirectories = async () => {
  await fsPromises.mkdir(PACKAGES_DIR, { recursive: true });
};

// ─── Helpers de validación ──────────────────────────────────────────────────

const requireString = (value, fieldName) => {
  const clean = toSafeString(value);
  if (!clean) throw new PackageError(`El campo '${fieldName}' es obligatorio`);
  return clean;
};

const requirePositiveDecimal = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new PackageError(`${fieldName} debe ser un numero mayor a 0`);
  }
  return Number(parsed.toFixed(2));
};

const requireNonNegativeInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new PackageError(`${fieldName} debe ser un entero >= 0`);
  }
  return parsed;
};

const sanitizeCode = (code) => {
  return toSafeString(code).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
};

// ─── CRUD ────────────────────────────────────────────────────────────────────

const createPackage = async (data, { createdBy } = {}) => {
  await requireDb();
  await ensureDirectories();

  const code = sanitizeCode(data.code);
  const name = requireString(data.name, 'name');
  const description = toSafeString(data.description);
  const price = requirePositiveDecimal(data.price, 'price');
  const stockQuantity = requireNonNegativeInt(data.stock_quantity, 'stock_quantity');
  const isActive = data.is_active === false || data.is_active === 'false' || data.is_active === 0 ? 0 : 1;

  if (!code) throw new PackageError('El codigo del paquete es obligatorio');

  const pool = db.createPool();

  // Verificar unicidad
  const [existing] = await pool.query('SELECT 1 FROM live_packages WHERE code = ?', [code]);
  if (existing.length > 0) throw new PackageError(`Ya existe un paquete con el codigo "${code}"`, 409);

  // Guardar imagen si viene como archivo temporal
  let imageUrl = null;
  if (data.image_file && typeof data.image_file === 'string' && fs.existsSync(data.image_file)) {
    const ext = path.extname(data.image_file).toLowerCase() || '.jpg';
    const destName = `${code}${ext}`;
    const destPath = path.join(PACKAGES_DIR, destName);
    await fsPromises.copyFile(data.image_file, destPath);
    await fsPromises.unlink(data.image_file);
    imageUrl = `/packages/${destName}`;
  } else if (data.image_url) {
    imageUrl = toSafeString(data.image_url);
  }

  const [result] = await pool.query(
    `INSERT INTO live_packages (code, name, description, price, stock_quantity, image_url, is_active, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, name, description, price, stockQuantity, imageUrl, isActive, toSafeString(createdBy) || null]
  );

  return {
    id: result.insertId,
    code,
    name,
    description,
    price,
    stock_quantity: stockQuantity,
    image_url: imageUrl,
    is_active: isActive
  };
};

const getAllPackages = async () => {
  await requireDb();
  const pool = db.createPool();
  const [rows] = await pool.query(
    `SELECT * FROM live_packages ORDER BY created_at DESC`
  );
  return rows;
};

const getActivePackages = async () => {
  await requireDb();
  const pool = db.createPool();
  const [rows] = await pool.query(
    `SELECT id, code, name, description, price, stock_quantity, image_url
     FROM live_packages WHERE is_active = 1 ORDER BY code ASC`
  );
  return rows;
};

const getPackageByCode = async (code) => {
  await requireDb();
  const pool = db.createPool();
  const [rows] = await pool.query(
    `SELECT * FROM live_packages WHERE code = ? LIMIT 1`,
    [sanitizeCode(code)]
  );
  return rows[0] || null;
};

const getPackageById = async (id) => {
  await requireDb();
  const pool = db.createPool();
  const [rows] = await pool.query(
    `SELECT * FROM live_packages WHERE id = ? LIMIT 1`,
    [Number(id)]
  );
  return rows[0] || null;
};

const updatePackage = async (id, data) => {
  await requireDb();
  await ensureDirectories();

  const existing = await getPackageById(id);
  if (!existing) throw new PackageError('Paquete no encontrado', 404);

  const pool = db.createPool();
  const updates = [];
  const values = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(requireString(data.name, 'name'));
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    values.push(toSafeString(data.description));
  }
  if (data.price !== undefined) {
    updates.push('price = ?');
    values.push(requirePositiveDecimal(data.price, 'price'));
  }
  if (data.stock_quantity !== undefined) {
    updates.push('stock_quantity = ?');
    values.push(requireNonNegativeInt(data.stock_quantity, 'stock_quantity'));
  }
  if (data.is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(data.is_active === false || data.is_active === 'false' || data.is_active === 0 ? 0 : 1);
  }

  // Imagen
  if (data.image_file && typeof data.image_file === 'string' && fs.existsSync(data.image_file)) {
    const ext = path.extname(data.image_file).toLowerCase() || '.jpg';
    const destName = `${existing.code}${ext}`;
    const destPath = path.join(PACKAGES_DIR, destName);
    await fsPromises.copyFile(data.image_file, destPath);
    await fsPromises.unlink(data.image_file);
    updates.push('image_url = ?');
    values.push(`/packages/${destName}`);
  } else if (data.image_url !== undefined) {
    updates.push('image_url = ?');
    values.push(toSafeString(data.image_url) || null);
  }

  if (updates.length === 0) return existing;

  values.push(Number(id));
  await pool.query(
    `UPDATE live_packages SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  return getPackageById(id);
};

const deletePackage = async (id) => {
  await requireDb();
  const existing = await getPackageById(id);
  if (!existing) throw new PackageError('Paquete no encontrado', 404);

  const pool = db.createPool();
  await pool.query('DELETE FROM live_packages WHERE id = ?', [Number(id)]);

  // Borrar imagen si existe local
  if (existing.image_url && existing.image_url.startsWith('/packages/')) {
    const imgPath = path.join(DATA_DIR, existing.image_url);
    try { await fsPromises.unlink(imgPath); } catch { /* ignore */ }
  }

  return { success: true };
};

// ─── Control de stock ────────────────────────────────────────────────────────

/**
 * Descuenta stock de uno o mas paquetes dentro de una transaccion.
 * Recibe array de { package_code, quantity }.
 * Requiere una conexion (conn) para ejecutar dentro de una transaccion externa.
 */
const deductStockWithConnection = async (conn, items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new PackageError('No se proporcionaron items para descontar stock');
  }

  for (const item of items) {
    const code = sanitizeCode(item.package_code || item.code);
    const qty = requireNonNegativeInt(item.quantity, 'quantity');
    if (qty === 0) continue;

    const [rows] = await conn.query(
      'SELECT id, code, stock_quantity FROM live_packages WHERE code = ? AND is_active = 1 FOR UPDATE',
      [code]
    );

    if (rows.length === 0) {
      throw new PackageError(`Paquete no encontrado o inactivo: "${code}"`, 400);
    }

    const pkg = rows[0];
    if (pkg.stock_quantity < qty) {
      throw new PackageError(
        `Stock insuficiente para el paquete "${code}". Disponible: ${pkg.stock_quantity}, Solicitado: ${qty}`,
        409
      );
    }

    await conn.query(
      'UPDATE live_packages SET stock_quantity = stock_quantity - ? WHERE id = ?',
      [qty, pkg.id]
    );
  }
};

/**
 * Restaura stock de paquetes (al cancelar un pedido).
 * Usa pool propio (no requiere conn).
 */
const restoreStock = async (items) => {
  if (!Array.isArray(items) || items.length === 0) return;
  await requireDb();
  const pool = db.createPool();

  for (const item of items) {
    const code = sanitizeCode(item.package_code || item.code);
    const qty = requireNonNegativeInt(item.quantity, 'quantity');
    if (qty === 0) continue;

    await pool.query(
      'UPDATE live_packages SET stock_quantity = stock_quantity + ? WHERE code = ?',
      [qty, code]
    );
  }
};

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  createPackage,
  getAllPackages,
  getActivePackages,
  getPackageByCode,
  getPackageById,
  updatePackage,
  deletePackage,
  deductStockWithConnection,
  restoreStock,
  ensureDirectories,
  __test: { sanitizeCode, requirePositiveDecimal, requireNonNegativeInt }
};
