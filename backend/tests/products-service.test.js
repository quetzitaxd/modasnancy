const test = require('node:test');
const assert = require('node:assert/strict');

const productsService = require('../products-service');

const {
    normalizeProductData,
    validateAndNormalizeVariants,
    mapProductDbToFrontend
} = productsService.__test;

test('A) producto sin precio base y variantes con precio es valido', () => {
    const product = normalizeProductData({
        name: 'Blusa Bordada',
        price: null
    });

    const variants = validateAndNormalizeVariants([
        { size: 'S', color_name: 'Rojo', color_hex: '#ff0000', price: '199.90' },
        { size: 'M', color_name: 'Rojo', color_hex: '#ff0000', price: '199.90' }
    ], 'blusa-bordada', product.price);

    assert.equal(product.price, null);
    assert.equal(variants[0].price, '199.90');
    assert.equal(variants[1].price, '199.90');
});

test('B) producto con precio base y variantes sin precio heredan correctamente', () => {
    const product = normalizeProductData({
        name: 'Vestido Satin',
        price: '249.50'
    });

    const variants = validateAndNormalizeVariants([
        { size: 'S', color_name: 'Negro', color_hex: '#000000', price: null },
        { size: 'M', color_name: 'Negro', color_hex: '#000000' }
    ], 'vestido-satin', product.price);

    const mapped = mapProductDbToFrontend({
        id: 'vestido-satin',
        name: 'Vestido Satin',
        description: '',
        category: 'vestidos',
        price: product.price
    }, variants, []);

    assert.equal(mapped.price, 249.5);
    assert.deepEqual(mapped.variants.map((variant) => variant.price), [249.5, 249.5]);
});

test('C) producto sin precio y variante sin precio devuelve error', () => {
    const product = normalizeProductData({
        name: 'Top Lino',
        price: null
    });

    assert.throws(() => {
        validateAndNormalizeVariants([
            { size: 'S', color_name: 'Blanco', color_hex: '#ffffff', price: null }
        ], 'top-lino', product.price);
    }, /Debe definir precio en el producto o en todas las variantes/);
});

test('D) producto con precio base 0 devuelve error', () => {
    assert.throws(() => {
        normalizeProductData({
            name: 'Pantalon',
            price: 0
        });
    }, /El precio base debe ser mayor a 0/);
});

test('variante con precio 0 devuelve error', () => {
    const product = normalizeProductData({
        name: 'Camisa',
        price: '150.00'
    });

    assert.throws(() => {
        validateAndNormalizeVariants([
            { size: 'S', color_name: 'Azul', color_hex: '#0000ff', price: 0 }
        ], 'camisa', product.price);
    }, /El precio de la variante debe ser mayor a 0/);
});

test('la respuesta publica nunca devuelve null en price cuando hay precio resoluble', () => {
    const mapped = mapProductDbToFrontend({
        id: 'falda-plisada',
        name: 'Falda Plisada',
        description: '',
        category: 'faldas',
        price: null
    }, [
        { sku: 'falda-plisada-marsala-s', size: 's', color_name: 'marsala', color_hex: '#7a1f3d', price: '320.40' }
    ], []);

    assert.equal(mapped.price, 320.4);
    assert.equal(mapped.variants[0].price, 320.4);
});
