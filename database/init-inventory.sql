-- Inicializar inventario para todas las variantes existentes
INSERT INTO inventory (product_id, sku, quantity, min_stock_level)
SELECT v.product_id, v.sku, 10, 5
FROM product_variants v
LEFT JOIN inventory i ON v.sku = i.sku
WHERE i.sku IS NULL;
