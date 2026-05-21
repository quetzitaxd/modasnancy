const test = require('node:test');
const assert = require('node:assert/strict');

// Mock db for unit tests if possible, but here we can at least test validations
const ordersService = require('../orders-service');
const { 
    validateOrderPayload, 
    resolvePrice, 
    requirePositiveInt 
} = ordersService.__test;

test('A) validateOrderPayload - pedido valido pasa validacion', () => {
    const payload = {
        customer_name: 'Ana Perez',
        phone: '55554444',
        address: 'Calle 1',
        city: 'Guatemala',
        items: [{ sku: 'prod1-size-color', quantity: 2 }]
    };
    
    const validated = validateOrderPayload(payload);
    assert.equal(validated.customer_name, 'Ana Perez');
    assert.equal(validated.items[0].sku, 'prod1-size-color');
});

test('B) validateOrderPayload - rechaza carrito vacio', () => {
    const payload = {
        customer_name: 'Ana',
        phone: '555',
        address: 'A',
        city: 'C',
        items: []
    };
    
    assert.throws(() => validateOrderPayload(payload), /items debe ser un arreglo no vacío/);
});

test('C) requirePositiveInt - rechaza quantity = 0', () => {
    assert.throws(() => requirePositiveInt(0, 'quantity'), /debe ser un número entero mayor a 0/);
    assert.throws(() => requirePositiveInt(-1, 'quantity'), /debe ser un número entero mayor a 0/);
    assert.throws(() => requirePositiveInt('abc', 'quantity'), /debe ser un número entero mayor a 0/);
});

test('D) resolvePrice - ignora precios de cliente y resuelve correctamente', () => {
    // Escenario 1: Variante tiene precio propio
    const price1 = resolvePrice('150.00', '100.00', 'sku-1');
    assert.equal(price1, 150.00);
    
    // Escenario 2: Variante hereda de producto
    const price2 = resolvePrice(null, '80.50', 'sku-2');
    assert.equal(price2, 80.50);
});

test('E) resolvePrice - falla si no hay precio resoluble', () => {
    assert.throws(() => resolvePrice(null, null, 'sku-fail'), /No se pudo resolver un precio valido/);
});

test('F) validateOrderPayload - campos requeridos faltantes', () => {
    assert.throws(() => validateOrderPayload({ phone: '1', address: '2', city: '3' }), /customer_name.*obligatorio/);
    assert.throws(() => validateOrderPayload({ customer_name: '1', address: '2', city: '3' }), /phone.*obligatorio/);
});
