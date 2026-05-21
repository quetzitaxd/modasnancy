-- Eliminar registros de auditoría de prueba y pedidos de prueba
DELETE FROM audit_logs WHERE table_name = 'orders' AND record_id IN (SELECT id FROM orders WHERE customer_name LIKE '%Prueba%' OR customer_name LIKE '%Test%' OR customer_name LIKE '%Audit%');
DELETE FROM audit_logs WHERE table_name = 'orders' AND record_id IN ('5', '7');
DELETE FROM audit_logs WHERE table_name = 'users' AND changed_by = 'jorge';
DELETE FROM order_items WHERE order_id IN (5, 7);
DELETE FROM orders WHERE id IN (5, 7);
DELETE FROM audit_logs WHERE id IN (1, 2, 3, 4, 5, 6);

-- Insertar 10 pedidos ficticios realistas
INSERT INTO orders (customer_name, phone, email, address, city, notes, status, total, payment_method, payment_status, created_by, source, tracking_number, created_at) VALUES
('María Elena Gómez', '+502 55443322', 'maria.gomez@email.com', '12 Avenida 5-45, Zona 1', 'Guatemala', 'Dejar en recepción', 'pendiente', 245.00, 'efectivo', 'pendiente', 'vendedor1', 'vendedor', NULL, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
('Carlos Alberto Ruiz', '+502 55667788', NULL, '3ra Calle 15-90, Zona 10', 'Guatemala', 'Entregar después de las 6pm', 'confirmado', 480.50, 'cubopago', 'pagado', NULL, 'catalogo', NULL, DATE_SUB(NOW(), INTERVAL 5 HOUR)),
('Sofía Isabel Mendoza', '+502 55112233', 'sofia.m@email.com', 'Boulevard Vista Hermosa 8-20', 'Mixco', 'Regalo, incluir tarjeta', 'enviado', 320.00, 'efectivo', 'pendiente', 'vendedor1', 'vendedor', 'FD88223344', DATE_SUB(NOW(), INTERVAL 1 DAY)),
('José Antonio Herrera', '+502 55889900', NULL, '6ta Avenida 22-15, Zona 4', 'Guatemala', NULL, 'pendiente', 175.00, 'efectivo', 'pendiente', NULL, 'catalogo', NULL, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
('Ana Lucía Castellanos', '+502 55334455', 'ana.castellanos@email.com', 'Km 15.5 Carretera a El Salvador, Cond. Las Magnolias', 'Santa Catarina Pinula', 'Casa 12, portón negro', 'confirmado', 590.00, 'cubopago', 'pagado', 'vendedor1', 'vendedor', NULL, DATE_SUB(NOW(), INTERVAL 8 HOUR)),
('Pedro Javier Morales', '+502 55778899', NULL, '18 Calle 7-45, Zona 14', 'Guatemala', 'Llamar antes de entregar', 'enviado', 210.00, 'efectivo', 'pendiente', NULL, 'catalogo', 'FD11223355', DATE_SUB(NOW(), INTERVAL 2 DAY)),
('Diana Michelle Fuentes', '+502 55001122', 'diana.f@email.com', '4ta Avenida 10-25, Zona 1', 'Guatemala', 'Cambio de talla si no queda', 'pendiente', 165.00, 'efectivo', 'pendiente', 'vendedor1', 'vendedor', NULL, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
('Luis Fernando Arias', '+502 55661122', NULL, '2da Calle 30-15, Zona 11', 'Guatemala', NULL, 'cancelado', 350.00, 'cubopago', 'fallido', NULL, 'catalogo', NULL, DATE_SUB(NOW(), INTERVAL 12 HOUR)),
('Carmen Beatriz León', '+502 55223344', 'carmen.leon@email.com', '7ma Avenida 12-80, Zona 9', 'Guatemala', 'Entrega urgente', 'confirmado', 445.00, 'efectivo', 'pendiente', 'vendedor1', 'vendedor', NULL, DATE_SUB(NOW(), INTERVAL 6 HOUR)),
('Roberto Alejandro Díaz', '+502 55445566', NULL, '5ta Calle 8-45, Zona 3', 'Guatemala', 'Pedido corporativo, factura a nombre de ABC S.A.', 'enviado', 780.00, 'cubopago', 'pagado', NULL, 'catalogo', 'FD99887766', DATE_SUB(NOW(), INTERVAL 3 DAY));

-- Insertar items para cada pedido ficticio
INSERT INTO order_items (order_id, variant_sku, product_id, product_name, size, color_name, price, quantity) VALUES
(8, 'blusa-manga-corta-pavo-lxl', 'blusa-manga-corta', 'Blusa manga corta', 'lxl', 'pavo', 165.00, 1),
(8, 'vestido-cuello-alto-rosa-palo-m', 'vestido-cuello-alto', 'Vestido cuello alto', 'm', 'rosa palo', 100.00, 1),
(8, 'conjunto-falda-y-blazer-rosa-palo-s', 'conjunto-falda-y-blazer', 'Conjunto falda y blazer', 's', 'rosa palo', 245.00, 1),

(9, 'enterizo-escote-diagonal-rosa-palo-l', 'enterizo-escote-diagonal', 'Enterizo escote Diagonal', 'l', 'rosa palo', 225.00, 2),
(9, 'blusa-manga-corta-rojo-lxl', 'blusa-manga-corta', 'Blusa manga corta', 'lxl', 'rojo', 165.00, 1),

(10, 'vestido-de-tirante-doble-y-escote-de-corazon-rosa-palo-m', 'vestido-de-tirante-doble-y-escote-de-corazon', 'VESTIDO DE TIRANTE DOBLE Y ESCOTE DE CORAZON', 'm', 'rosa palo', 175.00, 1),
(10, 'conjunto-falda-con-pijaso-ajustable-rosa-palo-l', 'conjunto-falda-con-pijaso-ajustable', 'Conjunto falda con pijaso ajustable', 'l', 'rosa palo', 100.00, 1),
(10, 'blusa-manga-corta-verde-sm', 'blusa-manga-corta', 'Blusa manga corta', 'sm', 'verde', 165.00, 1),

(11, 'vestido-cuello-alto-rosa-palo-s', 'vestido-cuello-alto', 'Vestido cuello alto', 's', 'rosa palo', 100.00, 1),
(11, 'enterizo-escote-diagonal-rosa-palo-m', 'enterizo-escote-diagonal', 'Enterizo escote Diagonal', 'm', 'rosa palo', 225.00, 1),

(12, 'conjunto-falda-y-blazer-corinto-l', 'conjunto-falda-y-blazer', 'Conjunto falda y blazer', 'l', 'corinto', 245.00, 1),
(12, 'blusa-manga-corta-pavo-sm', 'blusa-manga-corta', 'Blusa manga corta', 'sm', 'pavo', 165.00, 1),

(13, 'vestido-de-tirante-doble-y-escote-de-corazon-rosa-palo-s', 'vestido-de-tirante-doble-y-escote-de-corazon', 'VESTIDO DE TIRANTE DOBLE Y ESCOTE DE CORAZON', 's', 'rosa palo', 175.00, 1),
(13, 'enterizo-escote-diagonal-rosa-palo-xl', 'enterizo-escote-diagonal', 'Enterizo escote Diagonal', 'xl', 'rosa palo', 225.00, 1),

(14, 'blusa-manga-corta-rojo-sm', 'blusa-manga-corta', 'Blusa manga corta', 'sm', 'rojo', 165.00, 1),
(14, 'conjunto-falda-con-pijaso-ajustable-rosa-palo-m', 'conjunto-falda-con-pijaso-ajustable', 'Conjunto falda con pijaso ajustable', 'm', 'rosa palo', 100.00, 1),
(14, 'vestido-cuello-alto-rosa-palo-l', 'vestido-cuello-alto', 'Vestido cuello alto', 'l', 'rosa palo', 100.00, 1),

(15, 'conjunto-falda-y-blazer-rosa-palo-m', 'conjunto-falda-y-blazer', 'Conjunto falda y blazer', 'm', 'rosa palo', 245.00, 1),

(16, 'enterizo-escote-diagonal-rosa-palo-l', 'enterizo-escote-diagonal', 'Enterizo escote Diagonal', 'l', 'rosa palo', 225.00, 1),
(16, 'vestido-cuello-alto-rosa-palo-m', 'vestido-cuello-alto', 'Vestido cuello alto', 'm', 'rosa palo', 100.00, 1),
(16, 'blusa-manga-corta-pavo-lxl', 'blusa-manga-corta', 'Blusa manga corta', 'lxl', 'pavo', 165.00, 1),

(17, 'blusa-manga-corta-verde-lxl', 'blusa-manga-corta', 'Blusa manga corta', 'lxl', 'verde', 165.00, 1),
(17, 'conjunto-falda-y-blazer-corinto-m', 'conjunto-falda-y-blazer', 'Conjunto falda y blazer', 'm', 'corinto', 245.00, 1),
(17, 'vestido-de-tirante-doble-y-escote-de-corazon-rosa-palo-xl', 'vestido-de-tirante-doble-y-escote-de-corazon', 'VESTIDO DE TIRANTE DOBLE Y ESCOTE DE CORAZON', 'xl', 'rosa palo', 175.00, 1),

(18, 'vestido-cuello-alto-rosa-palo-s', 'vestido-cuello-alto', 'Vestido cuello alto', 's', 'rosa palo', 100.00, 1),
(18, 'enterizo-escote-diagonal-rosa-palo-m', 'enterizo-escote-diagonal', 'Enterizo escote Diagonal', 'm', 'rosa palo', 225.00, 1),
(18, 'blusa-manga-corta-rojo-lxl', 'blusa-manga-corta', 'Blusa manga corta', 'lxl', 'rojo', 165.00, 1),
(18, 'conjunto-falda-con-pijaso-ajustable-rosa-palo-l', 'conjunto-falda-con-pijaso-ajustable', 'Conjunto falda con pijaso ajustable', 'l', 'rosa palo', 100.00, 1),
(18, 'vestido-de-tirante-doble-y-escote-de-corazon-rosa-palo-m', 'vestido-de-tirante-doble-y-escote-de-corazon', 'VESTIDO DE TIRANTE DOBLE Y ESCOTE DE CORAZON', 'm', 'rosa palo', 175.00, 1);

-- Registrar auditoría para cada pedido ficticio
INSERT INTO audit_logs (table_name, record_id, action, new_values, changed_by, changed_at) VALUES
('orders', '8', 'create', '{"orderId": 8, "total": 245.00, "source": "vendedor", "createdBy": "vendedor1", "customer": "María Elena Gómez", "items": 3}', 'vendedor1', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
('orders', '9', 'create', '{"orderId": 9, "total": 480.50, "source": "catalogo", "customer": "Carlos Alberto Ruiz", "items": 2}', 'catalogo', DATE_SUB(NOW(), INTERVAL 5 HOUR)),
('orders', '10', 'create', '{"orderId": 10, "total": 320.00, "source": "vendedor", "createdBy": "vendedor1", "customer": "Sofía Isabel Mendoza", "items": 2}', 'vendedor1', DATE_SUB(NOW(), INTERVAL 1 DAY)),
('orders', '11', 'create', '{"orderId": 11, "total": 175.00, "source": "catalogo", "customer": "José Antonio Herrera", "items": 1}', 'catalogo', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
('orders', '12', 'create', '{"orderId": 12, "total": 590.00, "source": "vendedor", "createdBy": "vendedor1", "customer": "Ana Lucía Castellanos", "items": 3}', 'vendedor1', DATE_SUB(NOW(), INTERVAL 8 HOUR)),
('orders', '13', 'create', '{"orderId": 13, "total": 210.00, "source": "catalogo", "customer": "Pedro Javier Morales", "items": 2}', 'catalogo', DATE_SUB(NOW(), INTERVAL 2 DAY)),
('orders', '14', 'create', '{"orderId": 14, "total": 165.00, "source": "vendedor", "createdBy": "vendedor1", "customer": "Diana Michelle Fuentes", "items": 1}', 'vendedor1', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
('orders', '15', 'create', '{"orderId": 15, "total": 350.00, "source": "catalogo", "customer": "Luis Fernando Arias", "items": 2}', 'catalogo', DATE_SUB(NOW(), INTERVAL 12 HOUR)),
('orders', '16', 'create', '{"orderId": 16, "total": 445.00, "source": "vendedor", "createdBy": "vendedor1", "customer": "Carmen Beatriz León", "items": 1}', 'vendedor1', DATE_SUB(NOW(), INTERVAL 6 HOUR)),
('orders', '17', 'create', '{"orderId": 17, "total": 780.00, "source": "catalogo", "customer": "Roberto Alejandro Díaz", "items": 3}', 'catalogo', DATE_SUB(NOW(), INTERVAL 3 DAY));
