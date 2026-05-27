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
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/products`);
        if (res.ok) {
            freshProducts = await res.json();
        }
    } catch (err) {
        console.error('Error cargando productos para validación:', err);
    }

    setupPaymentMethodToggle();
    setupCardFormatting();
    setupPhoneFormatting();

    const form = document.getElementById('order-form');
    if (!form) {
        return;
    }

    // Re-renderizar checkout cuando el carrito cambie desde otras vistas
    window.addEventListener('cart:updated', () => {
        renderCheckoutCart();
    });

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
            window.Cart.setItems(validCart);
            const errorMsg = document.getElementById('error-message');
            if (errorMsg) {
                errorMsg.textContent = `${removedCount} producto(s) ya no está(n) disponible(s) y fue(ron) removido(s) del carrito.`;
                errorMsg.style.display = 'block';
            }
        }

        // Validar stock por variante antes de enviar
        const skuToFreshVariant = {};
        if (Array.isArray(freshProducts)) {
            freshProducts.forEach((p) => {
                if (Array.isArray(p.variants)) {
                    p.variants.forEach((v) => {
                        skuToFreshVariant[v.sku] = v;
                    });
                }
            });
        }

        const qtyBySku = {};
        validCart.forEach((item) => {
            qtyBySku[item.sku] = (qtyBySku[item.sku] || 0) + (Number(item.quantity) || 0);
        });

        for (const [sku, qty] of Object.entries(qtyBySku)) {
            const freshVariant = skuToFreshVariant[sku];
            const stock = freshVariant ? (Number(freshVariant.stock) || 0) : 0;
            if (qty > stock) {
                const errorMsg = document.getElementById('error-message');
                if (errorMsg) {
                    errorMsg.textContent = `No hay suficiente stock para ${freshVariant ? safeText(freshVariant.product_name || sku) : sku}. Solo quedan ${stock} unidad${stock !== 1 ? 'es' : ''}. Reduce la cantidad o elimina el producto.`;
                    errorMsg.style.display = 'block';
                }
                const btn = document.getElementById('btn-submit');
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = currentPaymentMethod === 'cubopago' ? 'Pagar Ahora' : 'Confirmar Pedido';
                }
                return;
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

            const res = await fetch(`${API_CONFIG.BASE_URL}/api/orders`, {
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

                const payRes = await fetch(`${API_CONFIG.BASE_URL}/api/orders/${orderData.orderId}/pay`, {
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
            window.Cart.clear();

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

        const payRes = await fetch(`${API_CONFIG.BASE_URL}/api/orders/${orderId}/pay`, {
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
        window.Cart.clear();
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
        return window.isNativeApp ? `https://modasnancy.com${raw}` : raw;
    }

    try {
        const url = new URL(raw, window.location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
            if (window.isNativeApp && (url.host === 'localhost' || url.protocol === 'capacitor:')) {
                return `https://modasnancy.com${url.pathname}${url.search}`;
            }
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


