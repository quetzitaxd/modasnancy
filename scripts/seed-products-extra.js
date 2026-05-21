// Añadir stock y actualizar imagenes de los productos seedeados

const BASE = 'http://localhost:8080';

async function seedExtra() {
    // Login
    const loginRes = await fetch(`${BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    // Obtener todos los productos
    const productsRes = await fetch(`${BASE}/api/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const products = await productsRes.json();

    // URLs de imagenes de placeholder realistas (usamos placehold.co que funciona bien)
    const imageMap = {
        'vest-floral-01': 'https://placehold.co/400x400/e85c8a/ffffff?text=Vestido+Floral',
        'blusa-seda-02': 'https://placehold.co/400x400/c97a7a/ffffff?text=Blusa+Seda',
        'falda-plis-03': 'https://placehold.co/400x400/b07cc9/ffffff?text=Falda+Plisada',
        'pant-jean-04': 'https://placehold.co/400x400/4169e1/ffffff?text=Jeans',
        'top-crop-05': 'https://placehold.co/400x400/ffb6c1/333333?text=Top+Crop',
        'vest-cock-06': 'https://placehold.co/400x400/d63031/ffffff?text=Vestido+Coctel',
        'blusa-boho-07': 'https://placehold.co/400x400/ff69b4/ffffff?text=Blusa+Boho',
        'falda-mini-08': 'https://placehold.co/400x400/5b7c99/ffffff?text=Minifalda',
        'pant-palaz-09': 'https://placehold.co/400x400/f5deb3/333333?text=Palazzo',
        'acc-collar-10': 'https://placehold.co/400x400/ffd700/333333?text=Collar',
        'vest-casu-11': 'https://placehold.co/400x400/f1c40f/333333?text=Vestido+Verano',
        'blusa-off-12': 'https://placehold.co/400x400/ffffff/333333?text=Blusa+Off+Shoulder'
    };

    for (const product of products) {
        // 1. Añadir stock a cada variante
        if (Array.isArray(product.variants)) {
            for (const variant of product.variants) {
                try {
                    const stockQty = Math.floor(Math.random() * 15) + 5; // 5-20 unidades
                    await fetch(`${BASE}/api/inventory/entry`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            sku: variant.sku,
                            quantity: stockQty,
                            reason: 'Stock inicial de prueba'
                        })
                    });
                    console.log(`  Stock +${stockQty} para ${variant.sku}`);
                } catch (e) {
                    console.error(`  Error stock ${variant.sku}:`, e.message);
                }
            }
        }

        // 2. Actualizar imagen del producto
        const imgUrl = imageMap[product.id];
        if (imgUrl) {
            try {
                await fetch(`${BASE}/api/products/${product.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        images: [imgUrl]
                    })
                });
                console.log(`  Imagen actualizada para ${product.id}`);
            } catch (e) {
                console.error(`  Error imagen ${product.id}:`, e.message);
            }
        }
    }

    console.log('Stock e imagenes actualizados');
}

seedExtra();
