-- Migracion: Modulo de Paquetes (Live Shopping)
-- Fecha: 2026-05-21

-- Tabla de paquetes / lotes para venta en directo
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

-- Ampliar source de orders para incluir 'live'
-- NOTA: en MariaDB 10.3+ se puede usar ALTER con CHECK, pero para compatibilidad
-- si la columna ya existe como ENUM, la modificamos:
ALTER TABLE orders
  MODIFY COLUMN source ENUM('catalogo','vendedor','live') DEFAULT 'catalogo';

-- Log de auditoria
INSERT INTO audit_logs (table_name, record_id, action, newValues, changed_by)
VALUES ('schema', 'live_packages', 'create', '{"table":"live_packages","reason":"live_shopping_module"}', 'system');
