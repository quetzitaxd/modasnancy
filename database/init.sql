-- ============================================================
-- init.sql — Schema definitivo Modas Nancy (MariaDB)
-- Este archivo se ejecuta automaticamente cuando el volumen DB
-- esta vacio (ej: despues de docker compose down -v).
-- Contiene TODO el schema actualizado; no requiere migraciones.
-- ============================================================

-- --------------------------------------------------
-- 1. Tabla: orders
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(150) DEFAULT NULL,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  notes TEXT,
  status ENUM('pendiente', 'confirmado', 'enviado', 'cancelado') DEFAULT 'pendiente',
  total DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  payment_method ENUM('efectivo', 'cubopago', 'transferencia') DEFAULT 'efectivo',
  payment_status ENUM('pendiente', 'pagado', 'fallido', 'reembolsado') DEFAULT 'pendiente',
  cubopago_transaction_id VARCHAR(255),
  cubopago_authorization VARCHAR(255),
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  tracking_number VARCHAR(100) DEFAULT NULL,
  payment_receipt_url VARCHAR(500) DEFAULT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  source ENUM('catalogo','vendedor','live') DEFAULT 'catalogo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------
-- 2. Tabla: order_items
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  variant_sku VARCHAR(150) NOT NULL,
  product_id VARCHAR(150) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  size VARCHAR(50) NOT NULL,
  color_name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------
-- 3. Tabla: products
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(150) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price DECIMAL(10,2) NULL,
  is_active TINYINT(1) DEFAULT 1,
  wholesale_enabled TINYINT(1) DEFAULT 0,
  wholesale_min_qty INT DEFAULT 0,
  wholesale_discount_percent DECIMAL(5,2) DEFAULT 0.00,
  sale_enabled TINYINT(1) DEFAULT 0,
  sale_price DECIMAL(10,2) NULL,
  bundle_2x_enabled TINYINT(1) DEFAULT 0,
  bundle_2x_price DECIMAL(10,2) NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------
-- 4. Tabla: product_variants
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(150) NOT NULL,
  sku VARCHAR(200) UNIQUE,
  price DECIMAL(10,2) NULL,
  size VARCHAR(50),
  color_name VARCHAR(100),
  color_hex VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY unique_variant (product_id, size, color_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------
-- 5. Tabla: inventory
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(150) NOT NULL,
  sku VARCHAR(200) NOT NULL UNIQUE,
  quantity INT NOT NULL DEFAULT 0,
  min_stock_level INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------
-- 6. Tabla: webhook_logs
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(50) NOT NULL DEFAULT 'cubopago',
  event_type VARCHAR(100),
  reference_id VARCHAR(255),
  payload JSON,
  processed TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reference_id (reference_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------
-- 7. Tabla: inventory_movements
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(150) NOT NULL,
  sku VARCHAR(200) NOT NULL,
  movement_type ENUM('entrada', 'salida', 'ajuste') NOT NULL,
  quantity INT NOT NULL,
  previous_quantity INT NOT NULL,
  new_quantity INT NOT NULL,
  reason VARCHAR(255),
  reference_id VARCHAR(100),
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_sku_created (sku, created_at),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------
-- 8. Tabla: users
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) DEFAULT NULL,
  role ENUM('admin','vendedor','operador_pedidos','operador_stock') NOT NULL DEFAULT 'vendedor',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------
-- 9. Tabla: audit_logs
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  action ENUM('create','update','delete') NOT NULL,
  old_values JSON,
  new_values JSON,
  changed_by VARCHAR(100) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------
-- 10. Tabla: customers
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(150) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  notes TEXT,
  order_count INT DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------
-- 11. Tabla: live_packages (Live Shopping)
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS live_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  image_url VARCHAR(500) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_by VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------
-- 12. Usuarios iniciales (credenciales de prueba local)
--    NOTA: En produccion, cambiar estos hashes o usar OAuth.
-- --------------------------------------------------
INSERT IGNORE INTO users (username, password_hash, name, email, role, is_active) VALUES
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador', 'admin@modasnancy.com', 'admin', 1),
('vendedor', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Vendedor Externo', 'vendedor@modasnancy.com', 'vendedor', 1),
('pedidos', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Operador Pedidos', 'pedidos@modasnancy.com', 'operador_pedidos', 1),
('stock', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Operador Stock', 'stock@modasnancy.com', 'operador_stock', 1);
