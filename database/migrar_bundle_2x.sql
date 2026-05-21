ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_2x_enabled TINYINT(1) DEFAULT 0 AFTER sale_price;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_2x_price DECIMAL(10,2) NULL AFTER bundle_2x_enabled;
