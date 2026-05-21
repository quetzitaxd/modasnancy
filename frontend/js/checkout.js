let freshProducts = [];
let currentPaymentMethod = 'efectivo';

/**
 * Valida datos de tarjeta básicos en el frontend.
 * NO tokeniza — los datos se envían al backend que llama directamente a CuboPago.
 */
function validateCardData(cardData) {
    const { number, expiry, cvc, name } = cardData;
    if (!number || number.replace(/\s/g, '').length < 15) throw new Error('Número de tarjeta inválido');
    if (!expiry || !expiry.match(/^\d{2}\s*\/\s*\d{2}$/)) throw new Error('Fecha de expiración inválida');
    if (!cvc || cvc.length < 3) throw new Error('CVC inválido');
    if (!name || !name.trim()) throw new Error('Nombre en tarjeta requerido');

    const [month, year] = expiry.split(' / ').map(s => s.trim());
    if (!month || !year || month.length !== 2 || year.length !== 2) {
        throw new Error('Fecha de expiración inválida');
    }

    return {
        holder: name.trim(),
        number: number.replace(/\s/g, ''),
        cvv: cvc.trim(),
        month,
        year
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    // Cargar productos para validar precios y promociones frescas
    try {
        const res = await fetch('/api/products');
        if (res.ok) {
            freshProducts = await res.json();
        }
    } catch (err) {
        console.error('Error cargando productos para validación:', err);
    }

    renderCheckoutCart();
    setupPaymentMethodToggle();
    setupCardFormatting();
    setupPhoneFormatting();

    const form = document.getElementById('order-form');
    if (!form) {
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const cart = getCart();
        if (cart.length === 0) {
            return;
        }

        // Validar SKUs contra productos frescos de la API
        const validSkus = new Set();
        if (Array.isArray(freshProducts)) {
            freshProducts.forEach((p) => {
                if (Array.isArray(p.variants)) {
                    p.variants.forEach((v) => validSkus.add(v.sku));
                }
            });
        }

        const validCart = cart.filter((item) => item?.sku && validSkus.has(item.sku));
        const removedCount = cart.length - validCart.length;

        if (validCart.length === 0) {
            const errorMsg = document.getElementById('error-message');
            if (errorMsg) {
                errorMsg.textContent = 'Los productos en tu carrito ya no están disponibles. Actualiza la página.';
                errorMsg.style.display = 'block';
            }
            return;
        }

        if (removedCount > 0) {
            localStorage.setItem('modasnancy_cart', JSON.stringify(validCart));
            updateCartCount();
            renderCheckoutCart();
            const errorMsg = document.getElementById('error-message');
            if (errorMsg) {
                errorMsg.textContent = `${removedCount} producto(s) ya no está(n) disponible(s) y fue(ron) removido(s) del carrito.`;
                errorMsg.style.display = 'block';
            }
        }

        const btn = document.getElementById('btn-submit');
        const errorMsg = document.getElementById('error-message');

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        }

        if (errorMsg) {
            errorMsg.style.display = 'none';
        }

        const name = document.getElementById('customer_name')?.value || '';
        const phoneCountry = document.getElementById('phone_country')?.value || '+502';
        const phoneNumber = document.getElementById('phone_number')?.value || '';
        const phone = phoneCountry + phoneNumber.replace(/\s/g, '');
        const email = document.getElementById('customer_email')?.value || '';
        const notes = document.getElementById('order_notes')?.value || '';
        const depto = document.getElementById('departamento')?.value || '';
        const muni = document.getElementById('municipio')?.value || '';
        const baseAddress = document.getElementById('address')?.value || '';
        const ciudadEspecifica = document.getElementById('ciudad_especifica')?.value || '';

        // Validaciones Manuales
        let error = '';
        if (!name.trim()) error = 'El nombre es obligatorio.';
        else if (!phoneNumber.trim()) error = 'El número de teléfono es obligatorio.';
        else if (!/^\d{8}$/.test(phoneNumber.replace(/\s/g, ''))) error = 'El número de teléfono debe tener exactamente 8 dígitos.';
        else if (email.trim() && !email.includes('@')) error = 'El correo electrónico no es válido.';
        else if (!depto) error = 'El departamento es obligatorio.';
        else if (!muni) error = 'El municipio es obligatorio.';
        else if (!baseAddress.trim()) error = 'La dirección exacta es obligatoria.';

        // Validar tarjeta si es pago con CuboPago
        let cardData = null;
        if (!error && currentPaymentMethod === 'cubopago') {
            const cardNumber = document.getElementById('card_number')?.value || '';
            const cardExpiry = document.getElementById('card_expiry')?.value || '';
            const cardCvc = document.getElementById('card_cvc')?.value || '';
            const cardName = document.getElementById('card_name')?.value || '';

            try {
                cardData = validateCardData({
                    number: cardNumber,
                    expiry: cardExpiry,
                    cvc: cardCvc,
                    name: cardName
                });
            } catch (cardErr) {
                error = cardErr.message || 'Verifica los datos de tu tarjeta.';
            }
        }

        if (error) {
            if (errorMsg) {
                errorMsg.textContent = error;
                errorMsg.style.display = 'block';
            }
            if (btn) {
                btn.disabled = false;
                btn.textContent = currentPaymentMethod === 'cubopago' ? 'Pagar Ahora' : 'Confirmar Pedido';
            }
            return;
        }

        const payload = {
            customer_name: name,
            phone: phone,
            ...(email.trim() ? { email: email.trim() } : {}),
            address: `${baseAddress}${ciudadEspecifica ? ', ' + ciudadEspecifica : ''}`,
            city: `${muni}, ${depto}`,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
            payment_method: currentPaymentMethod,
            items: validCart.map((item) => ({
                sku: item?.sku,
                quantity: item?.quantity
            }))
        };

        try {
            // Paso 1: Crear la orden
            if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando pedido...';

            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Error al procesar');
            }

            const orderData = await res.json();

            // Paso 2: Si es CuboPago, procesar pago
            let payData = null;
            if (currentPaymentMethod === 'cubopago' && cardData) {
                if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando pago con tarjeta...';

                const payRes = await fetch(`/api/orders/${orderData.orderId}/pay`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        card: cardData,
                        ...(email.trim() ? { email: email.trim() } : {})
                    })
                });

                if (!payRes.ok) {
                    const payErr = await payRes.json();
                    const errorText = payErr.error || 'El pago fue rechazado por el banco emisor.';
                    // Pago falló — mostrar opción de reintentar o cambiar a efectivo
                    showPaymentFailed(orderData.orderId, errorText);
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Reintentar Pago';
                    }
                    return;
                }

                payData = await payRes.json();
                if (!payData.success) {
                    showPaymentFailed(orderData.orderId, 'El pago no pudo ser completado.');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Reintentar Pago';
                    }
                    return;
                }
            }

            // Éxito
            localStorage.removeItem('modasnancy_cart');
            updateCartCount();

            const checkoutContent = document.getElementById('checkout-content');
            const successMessage = document.getElementById('success-message');
            const successTitle = document.getElementById('success-title');
            const successDetail = document.getElementById('success-detail');
            const receiptBox = document.getElementById('payment-receipt');

            if (checkoutContent) checkoutContent.style.display = 'none';
            if (successMessage) successMessage.style.display = 'block';

            // Personalizar mensaje según método de pago
            if (currentPaymentMethod === 'cubopago' && payData) {
                if (successTitle) successTitle.textContent = '¡Pago Aprobado!';
                if (successDetail) successDetail.textContent = 'Tu pago con tarjeta fue procesado exitosamente. Te enviaremos un WhatsApp con los detalles de tu pedido.';
                if (receiptBox) {
                    receiptBox.style.display = 'block';
                    const txEl = document.getElementById('receipt-transaction');
                    const authEl = document.getElementById('receipt-auth');
                    if (txEl) txEl.textContent = payData.transactionId || '---';
                    if (authEl) authEl.textContent = payData.authorization || '---';
                }
            } else {
                if (successTitle) successTitle.textContent = '¡Pedido Realizado con Éxito!';
                if (successDetail) successDetail.textContent = 'Gracias por tu compra. Nos pondremos en contacto contigo pronto vía WhatsApp.';
                if (receiptBox) receiptBox.style.display = 'none';
            }
        } catch (err) {
            if (errorMsg) {
                errorMsg.textContent = err.message;
                errorMsg.style.display = 'block';
            }

            if (btn) {
                btn.disabled = false;
                btn.textContent = currentPaymentMethod === 'cubopago' ? 'Pagar Ahora' : 'Confirmar Pedido';
            }
        }
    });
});

function setupPaymentMethodToggle() {
    const radios = document.querySelectorAll('input[name="payment_method"]');
    const cardForm = document.getElementById('card-form');
    const btn = document.getElementById('btn-submit');
    const hint = document.getElementById('payment-hint');

    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            currentPaymentMethod = radio.value;
            const isCard = currentPaymentMethod === 'cubopago';

            if (cardForm) {
                cardForm.style.display = isCard ? 'block' : 'none';
            }
            if (btn) {
                btn.textContent = isCard ? 'Pagar Ahora' : 'Confirmar Pedido';
            }
            if (hint) {
                hint.innerHTML = isCard
                    ? '<i class="fas fa-lock"></i> Pago seguro procesado por CuboPago • <i class="fas fa-shield-alt"></i> Compra segura'
                    : '<i class="fas fa-check-circle"></i> Pago contra entrega • <i class="fas fa-shield-alt"></i> Compra segura';
            }

            // Highlight selected option
            document.querySelectorAll('.payment-option').forEach(opt => {
                opt.style.borderColor = opt.querySelector('input').checked ? 'var(--primary-color)' : 'var(--border-color)';
                opt.style.background = opt.querySelector('input').checked ? '#fff5f7' : 'white';
            });
        });
    });

    // Trigger initial state
    const checked = document.querySelector('input[name="payment_method"]:checked');
    if (checked) checked.dispatchEvent(new Event('change'));
}

function setupCardFormatting() {
    const numberInput = document.getElementById('card_number');
    const expiryInput = document.getElementById('card_expiry');
    const cvcInput = document.getElementById('card_cvc');

    if (numberInput) {
        numberInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '').substring(0, 16);
            v = v.match(/.{1,4}/g)?.join(' ') || v;
            e.target.value = v;
        });
    }

    if (expiryInput) {
        expiryInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '').substring(0, 4);
            if (v.length >= 2) v = v.substring(0, 2) + ' / ' + v.substring(2);
            e.target.value = v;
        });
    }

    if (cvcInput) {
        cvcInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
        });
    }
}

function setupPhoneFormatting() {
    const phoneInput = document.getElementById('phone_number');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 8);
        });
    }
}

function showPaymentFailed(orderId, message) {
    const errorMsg = document.getElementById('error-message');
    if (errorMsg) {
        errorMsg.innerHTML = `
            <div style="margin-bottom: 0.8rem;"><strong>${message}</strong></div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-primary" onclick="retryPayment(${orderId})" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                    <i class="fas fa-redo"></i> Reintentar con Tarjeta
                </button>
                <button type="button" class="btn btn-outline" onclick="switchToCash(${orderId})" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                    <i class="fas fa-money-bill-wave"></i> Cambiar a Efectivo
                </button>
            </div>
        `;
        errorMsg.style.display = 'block';
    }
}

async function retryPayment(orderId) {
    const btn = document.getElementById('btn-submit');
    const errorMsg = document.getElementById('error-message');

    const cardNumber = document.getElementById('card_number')?.value || '';
    const cardExpiry = document.getElementById('card_expiry')?.value || '';
    const cardCvc = document.getElementById('card_cvc')?.value || '';
    const cardName = document.getElementById('card_name')?.value || '';
    const email = document.getElementById('customer_email')?.value || '';

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando con datos actuales...';
    }
    if (errorMsg) {
        errorMsg.style.display = 'none';
    }

    try {
        const cardData = validateCardData({
            number: cardNumber,
            expiry: cardExpiry,
            cvc: cardCvc,
            name: cardName
        });

        const payRes = await fetch(`/api/orders/${orderId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                card: cardData,
                ...(email.trim() ? { email: email.trim() } : {})
            })
        });

        if (!payRes.ok) {
            const payErr = await payRes.json();
            throw new Error(payErr.error || 'El pago fue rechazado.');
        }

        // Éxito
        localStorage.removeItem('modasnancy_cart');
        updateCartCount();
        const checkoutContent = document.getElementById('checkout-content');
        const successMessage = document.getElementById('success-message');
        if (checkoutContent) checkoutContent.style.display = 'none';
        if (successMessage) successMessage.style.display = 'block';
    } catch (err) {
        if (errorMsg) {
            errorMsg.innerHTML = `<div style="margin-bottom: 0.8rem;"><strong>${err.message}</strong></div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-primary" onclick="retryPayment(${orderId})" style="padding: 0.5rem 1rem; font-size: 0.85rem;"><i class="fas fa-redo"></i> Reintentar</button>
                <button type="button" class="btn btn-outline" onclick="switchToCash(${orderId})" style="padding: 0.5rem 1rem; font-size: 0.85rem;"><i class="fas fa-money-bill-wave"></i> Efectivo</button>
            </div>`;
            errorMsg.style.display = 'block';
        }
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Reintentar Pago';
        }
    }
};

async function switchToCash(orderId) {
    // No hacemos nada en el backend — la orden ya está creada con payment_method='cubopago'
    // y payment_status='fallido'. El cliente puede hacer un nuevo pedido con efectivo.
    // Por simplicidad, recargamos la página y preseleccionamos efectivo.
    localStorage.setItem('preferred_payment', 'efectivo');
    window.location.reload();
};

function safeText(value) {
    return String(value ?? '').trim();
}

function safeMoney(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function safeImageUrl(value, fallback) {
    const raw = safeText(value);
    if (!raw) {
        return fallback;
    }

    if (raw.startsWith('/')) {
        return raw;
    }

    try {
        const url = new URL(raw, window.location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
            return url.href;
        }
    } catch {
        // fallback
    }

    return fallback;
}

function makeImage(src, fallback, alt) {
    const img = document.createElement('img');
    img.src = safeImageUrl(src, fallback);
    img.alt = safeText(alt) || 'Imagen';
    img.addEventListener('error', () => {
        img.src = fallback;
    });
    return img;
}

function calculateTotal(cart) {
    const qtyByProduct = {};
    cart.forEach(item => {
        const pid = item.product_id || item.sku;
        if (!qtyByProduct[pid]) qtyByProduct[pid] = 0;
        qtyByProduct[pid] += (Number(item.quantity) || 0);
    });

    return cart.reduce((sum, item) => {
        // Encontrar datos frescos del producto
        const fresh = freshProducts.find(p => p.id === item.product_id);

        const price = safeMoney(fresh ? fresh.price : item?.price);
        const wholesale_enabled = fresh ? fresh.wholesale_enabled : item?.wholesale_enabled;
        const wholesale_min_qty = fresh ? fresh.wholesale_min_qty : item?.wholesale_min_qty;
        const wholesale_discount_percent = fresh ? fresh.wholesale_discount_percent : item?.wholesale_discount_percent;
        const bundle_2x_enabled = fresh ? fresh.bundle_2x_enabled : item?.bundle_2x_enabled;
        const bundle_2x_price = fresh ? fresh.bundle_2x_price : item?.bundle_2x_price;

        const qty = Number(item?.quantity);
        const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;

        const pid = item.product_id || item.sku;
        const totalProductQty = qtyByProduct[pid] || 0;

        let finalPrice = price;
        if (wholesale_enabled && totalProductQty >= wholesale_min_qty && wholesale_discount_percent > 0) {
            finalPrice = price * (1 - (wholesale_discount_percent / 100));
        } else if (bundle_2x_enabled && bundle_2x_price > 0 && totalProductQty >= 2) {
            const pairs = Math.floor(totalProductQty / 2);
            const singles = totalProductQty % 2;
            const totalBundlePrice = (pairs * bundle_2x_price) + (singles * price);
            finalPrice = totalBundlePrice / totalProductQty;
        }

        return sum + (finalPrice * quantity);
    }, 0);
}

function renderCheckoutCart() {
    const cart = getCart();

    const checkoutContent = document.getElementById('checkout-content');
    const emptyCart = document.getElementById('empty-cart');

    if (cart.length === 0) {
        if (checkoutContent) {
            checkoutContent.style.display = 'none';
        }
        if (emptyCart) {
            emptyCart.style.display = 'block';
        }
        return;
    }

    if (checkoutContent) {
        checkoutContent.style.display = 'grid';
    }
    if (emptyCart) {
        emptyCart.style.display = 'none';
    }

    const container = document.getElementById('cart-items');
    if (!container) {
        return;
    }

    container.textContent = '';

    cart.forEach((item, index) => {
        const price = safeMoney(item?.price);
        const qty = Number(item?.quantity);
        const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;

        const row = document.createElement('div');
        row.className = 'cart-item';

        const image = makeImage(item?.image, 'https://via.placeholder.com/80x100?text=Img', item?.name);

        const details = document.createElement('div');
        details.className = 'cart-item-details';

        const head = document.createElement('div');
        head.style.display = 'flex';
        head.style.justifyContent = 'space-between';
        head.style.marginBottom = '0.5rem';

        const title = document.createElement('div');
        title.className = 'cart-item-title';
        title.textContent = safeText(item?.name) || 'Producto';

        const priceLabel = document.createElement('div');
        priceLabel.style.fontWeight = '600';
        priceLabel.style.color = 'var(--accent-color)';
        
        // Wholesale logic for display
        const qtyByProduct = {};
        cart.forEach(it => {
            const pid = it.product_id || it.sku;
            if (!qtyByProduct[pid]) qtyByProduct[pid] = 0;
            qtyByProduct[pid] += (Number(it.quantity) || 0);
        });

        const pid = item.product_id || item.sku;
        const totalProductQty = qtyByProduct[pid] || 0;

        // Datos frescos para el renderizado visual
        const fresh = freshProducts.find(p => p.id === item.product_id);
        const currentPrice = safeMoney(fresh ? fresh.price : price);
        const currentWholesaleEnabled = fresh ? fresh.wholesale_enabled : item.wholesale_enabled;
        const currentWholesaleMin = fresh ? fresh.wholesale_min_qty : item.wholesale_min_qty;
        const currentWholesalePercent = fresh ? fresh.wholesale_discount_percent : item.wholesale_discount_percent;
        const currentSaleEnabled = fresh ? fresh.sale_enabled : item.sale_enabled;
        const currentOriginalPrice = safeMoney(fresh ? fresh.original_price : item.original_price);
        const currentBundleEnabled = fresh ? fresh.bundle_2x_enabled : item.bundle_2x_enabled;
        const currentBundlePrice = fresh ? fresh.bundle_2x_price : item.bundle_2x_price;

        const isWholesale = currentWholesaleEnabled && totalProductQty >= currentWholesaleMin && currentWholesalePercent > 0;
        const isBundle = currentBundleEnabled && currentBundlePrice > 0 && totalProductQty >= 2;

        if (isWholesale) {
            const discountedPrice = currentPrice * (1 - (currentWholesalePercent / 100));
            priceLabel.innerHTML = `<span style="text-decoration: line-through; color: #999; font-size: 0.8rem; margin-right: 0.5rem;">Q${currentPrice.toFixed(2)}</span> Q${discountedPrice.toFixed(2)}`;

            const badge = document.createElement('div');
            badge.style.fontSize = '0.7rem';
            badge.style.background = '#e84393';
            badge.style.color = 'white';
            badge.style.padding = '2px 6px';
            badge.style.borderRadius = '4px';
            badge.style.display = 'inline-block';
            badge.style.marginTop = '4px';
            badge.textContent = `-${currentWholesalePercent}% Mayorista`;
            priceLabel.appendChild(badge);
        } else if (isBundle) {
            const pairs = Math.floor(totalProductQty / 2);
            const singles = totalProductQty % 2;
            const totalBundlePrice = (pairs * currentBundlePrice) + (singles * currentPrice);
            const avgPrice = totalBundlePrice / totalProductQty;
            priceLabel.innerHTML = `<span style="text-decoration: line-through; color: #999; font-size: 0.8rem; margin-right: 0.5rem;">Q${currentPrice.toFixed(2)}</span> Q${avgPrice.toFixed(2)}`;

            const badge = document.createElement('div');
            badge.style.fontSize = '0.7rem';
            badge.style.background = '#fde68a';
            badge.style.color = '#b45309';
            badge.style.padding = '2px 6px';
            badge.style.borderRadius = '4px';
            badge.style.display = 'inline-block';
            badge.style.marginTop = '4px';
            badge.textContent = 'Oferta 2x';
            priceLabel.appendChild(badge);
        } else if (currentSaleEnabled && currentOriginalPrice > 0 && currentOriginalPrice !== currentPrice) {
            priceLabel.innerHTML = `<span style="text-decoration: line-through; color: #999; font-size: 0.8rem; margin-right: 0.5rem;">Q${currentOriginalPrice.toFixed(2)}</span> Q${currentPrice.toFixed(2)}`;

            const badge = document.createElement('div');
            badge.style.fontSize = '0.7rem';
            badge.style.background = '#d63031';
            badge.style.color = 'white';
            badge.style.padding = '2px 6px';
            badge.style.borderRadius = '4px';
            badge.style.display = 'inline-block';
            badge.style.marginTop = '4px';
            badge.textContent = 'Oferta';
            priceLabel.appendChild(badge);
        } else {
            priceLabel.textContent = `Q${currentPrice.toFixed(2)}`;
        }

        head.appendChild(title);
        head.appendChild(priceLabel);

        const meta = document.createElement('div');
        meta.className = 'cart-item-meta';
        const sizeLabel = (safeText(item?.size) || 'Unica').toUpperCase();
        const colorLabel = safeText(item?.color_name).toUpperCase();
        meta.textContent = colorLabel ? `Talla: ${sizeLabel} | Color: ${colorLabel}` : `Talla: ${sizeLabel}`;

        const actions = document.createElement('div');
        actions.className = 'cart-item-actions';

        const qtyControls = document.createElement('div');
        qtyControls.className = 'qty-controls';

        const minusBtn = document.createElement('button');
        minusBtn.type = 'button';
        minusBtn.className = 'qty-btn';
        minusBtn.innerHTML = '<i class="fas fa-minus" style="font-size:10px"></i>';
        minusBtn.addEventListener('click', () => updateCheckoutQty(index, -1));

        const qtyLabel = document.createElement('span');
        qtyLabel.style.fontSize = '0.95rem';
        qtyLabel.style.fontWeight = '600';
        qtyLabel.style.width = '24px';
        qtyLabel.style.textAlign = 'center';
        qtyLabel.textContent = String(quantity);

        const plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.className = 'qty-btn';
        plusBtn.innerHTML = '<i class="fas fa-plus" style="font-size:10px"></i>';
        plusBtn.addEventListener('click', () => updateCheckoutQty(index, 1));

        qtyControls.appendChild(minusBtn);
        qtyControls.appendChild(qtyLabel);
        qtyControls.appendChild(plusBtn);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-item-btn';
        removeBtn.style.fontSize = '0.9rem';
        removeBtn.innerHTML = '<i class="far fa-trash-alt"></i> Eliminar';
        removeBtn.addEventListener('click', () => removeCheckoutItem(index));

        actions.appendChild(qtyControls);
        actions.appendChild(removeBtn);

        details.appendChild(head);
        details.appendChild(meta);
        details.appendChild(actions);

        row.appendChild(image);
        row.appendChild(details);

        container.appendChild(row);
    });

    const totalText = `Q${calculateTotal(cart).toFixed(2)}`;
    const subtotalEl = document.getElementById('checkout-subtotal');
    const totalEl = document.getElementById('checkout-total');
    if (subtotalEl) {
        subtotalEl.textContent = totalText;
    }
    if (totalEl) {
        totalEl.textContent = totalText;
    }

    const disclaimerEl = document.getElementById('checkout-price-disclaimer');
    if (!disclaimerEl) {
        const totalRow = totalEl?.parentElement;
        if (totalRow) {
            const disc = document.createElement('div');
            disc.id = 'checkout-price-disclaimer';
            disc.style.cssText = 'font-size:0.7rem;color:#94a3b8;margin-top:0.3rem;';
            disc.textContent = 'Los precios se confirman al momento de procesar el pedido.';
            totalRow.appendChild(disc);
        }
    }
};

function updateCheckoutQty(index, delta) {
    const cart = getCart();
    if (!cart[index]) {
        return;
    }

    cart[index].quantity = Number(cart[index].quantity || 0) + delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }

    saveCart(cart);
};

function removeCheckoutItem(index) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
};
