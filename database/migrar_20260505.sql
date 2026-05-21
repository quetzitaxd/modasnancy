ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT NULL AFTER tracking_number;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source ENUM('catalogo','vendedor') DEFAULT 'catalogo' AFTER created_by;

ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT NULL AFTER wholesale_discount_percent;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100) DEFAULT NULL AFTER created_by;

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
