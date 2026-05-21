const products = [
    {
        id: 'vest-floral-01',
        name: 'Vestido Floral Elegante Mujer',
        price: 185.00,
        original_price: 250.00,
        description: 'Vestido floral de temporada, tela fresca y comoda. Perfecto para cualquier ocasion.',
        category: 'vestidos',
        sale_enabled: 1,
        bundle_2x_enabled: 0,
        is_active: 1,
        images: ['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&h=400&fit=crop'],
        variants: [
            { sku: 'VEST-FLORAL-01-S', size: 'S', color_name: 'Rosa', color_hex: '#ffb6c1', price: 185.00 },
            { sku: 'VEST-FLORAL-01-M', size: 'M', color_name: 'Rosa', color_hex: '#ffb6c1', price: 185.00 },
            { sku: 'VEST-FLORAL-01-L', size: 'L', color_name: 'Rosa', color_hex: '#ffb6c1', price: 185.00 }
        ]
    },
    {
        id: 'blusa-seda-02',
        name: 'Blusa de Seda Manga Larga',
        price: 120.00,
        original_price: 0,
        description: 'Blusa elegante de seda sintetica, ideal para oficina o salidas.',
        category: 'blusas',
        sale_enabled: 0,
        bundle_2x_enabled: 1,
        bundle_2x_price: 200.00,
        is_active: 1,
        images: ['https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=400&h=400&fit=crop'],
        variants: [
            { sku: 'BLUSA-SEDA-02-S', size: 'S', color_name: 'Blanco', color_hex: '#ffffff', price: 120.00 },
            { sku: 'BLUSA-SEDA-02-M', size: 'M', color_name: 'Blanco', color_hex: '#ffffff', price: 120.00 }
        ]
    },
    {
        id: 'falda-plis-03',
        name: 'Falda Plisada Midi',
        price: 145.00,
        original_price: 180.00,
        description: 'Falda plisada de longitud midi, muy versatil y comoda.',
        category: 'faldas',
        sale_enabled: 1,
        bundle_2x_enabled: 0,
        is_active: 1,
        images: ['https://images.unsplash.com/photo-1583496661160-fb5886a0uj70?w=400&h=400&fit=crop'],
        variants: [
            { sku: 'FALDA-PLIS-03-UNI', size: 'Unica', color_name: 'Negro', color_hex: '#000000', price: 145.00 }
        ]
    },
    {
        id: 'pant-jean-04',
        name: 'Pantalon Jeans Skinny',
        price: 165.00,
        original_price: 0,
        description: 'Jeans skinny fit, tela stretch para mayor comodidad.',
        category: 'pantalones',
        sale_enabled: 0,
        bundle_2x_enabled: 0,
        is_active: 1,
        images: ['https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=400&fit=crop'],
        variants: [
            { sku: 'JEAN-SKIN-04-28', size: '28', color_name: 'Azul', color_hex: '#4169e1', price: 165.00 },
            { sku: 'JEAN-SKIN-04-30', size: '30', color_name: 'Azul', color_hex: '#4169e1', price: 165.00 },
            { sku: 'JEAN-SKIN-04-32', size: '32', color_name: 'Azul', color_hex: '#4169e1', price: 165.00 }
        ]
    },
    {
        id: 'top-crop-05',
        name: 'Top Crop Basico',
        price: 75.00,
        original_price: 0,
        description: 'Top crop basico en varios colores. Tela suave y elastica.',
        category: 'blusas',
        sale_enabled: 0,
        bundle_2x_enabled: 1,
        bundle_2x_price: 120.00,
        is_active: 1,
        images: ['https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&h=400&fit=crop'],
        variants: [
            { sku: 'TOP-CROP-05-S-BLK', size: 'S', color_name: 'Negro', color_hex: '#000000', price: 75.00 },
            { sku: 'TOP-CROP-05-M-BLK', size: 'M', color_name: 'Negro', color_hex: '#000000', price: 75.00 },
            { sku: 'TOP-CROP-05-S-WHT', size: 'S', color_name: 'Blanco', color_hex: '#ffffff', price: 75.00 }
        ]
    },
    {
        id: 'vest-cock-06',
        name: 'Vestido Coctel Corto',
        price: 220.00,
        original_price: 280.00,
        description: 'Vestido coctel elegante para eventos especiales.',
        category: 'vestidos',
        sale_enabled: 1,
        bundle_2x_enabled: 0,
        is_active: 1,
        images: ['https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=400&fit=crop'],
        variants: [
            { sku: 'VEST-COCK-06-S', size: 'S', color_name: 'Rojo', color_hex: '#d63031', price: 220.00 },
            { sku: 'VEST-COCK-06-M', size: 'M', color_name: 'Rojo', color_hex: '#d63031', price: 220.00 }
        ]
    },
    {
        id: 'blusa-boho-07',
        name: 'Blusa Boho Estampada',
        price: 135.00,
        original_price: 0,
        description: 'Blusa estilo boho con estampados unicos.',
        category: 'blusas',
        sale_enabled: 0,
        bundle_2x_enabled: 0,
        is_active: 1,
        images: ['https://images.unsplash.com/photo-1551163943-3f6a29e39426?w=400&h=400&fit=crop'],
        variants: [
            { sku: 'BLUSA-BOHO-07-UNI', size: 'Unica', color_name: 'Multicolor', color_hex: '#ff69b4', price: 135.00 }
        ]
    },
    {
        id: 'falda-mini-08',
        name: 'Minifalda Denim',
        price: 110.00,
        original_price: 140.00,
        description: 'Minifalda de denim clasica, nunca pasa de moda.',
        category: 'faldas',
        sale_enabled: 1,
        bundle_2x_enabled: 0,
        is_active: 1,
        images: ['https://images.unsplash.com/photo-1525845859779-54d477ff291f?w=400&h=400&fit=crop'],
        variants: [
            { sku: 'FALDA-MINI-08-S', size: 'S', color_name: 'Azul Denim', color_hex: '#5b7c99', price: 110.00 },
            { sku: 'FALDA-MINI-08-M', size: 'M', color_name: 'Azul Denim', color_hex: '#5b7c99', price: 110.00 }
        ]
    },
    {
        id: 'pant-palaz-09',
        name: 'Pantalon Palazzo',
        price: 155.00,
        original_price: 0,
        description: 'Pantalon palazzo fluido, muy comodo y elegante.',
        category: 'pantalones',
        sale_enabled: 0,
        bundle_2x_enabled: 0,
        is_active: 1,
        images: ['https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&h=400&fit=crop'],
        variants: [
            { sku: 'PANT-PALAZ-09-UNI', size: 'Unica', color_name: 'Beige', color_hex: '#f5deb3', price: 155.00 }
        ]
    },
    {
        id: 'acc-collar-10',
        name: 'Collar Elegante Dorado',
        price: 85.00,
        original_price: 0,
        description: 'Collar dorado minimalista, perfecto para combinar.',
        category: 'accesorios',
        sale_enabled: 0,
        bundle_2x_enabled: 1,
        bundle_2x_price: 140.00,
        is_active: 1,
        images: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=400&fit=crop'],
        variants: [
            { sku: 'ACC-COLLAR-10-UNI', size: 'Unica', color_name: 'Dorado', color_hex: '#ffd700', price: 85.00 }
        ]
    },
    {
        id: 'vest-casu-11',
        name: 'Vestido Casual Verano',
        price: 130.00,
        original_price: 160.00,
        description: 'Vestido ligero ideal para el calor. Tela fresca.',
        category: 'vestidos',
        sale_enabled: 1,
        bundle_2x_enabled: 0,
        is_active: 1,
        images: ['https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=400&fit=crop'],
        variants: [
            { sku: 'VEST-CASU-11-M', size: 'M', color_name: 'Amarillo', color_hex: '#f1c40f', price: 130.00 },
            { sku: 'VEST-CASU-11-L', size: 'L', color_name: 'Amarillo', color_hex: '#f1c40f', price: 130.00 }
        ]
    },
    {
        id: 'blusa-off-12',
        name: 'Blusa Off Shoulder',
        price: 115.00,
        original_price: 0,
        description: 'Blusa off shoulder romantica, ideal para salidas.',
        category: 'blusas',
        sale_enabled: 0,
        bundle_2x_enabled: 0,
        is_active: 1,
        images: ['https://images.unsplash.com/photo-1582142839970-2b9e04b60f65?w=400&h=400&fit=crop'],
        variants: [
            { sku: 'BLUSA-OFF-12-S-WHT', size: 'S', color_name: 'Blanco', color_hex: '#ffffff', price: 115.00 },
            { sku: 'BLUSA-OFF-12-M-WHT', size: 'M', color_name: 'Blanco', color_hex: '#ffffff', price: 115.00 }
        ]
    }
];

async function seed() {
    // Login
    const loginRes = await fetch('http://localhost:8080/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('Login OK, token obtenido');

    for (const product of products) {
        try {
            const res = await fetch('http://localhost:8080/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(product)
            });
            if (res.ok) {
                console.log(`Creado: ${product.name}`);
            } else {
                const err = await res.json().catch(() => ({}));
                console.error(`Error creando ${product.id}:`, err.error || res.status);
            }
        } catch (e) {
            console.error(`Exception ${product.id}:`, e.message);
        }
    }
    console.log('Seed completado');
}

seed();
