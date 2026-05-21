let sellerProducts = [];
let sellerOrders = [];

function toSafeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function escapeHtml(str) {
    const safe = toSafeText(str);
    return safe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toSafeMoney(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isLikelyJwt(token) {
    const raw = toSafeText(token);
    return raw.split('.').length === 3;
}

function getToken() {
    return localStorage.getItem('seller_token');
}

function getUser() {
    try {
        const token = getToken();
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch {
        return null;
    }
}

function clearSession(message) {
    localStorage.removeItem('seller_token');
    document.getElementById('login-view').style.display = 'grid';
    document.getElementById('dashboard-view').style.display = 'none';
    const err = document.getElementById('login-error');
    if (err) {
        err.textContent = toSafeText(message) || 'Sesion expirada. Inicia sesion nuevamente.';
        err.style.display = 'block';
    }
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    try {
        return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    } catch {
        return date.toLocaleString();
    }
}

function checkAuth() {
    const token = getToken();
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginError = document.getElementById('login-error');

    if (token && isLikelyJwt(token)) {
        const user = getUser();
        if (user && (user.role === 'vendedor' || user.role === 'admin')) {
            if (loginView) loginView.style.display = 'none';
            if (dashboardView) dashboardView.style.display = 'block';
            const nameEl = document.getElementById('seller-name');
            if (nameEl) nameEl.textContent = user.name || user.sub || 'Vendedor';
            loadProducts();
            loadSellerOrders();
            return;
        }
    }

    if (token && !isLikelyJwt(token)) {
        localStorage.removeItem('seller_token');
    }

    if (loginView) loginView.style.display = 'grid';
    if (dashboardView) dashboardView.style.display = 'none';
    if (loginError) loginError.style.display = 'none';
}

async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
        clearSession();
        throw new Error('Sesion expirada');
    }
    return res;
}

async function loadProducts() {
    try {
        const res = await apiFetch('/api/vendedor/products');
        const data = await res.json();
        sellerProducts = Array.isArray(data) ? data : [];
        // Actualizar todos los selects de producto ya existentes
        updateAllProductSelects();
    } catch (err) {
        console.error('Error cargando productos', err);
    }
}

function updateAllProductSelects() {
    document.querySelectorAll('.sale-product').forEach((select) => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecciona producto</option>';
        sellerProducts.forEach((p) => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (Q${toSafeMoney(p.price).toFixed(2)})`;
            select.appendChild(opt);
        });
        if (currentValue) {
            select.value = currentValue;
            // Disparar change para actualizar variantes
            select.dispatchEvent(new Event('change'));
        }
    });
}

async function loadSellerOrders() {
    try {
        const res = await apiFetch('/api/vendedor/orders');
        const data = await res.json();
        sellerOrders = Array.isArray(data) ? data : [];
        renderSellerOrders();
    } catch (err) {
        console.error('Error cargando pedidos', err);
    }
}

function renderSellerOrders() {
    const tbody = document.getElementById('seller-orders-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (sellerOrders.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.style.textAlign = 'center';
        td.style.padding = '2rem';
        td.style.color = '#888';
        td.textContent = 'No has registrado pedidos aún.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    sellerOrders.forEach((order) => {
        const tr = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = `#${toSafeText(order.id)}`;

        const tdDate = document.createElement('td');
        tdDate.textContent = formatDate(order.created_at);

        const tdName = document.createElement('td');
        tdName.textContent = toSafeText(order.customer_name);

        const tdTotal = document.createElement('td');
        tdTotal.innerHTML = `<strong>Q${toSafeMoney(order.total).toFixed(2)}</strong>`;

        const tdStatus = document.createElement('td');
        const statusBadge = document.createElement('span');
        const status = toSafeText(order.status).toLowerCase();
        statusBadge.className = `status-badge status-${status}`;
        statusBadge.textContent = status.toUpperCase();
        tdStatus.appendChild(statusBadge);

        const tdSource = document.createElement('td');
        const source = toSafeText(order.source).toLowerCase();
        const sourceBadge = document.createElement('span');
        sourceBadge.className = `source-badge source-${source}`;
        sourceBadge.textContent = source === 'vendedor' ? 'Vendedor' : 'Catálogo';
        tdSource.appendChild(sourceBadge);

        tr.appendChild(tdId);
        tr.appendChild(tdDate);
        tr.appendChild(tdName);
        tr.appendChild(tdTotal);
        tr.appendChild(tdStatus);
        tr.appendChild(tdSource);
        tbody.appendChild(tr);
    });
}

function getVariantDisplayName(variant) {
    const size = toSafeText(variant.size).toUpperCase();
    const color = toSafeText(variant.color_name);
    return color ? `${size} / ${color}` : size;
}

function addSaleItem() {
    const container = document.getElementById('sale-items');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'sale-item';
    row.dataset.itemId = Date.now().toString();

    // Product select
    const productGroup = document.createElement('div');
    productGroup.className = 'form-group';
    const productSelect = document.createElement('select');
    productSelect.className = 'sale-product';
    productSelect.required = true;
    if (sellerProducts.length === 0) {
        productSelect.innerHTML = '<option value="">Cargando productos...</option>';
        productSelect.disabled = true;
    } else {
        productSelect.innerHTML = '<option value="">Selecciona producto</option>';
        sellerProducts.forEach((p) => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (Q${toSafeMoney(p.price).toFixed(2)})`;
            productSelect.appendChild(opt);
        });
        productSelect.disabled = false;
    }
    productGroup.appendChild(productSelect);

    // Variant select
    const variantGroup = document.createElement('div');
    variantGroup.className = 'form-group';
    const variantSelect = document.createElement('select');
    variantSelect.className = 'sale-variant';
    variantSelect.required = true;
    variantSelect.innerHTML = '<option value="">Variante</option>';
    variantGroup.appendChild(variantSelect);

    // Quantity
    const qtyGroup = document.createElement('div');
    qtyGroup.className = 'form-group';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'sale-qty';
    qtyInput.min = '1';
    qtyInput.value = '1';
    qtyInput.required = true;
    qtyGroup.appendChild(qtyInput);

    // Remove btn
    const removeGroup = document.createElement('div');
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
    removeBtn.addEventListener('click', () => {
        row.remove();
        updateSaleTotals();
    });
    removeGroup.appendChild(removeBtn);

    row.appendChild(productGroup);
    row.appendChild(variantGroup);
    row.appendChild(qtyGroup);
    row.appendChild(removeGroup);

    // Event: product change -> update variants
    productSelect.addEventListener('change', () => {
        variantSelect.innerHTML = '<option value="">Variante</option>';
        const product = sellerProducts.find((p) => p.id === productSelect.value);
        if (product && Array.isArray(product.variants)) {
            product.variants.forEach((v) => {
                const opt = document.createElement('option');
                opt.value = v.sku;
                opt.textContent = getVariantDisplayName(v);
                opt.dataset.price = v.price;
                variantSelect.appendChild(opt);
            });
        }
        updateSaleTotals();
    });

    variantSelect.addEventListener('change', updateSaleTotals);
    qtyInput.addEventListener('input', updateSaleTotals);

    container.appendChild(row);
}

function updateSaleTotals() {
    let subtotal = 0;
    document.querySelectorAll('.sale-item').forEach((row) => {
        const variantSelect = row.querySelector('.sale-variant');
        const qtyInput = row.querySelector('.sale-qty');
        const selected = variantSelect?.selectedOptions[0];
        if (selected && selected.dataset.price) {
            const price = Number(selected.dataset.price) || 0;
            const qty = Number(qtyInput?.value) || 0;
            subtotal += price * qty;
        }
    });

    const subtotalEl = document.getElementById('sale-subtotal');
    const totalEl = document.getElementById('sale-total');
    if (subtotalEl) subtotalEl.textContent = `Q${subtotal.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `Q${subtotal.toFixed(2)}`;
}

async function submitSale(e) {
    e.preventDefault();
    const errorEl = document.getElementById('sale-error');
    const successEl = document.getElementById('sale-success');
    if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
    if (successEl) { successEl.style.display = 'none'; successEl.textContent = ''; }

    const customerName = toSafeText(document.getElementById('customer_name')?.value);
    const phoneCountry = toSafeText(document.getElementById('phone_country')?.value);
    const phoneNumber = toSafeText(document.getElementById('phone_number')?.value);
    const email = toSafeText(document.getElementById('customer_email')?.value) || null;
    const address = toSafeText(document.getElementById('address')?.value);
    const city = toSafeText(document.getElementById('city')?.value);
    const notes = toSafeText(document.getElementById('order_notes')?.value) || null;
    const paymentMethod = toSafeText(document.getElementById('payment_method')?.value) || 'efectivo';

    if (!customerName || !phoneNumber || !address || !city) {
        if (errorEl) { errorEl.textContent = 'Por favor completa todos los campos obligatorios.'; errorEl.style.display = 'block'; }
        return;
    }

    const items = [];
    const rows = document.querySelectorAll('.sale-item');
    if (rows.length === 0) {
        if (errorEl) { errorEl.textContent = 'Agrega al menos un producto.'; errorEl.style.display = 'block'; }
        return;
    }

    for (const row of rows) {
        const sku = toSafeText(row.querySelector('.sale-variant')?.value);
        const qty = Number(row.querySelector('.sale-qty')?.value);
        if (!sku) {
            if (errorEl) { errorEl.textContent = 'Selecciona una variante para cada producto.'; errorEl.style.display = 'block'; }
            return;
        }
        if (!Number.isInteger(qty) || qty <= 0) {
            if (errorEl) { errorEl.textContent = 'La cantidad debe ser un número entero mayor a 0.'; errorEl.style.display = 'block'; }
            return;
        }
        items.push({ sku, quantity: qty });
    }

    const body = {
        customer_name: customerName,
        phone: `${phoneCountry}${phoneNumber.replace(/\s/g, '')}`,
        email,
        address,
        city,
        notes,
        payment_method: paymentMethod,
        items
    };

    try {
        const res = await apiFetch('/api/vendedor/orders', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            if (errorEl) { errorEl.textContent = errData.error || 'Error al registrar la venta.'; errorEl.style.display = 'block'; }
            return;
        }

        const result = await res.json();
        if (successEl) {
            successEl.innerHTML = `<i class="fas fa-check-circle"></i> Venta registrada con éxito. Pedido #<strong>${escapeHtml(result.orderId)}</strong> — Total: Q${toSafeMoney(result.total).toFixed(2)}`;
            successEl.style.display = 'block';
        }

        // Reset form
        document.getElementById('sale-form').reset();
        document.getElementById('sale-items').innerHTML = '';
        addSaleItem();
        updateSaleTotals();
        loadSellerOrders();
    } catch (err) {
        if (errorEl) { errorEl.textContent = err.message || 'Error de conexión.'; errorEl.style.display = 'block'; }
    }
}

// Tabs
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = toSafeText(document.getElementById('username')?.value);
            const password = toSafeText(document.getElementById('password')?.value);
            const errorEl = document.getElementById('login-error');

            if (!username || !password) {
                if (errorEl) { errorEl.textContent = 'Usuario y contraseña son requeridos.'; errorEl.style.display = 'block'; }
                return;
            }

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();
                if (!res.ok || !data.token) {
                    if (errorEl) { errorEl.textContent = data.error || 'Credenciales inválidas.'; errorEl.style.display = 'block'; }
                    return;
                }

                if (data.role !== 'vendedor' && data.role !== 'admin') {
                    if (errorEl) { errorEl.textContent = 'Acceso denegado. Solo para vendedores.'; errorEl.style.display = 'block'; }
                    return;
                }

                localStorage.setItem('seller_token', data.token);
                checkAuth();
            } catch {
                if (errorEl) { errorEl.textContent = 'Error de conexión con el servidor.'; errorEl.style.display = 'block'; }
            }
        });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('seller_token');
            checkAuth();
        });
    }

    // Tabs
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
            btn.classList.add('active');
            const pane = document.getElementById(target);
            if (pane) pane.classList.add('active');
        });
    });

    const addItemBtn = document.getElementById('btn-add-item');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', addSaleItem);
    }

    const saleForm = document.getElementById('sale-form');
    if (saleForm) {
        saleForm.addEventListener('submit', submitSale);
    }
});
