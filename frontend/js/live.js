/**
 * live.js
 * Formulario de compra en vivo (live shopping) para modasnancy.com
 * Permite agregar multiples paquetes por codigo, con cantidad editable.
 * Envio fijo Q25.
 */

let addedPackages = []; // { code, name, price, image_url, quantity }
let currentPaymentMethod = 'efectivo';
let receiptFile = null; // archivo seleccionado para comprobante
const SHIPPING_COST = 25;

// Alias por compatibilidad (algunas versiones cacheadas usaban toSafeString)
const toSafeString = safeText;

document.addEventListener('DOMContentLoaded', () => {
    setupPaymentToggle();
    setupCardFormatting();
    setupPhoneFormatting();
    setupGuatemalaSelects();
    setupFormSubmit();
    updateTotals();
    renderPackagesList();

    // Enter en input de codigo agrega paquete
    const codeInput = document.getElementById('package-code-input');
    if (codeInput) {
        codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addPackageByCode();
            }
        });
    }

    // Pre-cargar paquete desde link directo (e.g. live.html?codigo=ABC)
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('codigo');
    if (codeFromUrl) {
        addPackageByCodeRaw(safeText(codeFromUrl));
    }
});

// ─── Gestión de paquetes ───────────────────────────────────────────────────

async function addPackageByCodeRaw(code) {
    if (!code) return;

    // Verificar si ya esta agregado
    const existing = addedPackages.find((p) => p.code === code);
    if (existing) {
        existing.quantity += 1;
        renderPackagesList();
        updateTotals();
        if (typeof showToast === 'function') showToast(`Paquete "${escapeHtml(code)}" agregado desde link`, 'success');
        return;
    }

    try {
        const pkg = await getLivePackage(code);
        if (!pkg) {
            showError(`Paquete "${code}" no encontrado`);
            if (typeof showToast === 'function') showToast(`Paquete "${escapeHtml(code)}" no encontrado`, 'error');
            return;
        }
        if (pkg.stock_quantity <= 0) {
            showError(`Paquete "${code}" agotado`);
            if (typeof showToast === 'function') showToast(`Paquete "${escapeHtml(code)}" agotado`, 'error');
            return;
        }
        addedPackages.push({
            code: pkg.code,
            name: pkg.name,
            price: Number(pkg.price),
            image_url: pkg.image_url,
            quantity: 1
        });
        hideError();
        renderPackagesList();
        updateTotals();
        if (typeof showToast === 'function') showToast(`Paquete "${escapeHtml(pkg.name)}" agregado desde link`, 'success');
    } catch (err) {
        showError(err.message || `Error buscando paquete "${code}"`);
        if (typeof showToast === 'function') showToast(`Error buscando paquete "${escapeHtml(code)}"`, 'error');
    }
}

async function addPackageByCode() {
    const input = document.getElementById('package-code-input');
    const code = safeText(input.value);
    if (!code) return;
    await addPackageByCodeRaw(code);
    if (input) input.value = '';
}

function removePackage(index) {
    addedPackages.splice(index, 1);
    renderPackagesList();
    updateTotals();
}

function changePackageQty(index, delta) {
    const pkg = addedPackages[index];
    if (!pkg) return;
    const newQty = pkg.quantity + delta;
    if (newQty < 1) {
        removePackage(index);
        return;
    }
    pkg.quantity = newQty;
    renderPackagesList();
    updateTotals();
}

function setPackageQty(index, value) {
    const pkg = addedPackages[index];
    if (!pkg) return;
    const qty = parseInt(value, 10);
    if (!Number.isInteger(qty) || qty < 1) {
        removePackage(index);
        return;
    }
    pkg.quantity = qty;
    renderPackagesList();
    updateTotals();
}

function renderPackagesList() {
    const container = document.getElementById('packages-list');
    const emptyMsg = document.getElementById('packages-empty');
    if (!container || !emptyMsg) return;

    if (addedPackages.length === 0) {
        container.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }
    emptyMsg.style.display = 'none';

    container.innerHTML = '';
    addedPackages.forEach((pkg, index) => {
        const div = document.createElement('div');
        div.className = 'package-item';
        div.innerHTML = `
            <div class="package-item__img">
                <img src="${safeImageUrl(pkg.image_url, '/assets/placeholder.svg')}" alt="${safeText(pkg.name)}" loading="lazy" onerror="this.src='/assets/placeholder.svg'">
            </div>
            <div class="package-item__info">
                <div class="package-item__name">${escapeHtml(pkg.name)}</div>
                <div class="package-item__meta">Codigo: ${escapeHtml(pkg.code)}</div>
            </div>
            <div class="package-item__qty">
                <button type="button" onclick="changePackageQty(${index}, -1)">-</button>
                <input type="number" min="1" value="${pkg.quantity}" onchange="setPackageQty(${index}, this.value)">
                <button type="button" onclick="changePackageQty(${index}, 1)">+</button>
            </div>
            <div class="package-item__price">${formatMoney(pkg.price * pkg.quantity)}</div>
            <button type="button" class="package-item__remove" onclick="removePackage(${index})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        `;
        container.appendChild(div);
    });
}

function updateTotals() {
    const subtotal = addedPackages.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const isTransfer = currentPaymentMethod === 'transferencia';
    const discount = isTransfer ? Math.round(subtotal * 0.04 * 100) / 100 : 0;
    const total = subtotal + SHIPPING_COST - discount;

    document.getElementById('live-subtotal').textContent = formatMoney(subtotal);
    document.getElementById('live-total').textContent = formatMoney(total);
    document.getElementById('bottom-total').textContent = formatMoney(total);

    const discountRow = document.getElementById('discount-row');
    const discountEl = document.getElementById('live-discount');
    if (discountRow && discountEl) {
        if (isTransfer && discount > 0) {
            discountRow.style.display = 'flex';
            discountEl.textContent = '-' + formatMoney(discount);
        } else {
            discountRow.style.display = 'none';
        }
    }
}

// ─── Form helpers ──────────────────────────────────────────────────────────

function setupPaymentToggle() {
    const radios = document.querySelectorAll('input[name="payment_method"]');
    const cardForm = document.getElementById('card-form');
    const transferPanel = document.getElementById('transfer-panel');
    const btn = document.getElementById('btn-submit');

    radios.forEach((radio) => {
        radio.addEventListener('change', () => {
            currentPaymentMethod = radio.value;
            const isCard = currentPaymentMethod === 'cubopago';
            const isTransfer = currentPaymentMethod === 'transferencia';
            if (cardForm) cardForm.style.display = isCard ? 'block' : 'none';
            if (transferPanel) transferPanel.style.display = isTransfer ? 'block' : 'none';
            if (btn) btn.textContent = isCard ? 'Pagar Ahora' : 'Confirmar Pedido';

            document.querySelectorAll('.payment-option').forEach((opt) => {
                opt.classList.toggle('active', opt.querySelector('input').checked);
            });
            updateTotals();
        });
    });
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

function setupGuatemalaSelects() {
    if (typeof window.GUATEMALA_DATA === 'undefined') return;
    window.GUATEMALA_DATA.initializeSelects('departamento', 'municipio');
}

function validateCardData() {
    const number = document.getElementById('card_number')?.value || '';
    const expiry = document.getElementById('card_expiry')?.value || '';
    const cvc = document.getElementById('card_cvc')?.value || '';
    const name = document.getElementById('card_name')?.value || '';

    if (number.replace(/\s/g, '').length < 15) throw new Error('Numero de tarjeta invalido');
    if (!expiry.match(/^\d{2}\s*\/\s*\d{2}$/)) throw new Error('Fecha de expiracion invalida');
    if (!cvc || cvc.length < 3) throw new Error('CVC invalido');
    if (!name.trim()) throw new Error('Nombre en tarjeta requerido');

    const [month, year] = expiry.split(' / ').map((s) => s.trim());
    return { holder: name.trim(), number: number.replace(/\s/g, ''), cvv: cvc.trim(), month, year };
}

function handleReceiptFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    receiptFile = file;

    const area = document.getElementById('transfer-upload-area');
    const preview = document.getElementById('receipt-preview');
    const text = area.querySelector('.transfer-upload__text');

    if (area) area.classList.add('has-file');
    if (text) text.innerHTML = '<strong>' + escapeHtml(file.name) + '</strong> seleccionado';

    if (preview && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => { preview.src = e.target.result; preview.classList.add('visible'); };
        reader.readAsDataURL(file);
    } else if (preview) {
        preview.classList.remove('visible');
    }
}

async function uploadReceipt() {
    if (!receiptFile) return null;
    const formData = new FormData();
    formData.append('receipt', receiptFile);
    const res = await fetch('/api/upload-receipt', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Error subiendo comprobante: ' + res.status);
    const data = await res.json();
    if (!data || !data.url) throw new Error('Respuesta invalida del servidor al subir comprobante');
    return data.url;
}

function showError(msg) {
    const el = document.getElementById('form-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
}

function hideError() {
    const el = document.getElementById('form-error');
    if (!el) return;
    el.textContent = '';
    el.classList.remove('visible');
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── Submit ────────────────────────────────────────────────────────────────

function setupFormSubmit() {
    const form = document.getElementById('live-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit');

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Procesando...';
        hideError();

        try {
            if (addedPackages.length === 0) {
                throw new Error('Agrega al menos un paquete a tu pedido.');
            }

            const name = document.getElementById('customer_name')?.value || '';
            const phoneCountry = document.getElementById('phone_country')?.value || '+502';
            const phoneNumber = document.getElementById('phone_number')?.value || '';
            const phone = phoneCountry + phoneNumber.replace(/\s/g, '');
            const depto = document.getElementById('departamento')?.value || '';
            const muni = document.getElementById('municipio')?.value || '';
            const address = document.getElementById('address')?.value || '';
            const notes = document.getElementById('order_notes')?.value || '';

            let error = '';
            if (!name.trim()) error = 'El nombre es obligatorio.';
            else if (!phoneNumber.trim()) error = 'El telefono es obligatorio.';
            else if (!/^\d{8}$/.test(phoneNumber.replace(/\s/g, ''))) error = 'El telefono debe tener 8 digitos.';
            else if (!depto) error = 'El departamento es obligatorio.';
            else if (!muni) error = 'El municipio es obligatorio.';
            else if (!address.trim()) error = 'La direccion es obligatoria.';

            let cardData = null;
            if (!error && currentPaymentMethod === 'cubopago') {
                try { cardData = validateCardData(); } catch (cErr) { error = cErr.message; }
            }

            if (!error && currentPaymentMethod === 'transferencia' && !receiptFile) {
                error = 'Adjunta el comprobante de tu transferencia para continuar.';
            }

            if (error) throw new Error(error);

            const subtotal = addedPackages.reduce((sum, p) => sum + (p.price * p.quantity), 0);
            const discount = currentPaymentMethod === 'transferencia' ? Math.round(subtotal * 0.04 * 100) / 100 : 0;

            let receiptUrl = null;
            if (currentPaymentMethod === 'transferencia') {
                btn.textContent = 'Subiendo comprobante...';
                receiptUrl = await uploadReceipt();
            }

            const payload = {
                customer_name: name.trim(),
                phone: phone,
                address: address.trim(),
                city: `${muni}, ${depto}`,
                ...(notes.trim() ? { notes: notes.trim() } : {}),
                payment_method: currentPaymentMethod,
                packages: addedPackages.map((p) => ({ code: p.code, quantity: p.quantity })),
                ...(discount > 0 ? { discount_amount: Number(discount.toFixed(2)) } : {}),
                ...(receiptUrl ? { payment_receipt_url: receiptUrl } : {})
            };

            btn.textContent = 'Creando pedido...';
            const orderData = await createLiveOrder(payload);

            if (currentPaymentMethod === 'cubopago' && cardData) {
                btn.textContent = 'Procesando pago...';
                await payOrder(orderData.orderId, cardData);

                document.getElementById('form-view').style.display = 'none';
                document.getElementById('live-bottom').style.display = 'none';
                document.getElementById('success-view').style.display = 'block';
                document.getElementById('success-title').textContent = 'Pago Aprobado!';
                document.getElementById('success-detail').textContent = 'Tu pago con tarjeta fue procesado exitosamente.';
            } else {
                document.getElementById('form-view').style.display = 'none';
                document.getElementById('live-bottom').style.display = 'none';
                document.getElementById('success-view').style.display = 'block';
            }
        } catch (err) {
            showError(err.message || 'Error procesando pedido');
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

// Exponer funciones globales para inline handlers
window.addPackageByCode = addPackageByCode;
window.addPackageByCodeRaw = addPackageByCodeRaw;
window.removePackage = removePackage;
window.changePackageQty = changePackageQty;
window.setPackageQty = setPackageQty;
window.handleReceiptFile = handleReceiptFile;
