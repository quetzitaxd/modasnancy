-- Migracion: agregar metodo de pago transferencia, descuento y comprobante
ALTER TABLE orders
    MODIFY payment_method ENUM('efectivo', 'cubopago', 'transferencia') DEFAULT 'efectivo',
    ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total,
    ADD COLUMN IF NOT EXISTS payment_receipt_url VARCHAR(500) DEFAULT NULL AFTER discount_amount;
