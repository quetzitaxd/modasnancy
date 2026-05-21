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
  payment_method ENUM('efectivo', 'cubopago') DEFAULT 'efectivo',
  payment_status ENUM('pendiente', 'pagado', 'fallido', 'reembolsado') DEFAULT 'pendiente',
  cubopago_transaction_id VARCHAR(255),
  cubopago_authorization VARCHAR(255),
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  tracking_number VARCHAR(100) DEFAULT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  source ENUM('catalogo','vendedor') DEFAULT 'catalogo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT NULL AFTER tracking_number;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source ENUM('catalogo','vendedor') DEFAULT 'catalogo' AFTER created_by;

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
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_enabled TINYINT(1) DEFAULT 0 AFTER wholesale_discount_percent;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10,2) NULL AFTER sale_enabled;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_2x_enabled TINYINT(1) DEFAULT 0 AFTER sale_price;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_2x_price DECIMAL(10,2) NULL AFTER bundle_2x_enabled;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT NULL AFTER bundle_2x_price;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100) DEFAULT NULL AFTER created_by;

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

-- Tabla de inventario por variante (SKU)
CREATE TABLE IF NOT EXISTS inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(150) NOT NULL,
  sku VARCHAR(200) NOT NULL UNIQUE,
  quantity INT NOT NULL DEFAULT 0,
  min_stock_level INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de logs de webhooks recibidos
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

-- Tabla de historial de movimientos de inventario
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

-- Tabla de usuarios del sistema
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

-- Tabla de auditoria (quien hizo y deshizo)
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

-- Tabla de clientes (persistente, deducida de pedidos)
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
