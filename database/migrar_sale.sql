-- Migración: Sistema de Ofertas (Sale)
-- Fecha: 2026-05-05

ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_enabled TINYINT(1) DEFAULT 0 AFTER wholesale_discount_percent;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10,2) NULL AFTER sale_enabled;
