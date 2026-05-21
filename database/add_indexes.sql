-- Migración: Agregar índices para columnas frecuentemente consultadas
-- Ejecutar una sola vez en producción

-- Índices en orders
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders (created_by);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);

-- Índices en customers
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);

-- Soft delete en customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers (is_active);

-- Índices en inventory
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory (product_id);

-- FK inventory → product_variants
ALTER TABLE inventory ADD CONSTRAINT IF NOT EXISTS fk_inventory_sku FOREIGN KEY (sku) REFERENCES product_variants(sku) ON DELETE CASCADE;

-- Índices en inventory_movements
CREATE INDEX IF NOT EXISTS idx_movements_sku ON inventory_movements (sku);
CREATE INDEX IF NOT EXISTS idx_movements_reference_id ON inventory_movements (reference_id);
