let adminOrders = [];
let adminProducts = [];
let activeProductsRequestId = 0;
let lastFilteredOrders = [];
let currentOrderModal = null;
let currentOrdersFilter = 'all';
let currentProductSettingsProduct = null;
let userEditedProductId = false;

function toSafeText(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).trim();
}

function escapeHtml(str) {
    const safe = toSafeText(str);
    return safe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function toSafeMoney(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isLikelyJwt(token) {
    const raw = toSafeText(token);
    return raw.split('.').length === 3;
}

function clearAdminSession(message) {
    localStorage.removeItem('admin_token');

    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginError = document.getElementById('login-error');

    if (loginView) {
        loginView.style.display = 'block';
    }
    if (dashboardView) {
        dashboardView.style.display = 'none';
    }
    if (loginError) {
        loginError.textContent = toSafeText(message) || 'Sesion expirada. Inicia sesion nuevamente.';
        loginError.style.display = 'block';
    }
}

let isRefreshing = false;
let refreshPromise = null;

async function refreshAuthToken() {
    const token = localStorage.getItem('admin_token');
    if (!token) return null;

    try {
        const res = await fetch('/api/refresh', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) return null;

        const data = await res.json();
        if (data.token) {
            localStorage.setItem('admin_token', data.token);
            return data.token;
        }
    } catch {
        // Refresh falló
    }
    return null;
}

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('admin_token');
    const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 || res.status === 403) {
        if (!isRefreshing) {
            isRefreshing = true;
            refreshPromise = refreshAuthToken();
        }

        const newToken = await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;

        if (newToken) {
            const retryHeaders = { ...(options.headers || {}), Authorization: `Bearer ${newToken}` };
            return fetch(url, { ...options, headers: retryHeaders });
        }

        clearAdminSession();
    }

    return res;
}

function safeImageUrl(value, fallback) {
    const fallbackUrl = fallback || '/assets/placeholder.svg';
    const raw = toSafeText(value);

    if (!raw) {
        return fallbackUrl;
    }

    if (raw.startsWith('/')) {
        return raw;
    }

    try {
        const url = new URL(raw, window.location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
            return url.href;
        }
    } catch (err) {
        // ignore
    }

    return fallbackUrl;
}

function normalizeStatus(value) {
    const status = toSafeText(value).toLowerCase();
    if (status === 'pendiente' || status === 'confirmado' || status === 'enviado' || status === 'cancelado') {
        return status;
    }
    return 'pendiente';
}

function formatOrderDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    try {
        return new Intl.DateTimeFormat('es-GT', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date);
    } catch {
        return date.toLocaleString();
    }
}

function updateOrderStats(orders) {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const sales = safeOrders.reduce((sum, order) => sum + toSafeMoney(order && order.total), 0);
    const salesEl = document.getElementById('stat-sales-total');
    if (salesEl) {
        salesEl.textContent = `Q${sales.toFixed(2)}`;
    }
}

function getFilteredOrders() {
    const queryInput = document.getElementById('search-order');
    const sortInput = document.getElementById('sort-orders');

    const query = toSafeText(queryInput ? queryInput.value : '').toLowerCase();
    const statusFilter = currentOrdersFilter.toLowerCase();
    const sortBy = toSafeText(sortInput ? sortInput.value : 'newest').toLowerCase();

    const filtered = adminOrders.filter((order) => {
        const id = toSafeText(order && order.id).toLowerCase();
        const customer = toSafeText(order && order.customer_name).toLowerCase();
        const phone = toSafeText(order && order.phone).toLowerCase();
        const city = toSafeText(order && order.city).toLowerCase();
        const status = normalizeStatus(order && order.status);

        const matchesQuery = !query
            || id.includes(query)
            || customer.includes(query)
            || phone.includes(query)
            || city.includes(query);
        const matchesStatus = statusFilter === 'all' || status === statusFilter;

        return matchesQuery && matchesStatus;
    });

    filtered.sort((left, right) => {
        const leftTime = new Date(left && left.created_at).getTime() || 0;
        const rightTime = new Date(right && right.created_at).getTime() || 0;
        const leftTotal = toSafeMoney(left && left.total);
        const rightTotal = toSafeMoney(right && right.total);
        const leftCustomer = toSafeText(left && left.customer_name).toLowerCase();
        const rightCustomer = toSafeText(right && right.customer_name).toLowerCase();

        if (sortBy === 'oldest') {
            return leftTime - rightTime;
        }
        if (sortBy === 'total_desc') {
            return rightTotal - leftTotal;
        }
        if (sortBy === 'total_asc') {
            return leftTotal - rightTotal;
        }
        if (sortBy === 'name_asc') {
            return leftCustomer.localeCompare(rightCustomer);
        }
        return rightTime - leftTime;
    });

    return filtered;
}

function buildOrderSummary(order) {
    const safeOrder = order || {};
    const safeItems = Array.isArray(safeOrder.items) ? safeOrder.items : [];
    const productRows = safeItems.map((item) => {
        const qty = Number(item && item.quantity);
        const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
        const name = toSafeText(item && item.product_name) || toSafeText(item && item.name) || toSafeText(item && item.product_id) || 'Producto';
        const size = (toSafeText(item && item.size) || 'Única').toUpperCase();
        const color = toSafeText(item && item.color_name);
        return color ? `- ${safeQty} x ${name} (${size}, ${color})` : `- ${safeQty} x ${name} (${size})`;
    });

    const isCubopago = toSafeText(safeOrder.payment_method).toLowerCase() === 'cubopago';
    const paymentStatus = toSafeText(safeOrder.payment_status).toLowerCase();

    const lines = [
        `Pedido #${toSafeText(safeOrder.id)}`,
        `Cliente: ${toSafeText(safeOrder.customer_name)}`,
        `Teléfono: ${toSafeText(safeOrder.phone)}`,
    ];

    if (safeOrder.email) lines.push(`Email: ${toSafeText(safeOrder.email)}`);
    lines.push(`Dirección: ${toSafeText(safeOrder.address)}, ${toSafeText(safeOrder.city)}`);
    if (safeOrder.notes) lines.push(`Notas: ${toSafeText(safeOrder.notes)}`);

    lines.push(
        `Método de Pago: ${isCubopago ? 'Tarjeta' : 'Efectivo'}`,
        `Estado del Pago: ${isCubopago ? (paymentStatus === 'pagado' ? 'Aprobado' : paymentStatus === 'fallido' ? 'Rechazado' : 'Pendiente') : 'Pendiente de cobro'}`,
    );

    if (safeOrder.cubopago_transaction_id) lines.push(`Transacción: ${toSafeText(safeOrder.cubopago_transaction_id)}`);
    if (safeOrder.cubopago_authorization) lines.push(`Autorización: ${toSafeText(safeOrder.cubopago_authorization)}`);

    lines.push(
        `Estado: ${normalizeStatus(safeOrder.status)}`,
        `Fecha: ${formatOrderDate(safeOrder.created_at)}`,
        `Total: Q${toSafeMoney(safeOrder.total).toFixed(2)}`,
        '',
        'Productos:',
        ...productRows
    );

    return lines.join('\n');
}

function makeOrderItemsList(items) {
    const wrapper = document.createElement('div');
    const safeItems = Array.isArray(items) ? items : [];

    if (safeItems.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'order-items-empty';
        empty.textContent = 'Sin detalle';
        wrapper.appendChild(empty);
        return wrapper;
    }

    const list = document.createElement('ul');
    list.className = 'order-items-list';

    safeItems.slice(0, 4).forEach((item) => {
        const li = document.createElement('li');
        const qty = Number(item && item.quantity);
        const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
        const name = toSafeText(item && item.product_name) || toSafeText(item && item.name) || toSafeText(item && item.product_id) || 'Producto';
        const size = (toSafeText(item && item.size) || 'Única').toUpperCase();
        const color = toSafeText(item && item.color_name);
        li.textContent = color
            ? `${safeQty} x ${name} (${size}, ${color})`
            : `${safeQty} x ${name} (${size})`;
        list.appendChild(li);
    });

    if (safeItems.length > 4) {
        const more = document.createElement('li');
        more.textContent = `+${safeItems.length - 4} productos más`;
        list.appendChild(more);
    }

    wrapper.appendChild(list);
    return wrapper;
}

function normalizeColorHex(value) {
    const raw = toSafeText(value).toLowerCase();
    if (!raw) {
        return '#d1a3a4';
    }

    const hexMatch = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!hexMatch) {
        return '#d1a3a4';
    }

    if (raw.length === 4) {
        return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
    }

    return raw;
}

function generateCompactSlug(name, sizes, colors) {
    const safeName = toSafeText(name)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 3) || 'PRD';

    const sizePart = toSafeText(sizes)
        .split(',')[0]
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 2) || 'UN';

    let colorPart = 'NA';
    if (Array.isArray(colors) && colors.length > 0) {
        colorPart = toSafeText(colors[0].name || colors[0])
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z]/g, '')
            .slice(0, 2);
    }
    if (!colorPart) colorPart = 'NA';

    const rand = Math.floor(100 + Math.random() * 900);
    return `${safeName}-${sizePart}-${colorPart}${rand}`;
}

function updateAutoGeneratedId() {
    const idInput = document.getElementById('prod-id');
    const nameInput = document.getElementById('prod-name');
    const sizesInput = document.getElementById('prod-sizes');
    if (!idInput || idInput.readOnly) return;

    if (!userEditedProductId) {
        const colors = collectColorRows();
        const slug = generateCompactSlug(
            nameInput ? nameInput.value : '',
            sizesInput ? sizesInput.value : '',
            colors
        );
        idInput.value = slug;
    }
    updateNewProductVariantStock();
}

function compressImage(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve) => {
        try {
            if (!file || !file.type || !file.type.startsWith('image/')) {
                return resolve(file || null);
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;

                        if (width > maxWidth) {
                            height = (maxWidth / width) * height;
                            width = maxWidth;
                        }

                        canvas.width = width;
                        canvas.height = height;

                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        canvas.toBlob((blob) => {
                            if (blob) {
                                const compressedFile = new File([blob], file.name, {
                                    type: 'image/jpeg',
                                    lastModified: Date.now()
                                });
                                resolve(compressedFile);
                            } else {
                                resolve(file);
                            }
                        }, 'image/jpeg', quality);
                    } catch (canvasErr) {
                        resolve(file);
                    }
                };
                img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
        } catch (syncErr) {
            resolve(file || null);
        }
    });
}

function normalizeColorsFromData(value) {
    if (!value) {
        return [];
    }

    let source = value;
    if (typeof value === 'string') {
        try {
            source = JSON.parse(value);
        } catch (err) {
            return [];
        }
    }

    if (!Array.isArray(source)) {
        return [];
    }

    const output = [];
    for (let i = 0; i < source.length; i += 1) {
        const item = source[i] || {};
        const name = toSafeText(item.name || item.label || item.value);
        const hex = normalizeColorHex(item.hex || item.color || item.code);

        if (!name && !hex) {
            continue;
        }

        output.push({
            name: name || `Color ${i + 1}`,
            hex
        });
    }

    return output;
}

function getColorListContainer() {
    return document.getElementById('prod-colors-list');
}

function createColorRow(color) {
    const resolved = color || {};
    const row = document.createElement('div');
    row.className = 'color-row';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'prod-color-hex';
    colorInput.value = normalizeColorHex(resolved.hex);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'prod-color-name';
    nameInput.placeholder = 'Nombre del color (ej: Rojo vino)';
    nameInput.value = toSafeText(resolved.name);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-outline';
    removeBtn.style.padding = '0.5rem 0.7rem';
    removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
    removeBtn.addEventListener('click', () => {
        const list = getColorListContainer();
        if (!list) {
            return;
        }

        row.remove();
        if (list.children.length === 0) {
            addColorRow();
        }
    });

    row.appendChild(colorInput);
    row.appendChild(nameInput);
    row.appendChild(removeBtn);

    return row;
}

function addColorRow(color) {
    const list = getColorListContainer();
    if (!list) {
        return;
    }

    list.appendChild(createColorRow(color));
}

function clearColorRows() {
    const list = getColorListContainer();
    if (!list) {
        return;
    }

    list.textContent = '';
}

function updateNewProductVariantStock() {
    const section = document.getElementById('prod-new-variant-stock-section');
    const tbody = document.getElementById('prod-new-variant-tbody');
    const summary = document.getElementById('prod-new-variant-summary');
    const placeholder = document.getElementById('prod-new-variant-placeholder');
    const tableWrap = document.getElementById('prod-new-variant-table-wrap');
    const sizesInput = document.getElementById('prod-sizes');
    const idInput = document.getElementById('prod-id');

    if (!section || !tbody) return;

    const sizesRaw = toSafeText(sizesInput ? sizesInput.value : '');
    const sizes = sizesRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const colors = collectColorRows();

    // Always show the section when creating a new product (id is not readOnly)
    const isEdit = idInput ? idInput.readOnly : true;
    if (isEdit) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    if (sizes.length === 0 || colors.length === 0) {
        if (placeholder) placeholder.style.display = 'block';
        if (tableWrap) tableWrap.style.display = 'none';
        tbody.textContent = '';
        if (summary) summary.textContent = '';
        return;
    }

    if (placeholder) placeholder.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'block';

    const productId = toSafeText(idInput ? idInput.value : '').toLowerCase().replace(/\s+/g, '-');
    const defaultStock = Number(document.getElementById('prod-default-stock') ? document.getElementById('prod-default-stock').value : 0) || 0;

    const existingValues = {};
    tbody.querySelectorAll('.new-variant-stock-input').forEach((input) => {
        const key = input.getAttribute('data-variant-key');
        existingValues[key] = input.value;
    });

    tbody.textContent = '';

    let totalStock = 0;
    let variantCount = 0;

    sizes.forEach((size) => {
        colors.forEach((color) => {
            const colorName = toSafeText(color.name).toLowerCase().replace(/\s+/g, '-');
            const sku = `${productId}-${colorName}-${size}`;
            const key = `${size}__${colorName}`;
            const previousValue = existingValues[key] !== undefined ? existingValues[key] : String(defaultStock);
            const stockVal = Number(previousValue) || 0;

            variantCount += 1;
            totalStock += stockVal;

            const tr = document.createElement('tr');

            const tdVariant = document.createElement('td');
            tdVariant.innerHTML = `<span style="background:#e8f4fd;padding:0.15rem 0.5rem;border-radius:4px;font-size:0.8rem;font-weight:600;">${size.toUpperCase()}</span>`;

            const tdColor = document.createElement('td');
            const colorDot = document.createElement('span');
            colorDot.className = 'color-dot';
            colorDot.style.background = normalizeColorHex(color.hex);
            tdColor.appendChild(colorDot);
            tdColor.appendChild(document.createTextNode(` ${toSafeText(color.name)}`));

            const tdStock = document.createElement('td');
            const stockInput = document.createElement('input');
            stockInput.type = 'number';
            stockInput.min = '0';
            stockInput.step = '1';
            stockInput.value = previousValue;
            stockInput.className = 'new-variant-stock-input';
            stockInput.setAttribute('data-variant-key', key);
            stockInput.setAttribute('data-sku', sku);
            stockInput.setAttribute('data-size', size);
            stockInput.setAttribute('data-color-name', colorName);
            stockInput.style.width = '70px';
            stockInput.style.padding = '0.35rem';
            stockInput.style.fontSize = '0.9rem';
            stockInput.style.textAlign = 'center';
            stockInput.addEventListener('input', updateNewVariantSummary);
            tdStock.appendChild(stockInput);

            tr.appendChild(tdVariant);
            tr.appendChild(tdColor);
            tr.appendChild(tdStock);
            tbody.appendChild(tr);
        });
    });

    if (summary) {
        summary.textContent = `${variantCount} variante${variantCount !== 1 ? 's' : ''} — Stock total: ${totalStock}`;
    }
}

function updateNewVariantSummary() {
    const summary = document.getElementById('prod-new-variant-summary');
    if (!summary) return;

    const inputs = document.querySelectorAll('.new-variant-stock-input');
    let totalStock = 0;
    inputs.forEach((input) => {
        totalStock += Number(input.value) || 0;
    });
    summary.textContent = `${inputs.length} variante${inputs.length !== 1 ? 's' : ''} — Stock total: ${totalStock}`;
}

function applyDefaultStockToNewVariants() {
    const defaultStock = Number(document.getElementById('prod-default-stock') ? document.getElementById('prod-default-stock').value : 0) || 0;
    document.querySelectorAll('.new-variant-stock-input').forEach((input) => {
        input.value = String(defaultStock);
    });
    updateNewVariantSummary();
}

function collectNewVariantStockData() {
    const data = [];
    document.querySelectorAll('.new-variant-stock-input').forEach((input) => {
        const sku = input.getAttribute('data-sku');
        const size = input.getAttribute('data-size');
        const colorName = input.getAttribute('data-color-name');
        const stock = Number(input.value) || 0;
        if (sku) {
            data.push({ sku, size, color_name: colorName, quantity: stock });
        }
    });
    return data;
}

function collectColorRows() {
    const list = getColorListContainer();
    if (!list) {
        return [];
    }

    const rows = list.querySelectorAll('.color-row');
    const colors = [];

    rows.forEach((row, index) => {
        const nameInput = row.querySelector('.prod-color-name');
        const hexInput = row.querySelector('.prod-color-hex');

        const name = toSafeText(nameInput ? nameInput.value : '');
        const hex = normalizeColorHex(hexInput ? hexInput.value : '');

        if (!name && !hex) {
            return;
        }

        colors.push({
            name: name || `Color ${index + 1}`,
            hex
        });
    });

    return colors;
}

function updateCategorySuggestions() {
    const datalist = document.getElementById('category-suggestions');
    if (!datalist) {
        return;
    }

    const seen = new Set();
    const categories = [];

    adminProducts.forEach((product) => {
        const category = toSafeText(product && product.category).toLowerCase();
        if (!category || seen.has(category)) {
            return;
        }

        seen.add(category);
        categories.push(category);
    });

    categories.sort((a, b) => a.localeCompare(b));

    datalist.textContent = '';
    categories.forEach((category) => {
        const option = document.createElement('option');
        option.value = category;
        datalist.appendChild(option);
    });
}

function getAdminUser() {
    try {
        const token = localStorage.getItem('admin_token');
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch {
        return null;
    }
}

function checkAuth() {
    const token = localStorage.getItem('admin_token');
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginError = document.getElementById('login-error');

    if (token && isLikelyJwt(token)) {
        const user = getAdminUser();
        const allowedRoles = new Set(['admin', 'operador_pedidos', 'operador_stock']);
        if (user && allowedRoles.has(user.role)) {
            if (loginView) loginView.style.display = 'none';
            if (dashboardView) dashboardView.style.display = 'block';
            const nameEl = document.getElementById('admin-name');
            const nameSidebarEl = document.getElementById('admin-name-sidebar');
            const displayName = user.name || user.sub || 'Admin';
            if (nameEl) nameEl.textContent = displayName;
            if (nameSidebarEl) nameSidebarEl.textContent = displayName;
            loadDashboard();
            loadNotifications();
            return;
        }
        // Si es vendedor, no permitir acceso al admin
        if (user && user.role === 'vendedor') {
            localStorage.removeItem('admin_token');
            if (loginError) {
                loginError.textContent = 'Acceso denegado. Los vendedores deben usar el panel de vendedor.';
                loginError.style.display = 'block';
            }
            if (loginView) loginView.style.display = 'grid';
            if (dashboardView) dashboardView.style.display = 'none';
            return;
        }
    }

    if (token && !isLikelyJwt(token)) {
        localStorage.removeItem('admin_token');
    }

    if (loginView) loginView.style.display = 'grid';
    if (dashboardView) dashboardView.style.display = 'none';
    if (loginError) loginError.style.display = 'none';

    const username = document.getElementById('username');
    const password = document.getElementById('password');
    if (username) username.value = '';
    if (password) password.value = '';
}

async function loadOrders() {
    const token = localStorage.getItem('admin_token');

    try {
        const res = await apiFetch('/api/orders');

        const data = await res.json();
        adminOrders = Array.isArray(data) ? data : [];
        filterOrders();
    } catch (err) {
        console.error('Error load orders', err);
    }
}

function setOrdersTab(status) {
    currentOrdersFilter = status || 'all';

    document.querySelectorAll('.order-tab-btn').forEach((btn) => {
        if (btn.dataset.status === currentOrdersFilter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const tableWrap = document.getElementById('orders-table-wrap');
    if (tableWrap) {
        tableWrap.classList.add('transitioning');
        setTimeout(() => {
            filterOrders();
            requestAnimationFrame(() => {
                setTimeout(() => {
                    tableWrap.classList.remove('transitioning');
                }, 30);
            });
        }, 180);
    } else {
        filterOrders();
    }
}

function filterOrders() {
    const filtered = getFilteredOrders();
    lastFilteredOrders = filtered;
    updateOrderStats(filtered);
    renderOrdersTable(filtered);
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('orders-tbody');
    const cardsContainer = document.getElementById('orders-cards');
    if (!tbody && !cardsContainer) {
        return;
    }
    if (tbody) tbody.textContent = '';
    if (cardsContainer) cardsContainer.textContent = '';

    if (!Array.isArray(orders) || orders.length === 0) {
        if (tbody) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 11;
            td.style.textAlign = 'center';
            td.style.padding = '1.5rem';
            td.style.color = '#888';
            td.textContent = 'No hay pedidos con los filtros actuales.';
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        if (cardsContainer) {
            cardsContainer.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8;">No hay pedidos con los filtros actuales.</div>';
        }
        return;
    }

    orders.forEach((order) => {
        const normalizedStatus = normalizeStatus(order && order.status);
        const paymentMethod = toSafeText(order && order.payment_method).toLowerCase();
        const paymentStatus = toSafeText(order && order.payment_status).toLowerCase();
        const isCubopago = paymentMethod === 'cubopago';
        const isPaid = paymentStatus === 'pagado';
        const isFailed = paymentStatus === 'fallido';
        const orderId = toSafeText(order && order.id);
        const customerName = toSafeText(order && order.customer_name) || 'Sin nombre';
        const phone = toSafeText(order && order.phone);
        const email = toSafeText(order && order.email);
        const address = toSafeText(order && order.address);
        const city = toSafeText(order && order.city);
        const total = `Q${toSafeMoney(order && order.total).toFixed(2)}`;
        const source = toSafeText(order && order.source).toLowerCase();
        const createdBy = toSafeText(order && order.created_by) || '-';
        const dateStr = formatOrderDate(order && order.created_at);
        const trackingNum = toSafeText(order && order.tracking_number);

        // Desktop table row
        if (tbody) {
            const tr = document.createElement('tr');

            const tdId = document.createElement('td');
            tdId.textContent = `#${orderId}`;

            const tdDate = document.createElement('td');
            const date = document.createElement('span');
            date.className = 'order-date';
            date.textContent = dateStr;
            tdDate.appendChild(date);

            const tdName = document.createElement('td');
            const strongName = document.createElement('strong');
            strongName.textContent = customerName;
            tdName.appendChild(strongName);

            const tdContact = document.createElement('td');
            tdContact.appendChild(document.createTextNode(phone));
            if (email) {
                tdContact.appendChild(document.createElement('br'));
                const emailSmall = document.createElement('small');
                emailSmall.textContent = email;
                emailSmall.style.color = '#666';
                tdContact.appendChild(emailSmall);
            }

            const tdAddress = document.createElement('td');
            tdAddress.appendChild(document.createTextNode(address));
            tdAddress.appendChild(document.createElement('br'));
            const citySmall = document.createElement('small');
            citySmall.textContent = city;
            citySmall.style.color = '#666';
            tdAddress.appendChild(citySmall);

            const tdTotal = document.createElement('td');
            const strongTotal = document.createElement('strong');
            strongTotal.textContent = total;
            tdTotal.appendChild(strongTotal);

            const tdPayment = document.createElement('td');
            const paymentWrap = document.createElement('div');
            paymentWrap.style.display = 'flex';
            paymentWrap.style.flexDirection = 'column';
            paymentWrap.style.gap = '0.3rem';
            paymentWrap.style.alignItems = 'center';

            const methodBadge = document.createElement('span');
            methodBadge.style.fontSize = '0.7rem';
            methodBadge.style.padding = '2px 8px';
            methodBadge.style.borderRadius = '12px';
            methodBadge.style.fontWeight = '600';
            if (isCubopago) {
                methodBadge.style.background = '#e3f2fd';
                methodBadge.style.color = '#1976d2';
                methodBadge.textContent = 'Tarjeta';
            } else {
                methodBadge.style.background = '#e8f5e9';
                methodBadge.style.color = '#388e3c';
                methodBadge.textContent = 'Efectivo';
            }
            paymentWrap.appendChild(methodBadge);

            if (isCubopago) {
                const payStatusBadge = document.createElement('span');
                payStatusBadge.style.fontSize = '0.7rem';
                payStatusBadge.style.padding = '2px 8px';
                payStatusBadge.style.borderRadius = '12px';
                payStatusBadge.style.fontWeight = '600';
                if (isPaid) {
                    payStatusBadge.style.background = '#e8f5e9';
                    payStatusBadge.style.color = '#388e3c';
                    payStatusBadge.textContent = 'Aprobado';
                } else if (isFailed) {
                    payStatusBadge.style.background = '#ffebee';
                    payStatusBadge.style.color = '#c62828';
                    payStatusBadge.textContent = 'Rechazado';
                } else {
                    payStatusBadge.style.background = '#fff3e0';
                    payStatusBadge.style.color = '#ef6c00';
                    payStatusBadge.textContent = 'Pendiente';
                }
                paymentWrap.appendChild(payStatusBadge);
            }
            tdPayment.appendChild(paymentWrap);

            const tdStatus = document.createElement('td');
            const statusBadge = document.createElement('span');
            statusBadge.className = `status-badge status-${normalizedStatus}`;
            statusBadge.textContent = normalizedStatus.toUpperCase();
            tdStatus.appendChild(statusBadge);

            const tdSource = document.createElement('td');
            const sourceBadge = document.createElement('span');
            sourceBadge.className = 'source-badge';
            sourceBadge.style.padding = '0.25rem 0.5rem';
            sourceBadge.style.borderRadius = '4px';
            sourceBadge.style.fontSize = '0.65rem';
            sourceBadge.style.fontWeight = '600';
            sourceBadge.style.textTransform = 'uppercase';
            sourceBadge.style.letterSpacing = '0.5px';
            if (source === 'vendedor') {
                sourceBadge.style.background = '#e6fffa';
                sourceBadge.style.color = '#2c7a7b';
                sourceBadge.textContent = 'Vendedor';
            } else if (source === 'live') {
                sourceBadge.style.background = '#f3e8ff';
                sourceBadge.style.color = '#7c3aed';
                sourceBadge.textContent = 'Live';
            } else {
                sourceBadge.style.background = '#e8f4fd';
                sourceBadge.style.color = '#2b6cb0';
                sourceBadge.textContent = 'Catalogo';
            }
            tdSource.appendChild(sourceBadge);

            const tdCreatedBy = document.createElement('td');
            tdCreatedBy.textContent = createdBy;
            tdCreatedBy.style.fontSize = '0.8rem';
            tdCreatedBy.style.color = '#64748b';

            const tdAction = document.createElement('td');
            const actionWrap = document.createElement('div');
            actionWrap.className = 'order-actions';

            const viewBtn = document.createElement('button');
            viewBtn.type = 'button';
            viewBtn.className = 'btn btn-outline';
            viewBtn.style.padding = '0.4rem 0.55rem';
            viewBtn.textContent = 'Ver detalle';
            viewBtn.addEventListener('click', () => openOrderModal(orderId));
            actionWrap.appendChild(viewBtn);

            const validTransitions = {
                pendiente: ['confirmado', 'cancelado'],
                confirmado: ['enviado'],
                enviado: [],
                cancelado: []
            };
            const transitions = validTransitions[normalizedStatus] || [];

            if (normalizedStatus === 'pendiente') {
                const confirmBtn = document.createElement('button');
                confirmBtn.type = 'button';
                confirmBtn.className = 'btn btn-outline';
                confirmBtn.style.padding = '0.4rem 0.55rem';
                confirmBtn.textContent = 'Confirmar';
                confirmBtn.addEventListener('click', () => updateOrderStatus(orderId, 'confirmado'));
                actionWrap.appendChild(confirmBtn);

                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'btn btn-outline';
                cancelBtn.style.padding = '0.4rem 0.55rem';
                cancelBtn.style.border = '1px dashed #d63031';
                cancelBtn.style.color = '#d63031';
                cancelBtn.textContent = 'Cancelar';
                cancelBtn.addEventListener('click', () => {
                    if (window.confirm('¿Estás seguro de cancelar este pedido? Esta acción no se puede deshacer.')) {
                        updateOrderStatus(orderId, 'cancelado');
                    }
                });
                actionWrap.appendChild(cancelBtn);
            }

            if (normalizedStatus === 'confirmado') {
                const guideBtn = document.createElement('button');
                guideBtn.type = 'button';
                guideBtn.className = 'btn btn-outline';
                guideBtn.style.padding = '0.4rem 0.55rem';
                guideBtn.style.borderStyle = 'dashed';
                guideBtn.style.opacity = '0.85';
                guideBtn.textContent = 'Generar guía';
                guideBtn.addEventListener('click', () => showPlaceholderModal('Esta función está pendiente de implementación.'));
                actionWrap.appendChild(guideBtn);

                const shipBtn = document.createElement('button');
                shipBtn.type = 'button';
                shipBtn.className = 'btn btn-outline';
                shipBtn.style.padding = '0.4rem 0.55rem';
                shipBtn.textContent = 'Marcar enviado';
                shipBtn.addEventListener('click', () => openTrackingModal(orderId));
                actionWrap.appendChild(shipBtn);
            }

            if (normalizedStatus === 'enviado') {
                const trackBtn = document.createElement('button');
                trackBtn.type = 'button';
                trackBtn.className = 'btn btn-outline';
                trackBtn.style.padding = '0.4rem 0.55rem';
                trackBtn.textContent = 'Rastrear pedido';
                if (trackingNum) {
                    trackBtn.addEventListener('click', () => {
                        window.open(`https://rastreo.forzadelivery.com/${encodeURIComponent(trackingNum)}`, '_blank');
                    });
                } else {
                    trackBtn.disabled = true;
                    trackBtn.title = 'No hay número de guía registrado';
                    trackBtn.style.opacity = '0.5';
                    trackBtn.style.cursor = 'not-allowed';
                }
                actionWrap.appendChild(trackBtn);
            }

            const select = document.createElement('select');
            select.style.padding = '0.35rem';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Cambiar Estado';
            select.appendChild(placeholder);
            ['pendiente', 'confirmado', 'enviado', 'cancelado'].forEach((status) => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
                if (normalizedStatus === status) option.disabled = true;
                if (!transitions.includes(status)) option.disabled = true;
                select.appendChild(option);
            });
            select.addEventListener('change', (event) => {
                const newStatus = event.target.value;
                if (newStatus === 'cancelado') {
                    if (window.confirm('¿Estás seguro de cancelar este pedido? Esta acción no se puede deshacer.')) {
                        updateOrderStatus(orderId, newStatus);
                    } else { select.value = ''; }
                } else if (newStatus === 'enviado') {
                    openTrackingModal(orderId); select.value = '';
                } else {
                    updateOrderStatus(orderId, newStatus);
                }
            });
            actionWrap.appendChild(select);
            tdAction.appendChild(actionWrap);

            tr.appendChild(tdId);
            tr.appendChild(tdDate);
            tr.appendChild(tdName);
            tr.appendChild(tdContact);
            tr.appendChild(tdAddress);
            tr.appendChild(tdTotal);
            tr.appendChild(tdPayment);
            tr.appendChild(tdStatus);
            tr.appendChild(tdSource);
            tr.appendChild(tdCreatedBy);
            tr.appendChild(tdAction);
            tbody.appendChild(tr);
        }

        // Mobile card
        if (cardsContainer) {
            const card = document.createElement('div');
            card.className = 'mobile-card';

            let paymentBadges = '';
            if (isCubopago) {
                let payStatusColor = '#ef6c00', payStatusBg = '#fff3e0', payStatusText = 'Pendiente';
                if (isPaid) { payStatusColor = '#388e3c'; payStatusBg = '#e8f5e9'; payStatusText = 'Aprobado'; }
                else if (isFailed) { payStatusColor = '#c62828'; payStatusBg = '#ffebee'; payStatusText = 'Rechazado'; }
                paymentBadges = `<span class="status-badge" style="background:#e3f2fd;color:#1976d2;font-size:0.7rem;">Tarjeta</span><span class="status-badge" style="background:${payStatusBg};color:${payStatusColor};font-size:0.7rem;">${payStatusText}</span>`;
            } else {
                paymentBadges = `<span class="status-badge" style="background:#e8f5e9;color:#388e3c;font-size:0.7rem;">Efectivo</span>`;
            }

            const sourceBadgeHtml = source === 'vendedor'
                ? `<span class="source-badge" style="background:#e6fffa;color:#2c7a7b;">Vendedor</span>`
                : source === 'live'
                ? `<span class="source-badge" style="background:#f3e8ff;color:#7c3aed;">Live</span>`
                : `<span class="source-badge" style="background:#e8f4fd;color:#2b6cb0;">Catalogo</span>`;

            card.innerHTML = `
                <div class="mobile-card-header">
                    <div>
                        <div class="mobile-card-order-id">#${escapeHtml(orderId)}</div>
                        <div style="font-size:0.8rem;color:#64748b;margin-top:0.15rem;">${escapeHtml(dateStr)}</div>
                    </div>
                    <span class="status-badge status-${normalizedStatus}">${normalizedStatus.toUpperCase()}</span>
                </div>
                <div class="mobile-card-title">${escapeHtml(customerName)}</div>
                <div class="mobile-card-meta">
                    ${phone ? `<span><i class="fas fa-phone" style="font-size:0.75rem;"></i> ${escapeHtml(phone)}</span>` : ''}
                    ${city ? `<span><i class="fas fa-map-marker-alt" style="font-size:0.75rem;"></i> ${escapeHtml(city)}</span>` : ''}
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Total</span>
                    <span class="mobile-card-value" style="color:var(--secondary-color);">${total}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Pago</span>
                    <span class="mobile-card-value">${paymentBadges}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Origen</span>
                    <span class="mobile-card-value">${sourceBadgeHtml} ${escapeHtml(createdBy)}</span>
                </div>
                <div class="mobile-card-actions" id="order-card-actions-${orderId}"></div>
            `;

            const actionWrap = card.querySelector(`#order-card-actions-${orderId}`);

            const viewBtn = document.createElement('button');
            viewBtn.className = 'btn btn-outline';
            viewBtn.type = 'button';
            viewBtn.innerHTML = '<i class="fas fa-eye"></i> Ver';
            viewBtn.addEventListener('click', () => openOrderModal(orderId));
            actionWrap.appendChild(viewBtn);

            if (normalizedStatus === 'pendiente') {
                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'btn btn-primary';
                confirmBtn.type = 'button';
                confirmBtn.innerHTML = '<i class="fas fa-check"></i> Confirmar';
                confirmBtn.addEventListener('click', () => updateOrderStatus(orderId, 'confirmado'));
                actionWrap.appendChild(confirmBtn);

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'btn btn-outline';
                cancelBtn.type = 'button';
                cancelBtn.style.color = '#d63031';
                cancelBtn.style.borderColor = '#fecaca';
                cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancelar';
                cancelBtn.addEventListener('click', () => {
                    if (window.confirm('¿Estás seguro de cancelar este pedido? Esta acción no se puede deshacer.')) {
                        updateOrderStatus(orderId, 'cancelado');
                    }
                });
                actionWrap.appendChild(cancelBtn);
            }

            if (normalizedStatus === 'confirmado') {
                const shipBtn = document.createElement('button');
                shipBtn.className = 'btn btn-primary';
                shipBtn.type = 'button';
                shipBtn.innerHTML = '<i class="fas fa-truck"></i> Enviar';
                shipBtn.addEventListener('click', () => openTrackingModal(orderId));
                actionWrap.appendChild(shipBtn);
            }

            if (normalizedStatus === 'enviado' && trackingNum) {
                const trackBtn = document.createElement('button');
                trackBtn.className = 'btn btn-outline';
                trackBtn.type = 'button';
                trackBtn.innerHTML = '<i class="fas fa-map-pin"></i> Rastrear';
                trackBtn.addEventListener('click', () => {
                    window.open(`https://rastreo.forzadelivery.com/${encodeURIComponent(trackingNum)}`, '_blank');
                });
                actionWrap.appendChild(trackBtn);
            }

            cardsContainer.appendChild(card);
        }
    });
}

async function updateOrderStatus(id, status, trackingNumber) {
    if (!status) {
        return;
    }

    const token = localStorage.getItem('admin_token');
    const body = { status };
    if (trackingNumber) {
        body.tracking_number = trackingNumber;
    }

    try {
        const res = await fetch(`/api/orders/${encodeURIComponent(toSafeText(id))}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                clearAdminSession();
                return;
            }
            const errData = await res.json().catch(() => ({}));
            alert(errData.error || 'Error al actualizar estado');
            return;
        }

        loadOrders();
    } catch (err) {
        alert('Error conectando con servidor');
    }
}

function openOrderModal(orderId) {
    const safeId = toSafeText(orderId);
    const order = adminOrders.find((item) => toSafeText(item && item.id) === safeId);
    if (!order) {
        return;
    }

    currentOrderModal = order;

    const customer = document.getElementById('order-modal-customer');
    const status = document.getElementById('order-modal-status');
    const phone = document.getElementById('order-modal-phone');
    const email = document.getElementById('order-modal-email');
    const emailRow = document.getElementById('order-modal-email-row');
    const notes = document.getElementById('order-modal-notes');
    const notesRow = document.getElementById('order-modal-notes-row');
    const date = document.getElementById('order-modal-date');
    const address = document.getElementById('order-modal-address');
    const total = document.getElementById('order-modal-total');
    const items = document.getElementById('order-modal-items');
    const title = document.getElementById('order-modal-title');
    const modal = document.getElementById('order-modal');
    const paymentMethod = document.getElementById('order-modal-payment-method');
    const paymentStatus = document.getElementById('order-modal-payment-status');
    const transaction = document.getElementById('order-modal-transaction');
    const txRow = document.getElementById('order-modal-tx-row');
    const auth = document.getElementById('order-modal-auth');
    const authRow = document.getElementById('order-modal-auth-row');

    if (title) {
        title.textContent = `Pedido #${safeId}`;
    }
    if (customer) {
        customer.textContent = toSafeText(order.customer_name) || '-';
    }
    if (status) {
        status.textContent = normalizeStatus(order.status).toUpperCase();
    }
    if (phone) {
        phone.textContent = toSafeText(order.phone) || '-';
    }
    if (email) {
        if (order.email) {
            email.textContent = toSafeText(order.email);
            if (emailRow) emailRow.style.display = 'block';
        } else {
            if (emailRow) emailRow.style.display = 'none';
        }
    }
    if (notes) {
        if (order.notes) {
            notes.textContent = toSafeText(order.notes);
            if (notesRow) notesRow.style.display = 'block';
        } else {
            if (notesRow) notesRow.style.display = 'none';
        }
    }
    if (date) {
        date.textContent = formatOrderDate(order.created_at);
    }
    if (address) {
        address.textContent = `${toSafeText(order.address)}, ${toSafeText(order.city)}`.replace(/^,\s*/, '') || '-';
    }
    if (total) {
        total.textContent = `Q${toSafeMoney(order.total).toFixed(2)}`;
    }

    // Pago
    const isCubopago = toSafeText(order.payment_method).toLowerCase() === 'cubopago';
    if (paymentMethod) {
        paymentMethod.textContent = isCubopago ? 'Tarjeta de Crédito/Débito' : 'Pago contra entrega (Efectivo)';
    }
    if (paymentStatus) {
        const ps = toSafeText(order.payment_status).toLowerCase();
        if (isCubopago) {
            if (ps === 'pagado') {
                paymentStatus.innerHTML = '<span style="color: #388e3c; font-weight: 600;">✓ Aprobado</span>';
            } else if (ps === 'fallido') {
                paymentStatus.innerHTML = '<span style="color: #c62828; font-weight: 600;">✗ Rechazado</span>';
            } else {
                paymentStatus.innerHTML = '<span style="color: #ef6c00; font-weight: 600;">⏳ Pendiente</span>';
            }
        } else {
            paymentStatus.textContent = 'Pendiente de cobro al entregar';
        }
    }
    if (transaction && txRow) {
        if (order.cubopago_transaction_id) {
            transaction.textContent = toSafeText(order.cubopago_transaction_id);
            txRow.style.display = 'block';
        } else {
            txRow.style.display = 'none';
        }
    }
    if (auth && authRow) {
        if (order.cubopago_authorization) {
            auth.textContent = toSafeText(order.cubopago_authorization);
            authRow.style.display = 'block';
        } else {
            authRow.style.display = 'none';
        }
    }

    const tracking = document.getElementById('order-modal-tracking');
    const trackingRow = document.getElementById('order-modal-tracking-row');
    if (tracking && trackingRow) {
        if (order.tracking_number) {
            tracking.textContent = toSafeText(order.tracking_number);
            trackingRow.style.display = 'block';
        } else {
            trackingRow.style.display = 'none';
        }
    }

    if (items) {
        items.textContent = '';
        const safeItems = Array.isArray(order.items) ? order.items : [];
        safeItems.forEach((item) => {
            const li = document.createElement('li');
            const qty = Number(item && item.quantity);
            const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
            const name = toSafeText(item && item.product_name) || toSafeText(item && item.name) || toSafeText(item && item.product_id) || 'Producto';
            const size = (toSafeText(item && item.size) || 'Única').toUpperCase();
            const color = toSafeText(item && item.color_name);
            li.textContent = color
                ? `${safeQty} x ${name} (${size}, ${color})`
                : `${safeQty} x ${name} (${size})`;
            items.appendChild(li);
        });
    }

    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeOrderModal() {
    const modal = document.getElementById('order-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function openTrackingModal(orderId) {
    const modal = document.getElementById('tracking-modal');
    const input = document.getElementById('tracking-number-input');
    const hidden = document.getElementById('tracking-modal-order-id');
    const error = document.getElementById('tracking-modal-error');

    if (hidden) hidden.value = toSafeText(orderId);
    if (input) input.value = '';
    if (error) error.style.display = 'none';
    if (modal) modal.style.display = 'flex';
    if (input) input.focus();
}

function closeTrackingModal() {
    const modal = document.getElementById('tracking-modal');
    if (modal) modal.style.display = 'none';
}

async function submitTracking() {
    const input = document.getElementById('tracking-number-input');
    const hidden = document.getElementById('tracking-modal-order-id');
    const error = document.getElementById('tracking-modal-error');

    const trackingNumber = input ? input.value.trim() : '';
    const orderId = hidden ? hidden.value : '';

    if (!trackingNumber) {
        if (error) {
            error.textContent = 'Por favor ingresa el número de guía.';
            error.style.display = 'block';
        }
        return;
    }

    closeTrackingModal();
    await updateOrderStatus(orderId, 'enviado', trackingNumber);
}

function showPlaceholderModal(message) {
    const modal = document.getElementById('placeholder-modal');
    const msgEl = document.getElementById('placeholder-modal-message');
    if (msgEl) {
        msgEl.textContent = message || 'Esta función está pendiente de implementación.';
    }
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closePlaceholderModal() {
    const modal = document.getElementById('placeholder-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function copyCurrentOrderSummary() {
    if (!currentOrderModal) {
        return;
    }

    const summary = buildOrderSummary(currentOrderModal);

    try {
        await navigator.clipboard.writeText(summary);
        alert('Resumen copiado al portapapeles');
    } catch {
        alert('No se pudo copiar automáticamente. Intenta nuevamente.');
    }
}

function csvValue(value) {
    const raw = toSafeText(value).replace(/"/g, '""');
    return `"${raw}"`;
}

function exportOrdersCsv() {
    const orders = lastFilteredOrders.length > 0 || adminOrders.length === 0 ? lastFilteredOrders : getFilteredOrders();
    if (!orders || orders.length === 0) {
        alert('No hay pedidos para exportar con los filtros actuales.');
        return;
    }

    const headers = [
        'id',
        'fecha',
        'cliente',
        'telefono',
        'email',
        'direccion',
        'ciudad',
        'notas',
        'estado',
        'metodo_pago',
        'estado_pago',
        'transaccion',
        'autorizacion',
        'total',
        'productos'
    ];

    const rows = orders.map((order) => {
        const safeItems = Array.isArray(order && order.items) ? order.items : [];
        const itemSummary = safeItems.map((item) => {
            const qty = Number(item && item.quantity);
            const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
            const name = toSafeText(item && item.product_name) || toSafeText(item && item.name) || toSafeText(item && item.product_id) || 'Producto';
            const size = (toSafeText(item && item.size) || 'Única').toUpperCase();
            const color = toSafeText(item && item.color_name);
            return color
                ? `${safeQty} x ${name} (${size}, ${color})`
                : `${safeQty} x ${name} (${size})`;
        }).join(' | ');

        return [
            toSafeText(order && order.id),
            formatOrderDate(order && order.created_at),
            toSafeText(order && order.customer_name),
            toSafeText(order && order.phone),
            toSafeText(order && order.email),
            toSafeText(order && order.address),
            toSafeText(order && order.city),
            toSafeText(order && order.notes),
            normalizeStatus(order && order.status),
            toSafeText(order && order.payment_method),
            toSafeText(order && order.payment_status),
            toSafeText(order && order.cubopago_transaction_id),
            toSafeText(order && order.cubopago_authorization),
            toSafeMoney(order && order.total).toFixed(2),
            itemSummary
        ].map(csvValue).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pedidos_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function loadProductsAdmin() {
    const requestId = ++activeProductsRequestId;
    try {
        const res = await apiFetch('/api/products');
        const data = await res.json();

        if (requestId !== activeProductsRequestId) {
            return;
        }

        adminProducts = Array.isArray(data) ? data : [];
        updateCategorySuggestions();
        sortAdminProducts();
    } catch (err) {
        console.error('Error load products', err);
    }
}

function sortAdminProducts() {
    const select = document.getElementById('sort-products');
    const sortVal = select ? select.value : 'newest';
    const sorted = adminProducts.slice();

    if (sortVal === 'price_asc') {
        sorted.sort((a, b) => toSafeMoney(a && a.price) - toSafeMoney(b && b.price));
    }
    if (sortVal === 'price_desc') {
        sorted.sort((a, b) => toSafeMoney(b && b.price) - toSafeMoney(a && a.price));
    }
    if (sortVal === 'name_asc') {
        sorted.sort((a, b) => toSafeText(a && a.name).localeCompare(toSafeText(b && b.name)));
    }
    if (sortVal === 'newest') {
        sorted.reverse();
    }

    renderProductsTable(sorted);
}

function createColorPreview(colors) {
    const wrapper = document.createElement('div');
    wrapper.className = 'color-preview';

    const normalized = normalizeColorsFromData(colors);
    if (normalized.length === 0) {
        const none = document.createElement('span');
        none.style.color = '#999';
        none.textContent = '-';
        wrapper.appendChild(none);
        return wrapper;
    }

    normalized.slice(0, 6).forEach((color) => {
        const dot = document.createElement('span');
        dot.className = 'color-dot';
        dot.style.background = normalizeColorHex(color.hex);
        dot.title = toSafeText(color.name);
        wrapper.appendChild(dot);
    });

    return wrapper;
}

function renderProductsTable(products) {
    const tbody = document.getElementById('products-tbody');
    const cardsContainer = document.getElementById('products-cards');
    if (!tbody && !cardsContainer) {
        return;
    }
    if (tbody) tbody.textContent = '';
    if (cardsContainer) cardsContainer.textContent = '';

    products.forEach((product) => {
        const imgUrl = safeImageUrl(product && product.images && product.images[0], '/assets/placeholder.jpg');
        const name = toSafeText(product && product.name) || 'Sin nombre';
        const category = (toSafeText(product && product.category) || 'OTROS').toUpperCase();
        const isOnSale = !!(product && product.sale_enabled);
        const hasBundle2x = !!(product && product.bundle_2x_enabled);
        const priceText = isOnSale && product.sale_price > 0
            ? `<span class="sale-original">Q${toSafeMoney(product.original_price).toFixed(2)}</span>Q${toSafeMoney(product.price).toFixed(2)}`
            : `Q${toSafeMoney(product && product.price).toFixed(2)}`;
        const totalStock = Number(product && product.total_stock) || 0;
        let stockLabel = 'OK';
        let stockBg = '#e6fffa';
        let stockColor = '#2c7a7b';
        if (totalStock === 0) {
            stockLabel = 'AGOTADO'; stockBg = '#ffe5e5'; stockColor = '#d63031';
        } else if (totalStock <= 5) {
            stockLabel = 'BAJO'; stockBg = '#fff8e6'; stockColor = '#b7791f';
        }
        const isActive = product && product.is_active !== false;

        // Desktop table row
        if (tbody) {
            const tr = document.createElement('tr');

            const tdImage = document.createElement('td');
            tdImage.style.width = '88px';
            tdImage.style.minWidth = '88px';
            tdImage.style.height = '88px';
            tdImage.style.padding = '8px';
            tdImage.style.verticalAlign = 'middle';
            tdImage.style.background = '#f8fafc';
            tdImage.style.borderRadius = '8px';
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = name;
            img.loading = 'lazy';
            img.style.width = '72px';
            img.style.height = '72px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '6px';
            img.style.display = 'block';
            img.addEventListener('error', () => { img.src = '/assets/placeholder.jpg'; });
            tdImage.appendChild(img);

            const tdName = document.createElement('td');
            const strongName = document.createElement('strong');
            strongName.textContent = name;
            tdName.appendChild(strongName);
            if (product && product.sale_enabled) {
                const saleBadge = document.createElement('span');
                saleBadge.style.cssText = 'display: inline-block; margin-left: 0.4rem; background: #fde68a; color: #b45309; font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px;';
                saleBadge.textContent = 'Oferta';
                tdName.appendChild(saleBadge);
            }
            if (product && product.bundle_2x_enabled) {
                const bundleBadge = document.createElement('span');
                bundleBadge.style.cssText = 'display: inline-block; margin-left: 0.4rem; background: #fde68a; color: #b45309; font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px;';
                bundleBadge.textContent = 'Oferta 2x';
                tdName.appendChild(bundleBadge);
            }

            const tdCategory = document.createElement('td');
            const categoryBadge = document.createElement('span');
            categoryBadge.className = 'status-badge';
            categoryBadge.style.background = '#e84393';
            categoryBadge.style.color = 'white';
            categoryBadge.textContent = category;
            tdCategory.appendChild(categoryBadge);

            const tdPrice = document.createElement('td');
            if (isOnSale && product.sale_price > 0) {
                tdPrice.innerHTML = `<span style="text-decoration: line-through; color: #999; font-size: 0.8rem; display: block;">Q${toSafeMoney(product.original_price).toFixed(2)}</span><span style="color: #d63031; font-weight: 700;">Q${toSafeMoney(product.price).toFixed(2)}</span>`;
            } else {
                tdPrice.textContent = `Q${toSafeMoney(product && product.price).toFixed(2)}`;
            }

            const tdStatus = document.createElement('td');
            const statusBadge = document.createElement('span');
            statusBadge.className = 'status-badge';
            statusBadge.textContent = stockLabel;
            statusBadge.style.background = stockBg;
            statusBadge.style.color = stockColor;
            tdStatus.appendChild(statusBadge);

            const tdVisibility = document.createElement('td');
            const visibilityBadge = document.createElement('span');
            visibilityBadge.className = 'status-badge';
            visibilityBadge.style.fontSize = '0.7rem';
            visibilityBadge.style.padding = '0.3rem 0.6rem';
            visibilityBadge.textContent = isActive ? 'ACTIVO' : 'OCULTO';
            visibilityBadge.style.background = isActive ? '#e6fffa' : '#e2e8f0';
            visibilityBadge.style.color = isActive ? '#2c7a7b' : '#64748b';
            tdVisibility.appendChild(visibilityBadge);

            const tdActions = document.createElement('td');
            const settingsBtn = document.createElement('button');
            settingsBtn.className = 'btn btn-outline';
            settingsBtn.style.padding = '0.45rem 0.8rem';
            settingsBtn.style.fontSize = '0.85rem';
            settingsBtn.type = 'button';
            settingsBtn.innerHTML = '<i class="fas fa-sliders-h"></i> Ajustes';
            settingsBtn.title = 'Opciones del producto';
            settingsBtn.addEventListener('click', () => openProductSettingsModal(product));
            tdActions.appendChild(settingsBtn);

            tr.appendChild(tdImage);
            tr.appendChild(tdName);
            tr.appendChild(tdCategory);
            tr.appendChild(tdPrice);
            tr.appendChild(tdStatus);
            tr.appendChild(tdVisibility);
            tr.appendChild(tdActions);
            tbody.appendChild(tr);
        }

        // Mobile card
        if (cardsContainer) {
            const card = document.createElement('div');
            card.className = 'mobile-card';
            card.innerHTML = `
                <div class="mobile-card-product">
                    <img class="mobile-card-product-img" src="${imgUrl}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.src='/assets/placeholder.jpg'">
                    <div class="mobile-card-product-info">
                        <div class="mobile-card-product-name">${escapeHtml(name)}${product && product.sale_enabled ? ' <span class="status-badge" style="background:#fde68a;color:#b45309;font-size:0.65rem;padding:0.15rem 0.4rem;margin-left:0.3rem;">OFERTA</span>' : ''}${product && product.bundle_2x_enabled ? ' <span class="status-badge" style="background:#fde68a;color:#b45309;font-size:0.65rem;padding:0.15rem 0.4rem;margin-left:0.3rem;">Oferta 2x</span>' : ''}</div>
                        <div class="mobile-card-badges">
                            <span class="status-badge" style="background:#e84393;color:white;font-size:0.7rem;">${category}</span>
                            <span class="status-badge" style="background:${stockBg};color:${stockColor};font-size:0.7rem;">${stockLabel}</span>
                            <span class="status-badge" style="background:${isActive ? '#e6fffa' : '#e2e8f0'};color:${isActive ? '#2c7a7b' : '#64748b'};font-size:0.7rem;">${isActive ? 'ACTIVO' : 'OCULTO'}</span>
                        </div>
                        <div class="mobile-card-price">${priceText}</div>
                    </div>
                </div>
                <div class="mobile-card-actions">
                    <button class="btn btn-outline" type="button"><i class="fas fa-sliders-h"></i> Ajustes</button>
                </div>
            `;
            card.querySelector('.mobile-card-actions button').addEventListener('click', () => openProductSettingsModal(product));
            cardsContainer.appendChild(card);
        }
    });
}

async function toggleProductVisibility(productId, currentStatus) {
    const token = localStorage.getItem('admin_token');
    const newStatus = !currentStatus;

    console.log('Toggling visibility for:', productId, 'Current:', currentStatus, 'New:', newStatus);

    try {
        const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ is_active: newStatus })
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                clearAdminSession();
                return;
            }
            throw new Error('No se pudo actualizar la visibilidad');
        }

        // Refrescar datos
        loadProductsAdmin();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function openProductModal() {
    const form = document.getElementById('product-form');
    const idInput = document.getElementById('prod-id');
    const title = document.getElementById('modal-title');
    const error = document.getElementById('prod-error');
    const modal = document.getElementById('product-modal');
    const imgInput = document.getElementById('prod-images');
    const imgEditContainer = document.getElementById('prod-images-edit-container');
    const newVarSection = document.getElementById('prod-new-variant-stock-section');
    const newVarTbody = document.getElementById('prod-new-variant-tbody');
    const defaultStockInput = document.getElementById('prod-default-stock');

    if (form) {
        form.reset();
    }
    if (idInput) {
        idInput.readOnly = false;
    }
    userEditedProductId = false;
    if (title) {
        title.textContent = 'Nuevo Producto';
    }
    if (error) {
        error.style.display = 'none';
    }
    if (imgInput) {
        imgInput.value = '';
    }
    if (imgEditContainer) {
        imgEditContainer.innerHTML = '';
    }
    if (defaultStockInput) {
        defaultStockInput.value = '0';
    }
    if (newVarTbody) {
        newVarTbody.textContent = '';
    }

    const saleEnabledCheckbox = document.getElementById('prod-sale-enabled');
    const salePriceInput = document.getElementById('prod-sale-price');
    const saleDetails = document.getElementById('sale-details');
    if (saleEnabledCheckbox) saleEnabledCheckbox.checked = false;
    if (salePriceInput) salePriceInput.value = '';
    if (saleDetails) saleDetails.style.display = 'none';

    const bundle2xEnabledCheckbox = document.getElementById('prod-bundle-2x-enabled');
    const bundle2xPriceInput = document.getElementById('prod-bundle-2x-price');
    const bundle2xDetails = document.getElementById('bundle-2x-details');
    if (bundle2xEnabledCheckbox) bundle2xEnabledCheckbox.checked = false;
    if (bundle2xPriceInput) bundle2xPriceInput.value = '';
    if (bundle2xDetails) bundle2xDetails.style.display = 'none';

    clearColorRows();
    addColorRow({ name: 'Rosa palo', hex: '#d1a3a4' });

    if (modal) {
        modal.style.display = 'flex';
    }

    updateNewProductVariantStock();
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function openProductSettingsModal(product) {
    if (!product) return;
    currentProductSettingsProduct = product;

    const modal = document.getElementById('product-settings-modal');
    const imgEl = document.getElementById('prod-settings-img');
    const nameEl = document.getElementById('prod-settings-name');
    const idEl = document.getElementById('prod-settings-id');
    const visibilityCard = document.getElementById('prod-settings-visibility');
    const visibilityIcon = document.getElementById('prod-settings-visibility-icon');
    const visibilityLabel = document.getElementById('prod-settings-visibility-label');
    const visibilityDesc = document.getElementById('prod-settings-visibility-desc');

    const isActive = product.is_active !== false;

    if (imgEl) imgEl.src = safeImageUrl(product.images && product.images[0], '/assets/placeholder.svg');
    if (nameEl) nameEl.textContent = toSafeText(product.name) || 'Producto';
    if (idEl) idEl.textContent = toSafeText(product.id);

    if (visibilityCard) {
        visibilityCard.className = isActive
            ? 'prod-settings-card visibility-active'
            : 'prod-settings-card visibility-hidden';
    }
    if (visibilityIcon) {
        visibilityIcon.className = isActive ? 'fas fa-eye' : 'fas fa-eye-slash';
    }
    if (visibilityLabel) {
        visibilityLabel.textContent = isActive ? 'Activo' : 'Oculto';
    }
    if (visibilityDesc) {
        visibilityDesc.textContent = isActive
            ? 'El producto es visible en la tienda. Toca para ocultarlo.'
            : 'El producto está oculto. Toca para activarlo.';
    }

    if (modal) modal.style.display = 'flex';
}

function closeProductSettingsModal() {
    const modal = document.getElementById('product-settings-modal');
    if (modal) modal.style.display = 'none';
    currentProductSettingsProduct = null;
}

function handleSettingsVisibility() {
    if (!currentProductSettingsProduct) return;
    const product = currentProductSettingsProduct;
    const isActive = product.is_active !== false;
    closeProductSettingsModal();
    toggleProductVisibility(product.id, isActive);
}

function handleSettingsCopyLink() {
    if (!currentProductSettingsProduct) return;
    const product = currentProductSettingsProduct;
    const link = `${window.location.origin}/promo/${encodeURIComponent(toSafeText(product.id))}`;
    navigator.clipboard.writeText(link).then(() => {
        const btn = document.querySelector('#product-settings-modal .prod-settings-card.copy');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i><span class="prod-settings-label">Copiado</span><span class="prod-settings-desc">El link está en el portapapeles</span>';
            setTimeout(() => { btn.innerHTML = original; }, 1500);
        }
    }).catch(() => {
        alert('No se pudo copiar el link. Link: ' + link);
    });
}

function handleSettingsEdit() {
    if (!currentProductSettingsProduct) return;
    const product = currentProductSettingsProduct;
    closeProductSettingsModal();
    editProduct(product);
}

function handleSettingsStock() {
    if (!currentProductSettingsProduct) return;
    const product = currentProductSettingsProduct;
    closeProductSettingsModal();
    openStockModal(product);
}

function handleSettingsDelete() {
    if (!currentProductSettingsProduct) return;
    const product = currentProductSettingsProduct;
    closeProductSettingsModal();
    deleteProduct(product.id);
}

function editProduct(product) {
    const form = document.getElementById('product-form');
    if (form) {
        form.reset();
    }

    const idInput = document.getElementById('prod-id');
    if (idInput) {
        idInput.value = toSafeText(product && product.id);
        idInput.readOnly = true;
    }

    const nameInput = document.getElementById('prod-name');
    const priceInput = document.getElementById('prod-price');
    const descInput = document.getElementById('prod-desc');
    const sizesInput = document.getElementById('prod-sizes');
    const categoryInput = document.getElementById('prod-category');

    if (nameInput) {
        nameInput.value = toSafeText(product && product.name);
    }
    if (priceInput) {
        priceInput.value = toSafeMoney(product && product.price);
    }

    const wholesaleEnabled = document.getElementById('prod-wholesale-enabled');
    const wholesaleMin = document.getElementById('prod-wholesale-min');
    const wholesalePercent = document.getElementById('prod-wholesale-percent');

    if (wholesaleEnabled) wholesaleEnabled.checked = !!(product && product.wholesale_enabled);
    if (wholesaleMin) wholesaleMin.value = (product && product.wholesale_min_qty) || '';
    if (wholesalePercent) wholesalePercent.value = (product && product.wholesale_discount_percent) || '';

    const saleEnabled = document.getElementById('prod-sale-enabled');
    const salePrice = document.getElementById('prod-sale-price');
    const saleDetails = document.getElementById('sale-details');

    if (saleEnabled) saleEnabled.checked = !!(product && product.sale_enabled);
    if (salePrice) salePrice.value = (product && product.sale_price) || '';
    if (saleDetails) saleDetails.style.display = (product && product.sale_enabled) ? 'grid' : 'none';

    const bundle2xEnabled = document.getElementById('prod-bundle-2x-enabled');
    const bundle2xPrice = document.getElementById('prod-bundle-2x-price');
    const bundle2xDetails = document.getElementById('bundle-2x-details');

    if (bundle2xEnabled) bundle2xEnabled.checked = !!(product && product.bundle_2x_enabled);
    if (bundle2xPrice) bundle2xPrice.value = (product && product.bundle_2x_price) || '';
    if (bundle2xDetails) bundle2xDetails.style.display = (product && product.bundle_2x_enabled) ? 'grid' : 'none';
    if (descInput) {
        descInput.value = toSafeText(product && product.description);
    }
    if (sizesInput) {
        const sizes = Array.isArray(product && product.sizes) ? product.sizes.map((size) => toSafeText(size)).filter(Boolean) : [];
        sizesInput.value = sizes.join(',');
    }
    if (categoryInput) {
        categoryInput.value = toSafeText(product && product.category);
    }

    clearColorRows();
    const colors = normalizeColorsFromData(product && product.colors);
    if (colors.length === 0) {
        addColorRow();
    } else {
        colors.forEach((color) => addColorRow(color));
    }

    const title = document.getElementById('modal-title');
    if (title) {
        title.textContent = 'Editar Producto';
    }

    const error = document.getElementById('prod-error');
    if (error) {
        error.style.display = 'none';
    }

    const newVarSection = document.getElementById('prod-new-variant-stock-section');
    if (newVarSection) {
        newVarSection.style.display = 'none';
    }

    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.style.display = 'flex';
    }

    renderProductImagesEdit(product && product.images, product && product.id);
}

let currentStockEditProduct = null;

function openStockModal(product) {
    if (!product) return;
    currentStockEditProduct = product;

    const modal = document.getElementById('stock-modal');
    const nameEl = document.getElementById('stock-modal-product-name');
    const tbody = document.getElementById('stock-modal-tbody');

    if (nameEl) nameEl.textContent = toSafeText(product.name) || 'Producto';
    if (!tbody) return;

    const variants = Array.isArray(product.variants) ? product.variants : [];
    tbody.textContent = '';

    variants.forEach((variant) => {
        const currentStock = Number(variant.stock) || 0;
        const tr = document.createElement('tr');

        const tdVariant = document.createElement('td');
        tdVariant.innerHTML = `<span style="background:#e8f4fd;padding:0.15rem 0.5rem;border-radius:4px;font-size:0.8rem;font-weight:600;">${escapeHtml(toSafeText(variant.size).toUpperCase())}</span>`;

        const tdColor = document.createElement('td');
        const colorDot = document.createElement('span');
        colorDot.className = 'color-dot';
        colorDot.style.background = normalizeColorHex(variant.color_hex);
        tdColor.appendChild(colorDot);
        tdColor.appendChild(document.createTextNode(' ' + toSafeText(variant.color_name)));

        const tdCurrent = document.createElement('td');
        const currentStrong = document.createElement('strong');
        currentStrong.textContent = String(currentStock);
        if (currentStock === 0) currentStrong.style.color = '#d63031';
        else if (currentStock <= 3) currentStrong.style.color = '#e67e22';
        else currentStrong.style.color = '#00b894';
        tdCurrent.appendChild(currentStrong);

        const tdNew = document.createElement('td');
        const newInput = document.createElement('input');
        newInput.type = 'number';
        newInput.min = '0';
        newInput.step = '1';
        newInput.value = String(currentStock);
        newInput.className = 'stock-modal-stock';
        newInput.setAttribute('data-sku', toSafeText(variant.sku));
        newInput.setAttribute('data-original', String(currentStock));
        newInput.style.width = '70px';
        newInput.style.padding = '0.35rem';
        newInput.style.fontSize = '0.9rem';
        newInput.style.textAlign = 'center';
        tdNew.appendChild(newInput);

        const tdMin = document.createElement('td');
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.min = '0';
        minInput.step = '1';
        minInput.value = String(variant.min_stock_level || 5);
        minInput.className = 'stock-modal-min';
        minInput.setAttribute('data-sku', toSafeText(variant.sku));
        minInput.style.width = '70px';
        minInput.style.padding = '0.35rem';
        minInput.style.fontSize = '0.9rem';
        minInput.style.textAlign = 'center';
        tdMin.appendChild(minInput);

        tr.appendChild(tdVariant);
        tr.appendChild(tdColor);
        tr.appendChild(tdCurrent);
        tr.appendChild(tdNew);
        tr.appendChild(tdMin);
        tbody.appendChild(tr);
    });

    if (modal) modal.style.display = 'flex';
}

function closeStockModal() {
    const modal = document.getElementById('stock-modal');
    if (modal) modal.style.display = 'none';
    currentStockEditProduct = null;
}

function bulkSetStockModal() {
    const value = document.getElementById('stock-modal-bulk');
    if (!value) return;
    const qty = Number(value.value);
    if (!Number.isInteger(qty) || qty < 0) return;
    document.querySelectorAll('.stock-modal-stock').forEach((input) => {
        input.value = String(qty);
    });
}

async function saveStockModalChanges() {
    const token = localStorage.getItem('admin_token');
    const btn = document.getElementById('btn-save-stock');

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Guardando...';
    }

    const stockInputs = document.querySelectorAll('.stock-modal-stock');
    const minInputs = document.querySelectorAll('.stock-modal-min');

    const changes = [];
    stockInputs.forEach((input) => {
        const sku = input.getAttribute('data-sku');
        const original = Number(input.getAttribute('data-original')) || 0;
        const newVal = Number(input.value);
        if (sku && Number.isInteger(newVal) && newVal >= 0 && newVal !== original) {
            changes.push({ sku, quantity: newVal });
        }
    });

    const minChanges = [];
    minInputs.forEach((input) => {
        const sku = input.getAttribute('data-sku');
        const newVal = Number(input.value);
        if (sku && Number.isInteger(newVal) && newVal >= 0) {
            minChanges.push({ sku, min_stock_level: newVal });
        }
    });

    try {
        for (const change of changes) {
            await fetch('/api/inventory/adjust', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    sku: change.sku,
                    quantity: change.quantity,
                    reason: 'Ajuste desde edición de stock'
                })
            });
        }

        for (const mc of minChanges) {
            await fetch(`/api/inventory/${encodeURIComponent(mc.sku)}/min-stock`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ min_stock_level: mc.min_stock_level })
            }).catch((err) => console.error('Error updating min stock for', mc.sku, err));
        }

        closeStockModal();
        loadProductsAdmin();
        loadInventory();
    } catch (err) {
        console.error('Error saving stock changes:', err);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Guardar Stock';
        }
    }
}

function renderProductImagesEdit(images, productId) {
    const container = document.getElementById('prod-images-edit-container');
    if (!container) return;

    container.innerHTML = '';
    const safeImages = Array.isArray(images) ? images : [];

    if (safeImages.length === 0) {
        container.innerHTML = '<p style="color: #999; font-size: 0.85rem;">Sin imágenes.</p>';
        return;
    }

    safeImages.forEach(imgUrl => {
        const item = document.createElement('div');
        item.className = 'image-edit-item';

        const img = document.createElement('img');
        img.src = safeImageUrl(imgUrl);
        img.alt = 'Preview';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-remove-img';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.title = 'Eliminar imagen';
        
        removeBtn.addEventListener('click', async () => {
            if (confirm('¿Estás seguro de eliminar esta imagen?')) {
                const filename = imgUrl.split('/').pop();
                if (await deleteProductImageAction(productId, filename)) {
                    item.remove();
                    if (container.children.length === 0) {
                        container.innerHTML = '<p style="color: #999; font-size: 0.85rem;">Sin imágenes.</p>';
                    }
                }
            }
        });

        item.appendChild(img);
        item.appendChild(removeBtn);
        container.appendChild(item);
    });
}

async function deleteProductImageAction(productId, filename) {
    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`/api/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(filename)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            alert('Error al eliminar imagen');
            return false;
        }
        return true;
    } catch (err) {
        alert('Error conectando con el servidor');
        return false;
    }
}

async function deleteProduct(id) {
    const safeId = toSafeText(id);
    if (!safeId) {
        return;
    }

    if (!confirm(`¿Estas seguro de eliminar el producto ${safeId}? Se borrara la carpeta.`)) {
        return;
    }

    const token = localStorage.getItem('admin_token');

    try {
        const res = await fetch(`/api/products/${encodeURIComponent(safeId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                clearAdminSession();
                return;
            }
            alert('Error al eliminar');
            return;
        }

        loadProductsAdmin();
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

// ─── Dashboard Module ─────────────────────────────────────────────────────────

let dashboardDataCache = null;

async function loadDashboard() {
    try {
        const res = await apiFetch('/api/dashboard');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        dashboardDataCache = data;
        renderDashboard(data);
    } catch (err) {
        console.error('Error loading dashboard', err);
        renderDashboardError();
    }
}

function renderDashboardError() {
    const container = document.getElementById('dashboard');
    if (!container) return;
    const grid = container.querySelector('.dash-kpi-grid');
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#94a3b8;">Error al cargar dashboard. Intenta de nuevo.</div>';
}

function renderDashboard(data) {
    if (!data) return;
    renderDashboardKPIs(data.summary);
    renderSalesTrend(data.salesTrend);
    renderOrderStatusBars(data.orderStatusDistribution);
    renderLowStockList(data.lowStock);
    renderRecentOrdersList(data.recentOrders);
    renderTopProductsList(data.topProducts);
    renderTopCustomersList(data.topCustomers);
    renderVendorPerformanceList(data.vendorPerformance);
    renderRecentAuditList(data.recentAudit);
}

function renderDashboardKPIs(summary) {
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    if (!summary) return;
    setText('dash-sales-today', `Q${(Number(summary.salesToday) || 0).toFixed(2)}`);
    setText('dash-sales-month', `Q${(Number(summary.salesMonth) || 0).toFixed(2)}`);
    setText('dash-pending-orders', String(summary.pendingOrders || 0));
    setText('dash-active-products', String(summary.activeProducts || 0));
    setText('dash-stock-alerts', String(summary.stockAlerts || 0));
    setText('dash-total-customers', String(summary.totalCustomers || 0));
}

function renderSalesTrend(trend) {
    const container = document.getElementById('dash-sales-trend');
    if (!container) return;
    if (!Array.isArray(trend) || trend.length === 0) {
        container.innerHTML = '<div class="dash-list-empty">Sin datos</div>';
        return;
    }
    const max = Math.max(...trend.map((d) => Number(d.total) || 0), 1);
    container.innerHTML = trend.map((d) => {
        const pct = Math.round(((Number(d.total) || 0) / max) * 100);
        const height = Math.max(pct, 4);
        return `
            <div class="dash-bar-wrap">
                <div class="dash-bar-value">Q${(Number(d.total) || 0).toFixed(0)}</div>
                <div class="dash-bar" style="height:${height}%;"></div>
                <div class="dash-bar-label">${escapeHtml(d.label || d.day)}</div>
            </div>
        `;
    }).join('');
}

function renderOrderStatusBars(dist) {
    const container = document.getElementById('dash-status-bars');
    if (!container) return;
    if (!dist || dist.total === 0) {
        container.innerHTML = '<div class="dash-list-empty">Sin pedidos</div>';
        return;
    }
    const statuses = [
        { key: 'pendiente', label: 'Pendientes', color: '#b7791f', bg: '#fff8e6' },
        { key: 'confirmado', label: 'Confirmados', color: '#2c7a7b', bg: '#e6fffa' },
        { key: 'enviado', label: 'Enviados', color: '#2b6cb0', bg: '#e8f4fd' },
        { key: 'cancelado', label: 'Cancelados', color: '#d63031', bg: '#ffe5e5' }
    ];
    const total = Math.max(dist.total, 1);
    container.innerHTML = statuses.map((s) => {
        const count = Number(dist[s.key]) || 0;
        const pct = Math.round((count / total) * 100);
        return `
            <div class="dash-status-row">
                <div class="dash-status-label">${s.label}</div>
                <div class="dash-status-track">
                    <div class="dash-status-fill" style="width:${pct}%;background:${s.color};"></div>
                </div>
                <div class="dash-status-count">${count}</div>
            </div>
        `;
    }).join('');
}

function renderLowStockList(items) {
    const container = document.getElementById('dash-low-stock');
    if (!container) return;
    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = '<div class="dash-list-empty">No hay alertas de stock</div>';
        return;
    }
    container.innerHTML = items.map((item) => {
        const isOut = Number(item.quantity) === 0;
        const badgeBg = isOut ? '#ffe5e5' : '#fff8e6';
        const badgeColor = isOut ? '#d63031' : '#b7791f';
        const badgeText = isOut ? 'AGOTADO' : `Stock ${item.quantity}`;
        return `
            <div class="dash-list-item">
                <div class="dash-list-main">
                    <div class="dash-list-name">${escapeHtml(toSafeText(item.product_name))}</div>
                    <div class="dash-list-meta">${escapeHtml(toSafeText(item.sku))}</div>
                </div>
                <span class="dash-list-badge" style="background:${badgeBg};color:${badgeColor};">${badgeText}</span>
            </div>
        `;
    }).join('');
}

function renderRecentOrdersList(orders) {
    const container = document.getElementById('dash-recent-orders');
    if (!container) return;
    if (!Array.isArray(orders) || orders.length === 0) {
        container.innerHTML = '<div class="dash-list-empty">No hay pedidos recientes</div>';
        return;
    }
    container.innerHTML = orders.map((o) => {
        const status = normalizeStatus(o.status);
        const statusColors = {
            pendiente: { bg: '#fff8e6', color: '#b7791f' },
            confirmado: { bg: '#e6fffa', color: '#2c7a7b' },
            enviado: { bg: '#e8f4fd', color: '#2b6cb0' },
            cancelado: { bg: '#ffe5e5', color: '#d63031' }
        };
        const sc = statusColors[status] || statusColors.pendiente;
        return `
            <div class="dash-list-item" style="cursor:pointer;" onclick="openOrderModal('${escapeHtml(toSafeText(o.id))}')">
                <div class="dash-list-main">
                    <div class="dash-list-name">#${escapeHtml(toSafeText(o.id))} - ${escapeHtml(toSafeText(o.customer_name) || 'Sin nombre')}</div>
                    <div class="dash-list-meta">${formatOrderDate(o.created_at)}</div>
                </div>
                <div style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0;">
                    <span style="font-weight:700;font-size:0.9rem;color:var(--secondary-color);">Q${toSafeMoney(o.total).toFixed(2)}</span>
                    <span class="dash-list-badge" style="background:${sc.bg};color:${sc.color};">${status.toUpperCase()}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderTopProductsList(products) {
    const container = document.getElementById('dash-top-products');
    if (!container) return;
    if (!Array.isArray(products) || products.length === 0) {
        container.innerHTML = '<div class="dash-list-empty">Sin ventas registradas</div>';
        return;
    }
    container.innerHTML = products.map((p, idx) => `
        <div class="dash-list-item">
            <div class="dash-list-main">
                <div style="width:22px;height:22px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#64748b;flex-shrink:0;">${idx + 1}</div>
                <div class="dash-list-name">${escapeHtml(toSafeText(p.product_name) || 'Producto')}</div>
            </div>
            <div class="dash-list-meta">${Number(p.total_sold) || 0} vendidos · Q${toSafeMoney(p.total_revenue).toFixed(2)}</div>
        </div>
    `).join('');
}

function renderTopCustomersList(customers) {
    const container = document.getElementById('dash-top-customers');
    if (!container) return;
    if (!Array.isArray(customers) || customers.length === 0) {
        container.innerHTML = '<div class="dash-list-empty">Sin clientes registrados</div>';
        return;
    }
    container.innerHTML = customers.map((c, idx) => `
        <div class="dash-list-item" style="cursor:pointer;" onclick="openCustomerDetailModal(${Number(c.id)})">
            <div class="dash-list-main">
                <div style="width:22px;height:22px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#64748b;flex-shrink:0;">${idx + 1}</div>
                <div class="dash-list-name">${escapeHtml(toSafeText(c.name) || '-')}</div>
            </div>
            <div class="dash-list-meta">${Number(c.order_count) || 0} pedidos · Q${toSafeMoney(c.total_spent).toFixed(2)}</div>
        </div>
    `).join('');
}

function renderVendorPerformanceList(vendors) {
    const container = document.getElementById('dash-vendor-perf');
    if (!container) return;
    if (!Array.isArray(vendors) || vendors.length === 0) {
        container.innerHTML = '<div class="dash-list-empty">Sin datos de vendedores</div>';
        return;
    }
    const maxSales = Math.max(...vendors.map((v) => Number(v.total_sales) || 0), 1);
    container.innerHTML = vendors.map((v) => {
        const pct = Math.round(((Number(v.total_sales) || 0) / maxSales) * 100);
        return `
            <div class="dash-list-item">
                <div class="dash-list-main">
                    <div class="dash-list-name">${escapeHtml(toSafeText(v.vendor) || 'Desconocido')}</div>
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;flex:1;max-width:140px;">
                    <div class="dash-status-track" style="height:8px;">
                        <div class="dash-status-fill" style="width:${pct}%;background:var(--admin-primary);"></div>
                    </div>
                    <span style="font-size:0.8rem;font-weight:700;white-space:nowrap;">${Number(v.order_count) || 0} / Q${toSafeMoney(v.total_sales).toFixed(0)}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderRecentAuditList(logs) {
    const container = document.getElementById('dash-recent-audit');
    if (!container) return;
    if (!Array.isArray(logs) || logs.length === 0) {
        container.innerHTML = '<div class="dash-list-empty">Sin actividad reciente</div>';
        return;
    }
    const actionColors = {
        create: { bg: '#e6fffa', color: '#2c7a7b', label: 'Crear' },
        update: { bg: '#fff8e6', color: '#b7791f', label: 'Actualizar' },
        delete: { bg: '#ffe5e5', color: '#d63031', label: 'Eliminar' }
    };
    container.innerHTML = logs.map((log) => {
        const action = toSafeText(log.action).toLowerCase();
        const ac = actionColors[action] || { bg: '#e2e8f0', color: '#64748b', label: action };
        return `
            <div class="dash-list-item">
                <div class="dash-list-main">
                    <div class="dash-list-name">${escapeHtml(toSafeText(log.table_name))}</div>
                    <div class="dash-list-meta">${escapeHtml(toSafeText(log.record_id))}</div>
                </div>
                <div style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0;">
                    <span class="dash-list-badge" style="background:${ac.bg};color:${ac.color};">${ac.label}</span>
                    <span class="dash-list-meta">${escapeHtml(toSafeText(log.changed_by) || '-')}</span>
                </div>
            </div>
        `;
    }).join('');
}

function switchAdminSection(target) {
    document.querySelectorAll('.tab-btn').forEach((node) => node.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.remove('active'));
    document.querySelectorAll('.admin-sidebar-item').forEach((node) => node.classList.remove('active'));

    const tabBtn = document.querySelector(`.tab-btn[data-target="${target}"]`);
    if (tabBtn) tabBtn.classList.add('active');

    const sidebarItem = document.querySelector(`.admin-sidebar-item[data-target="${target}"]`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const targetPane = document.getElementById(target);
    if (targetPane) {
        targetPane.classList.add('active');
    }

    const titleMap = {
        dashboard: 'Dashboard',
        pedidos: 'Pedidos',
        productos: 'Productos',
        inventario: 'Inventario',
        usuarios: 'Usuarios',
        clientes: 'Clientes',
        auditoria: 'Auditoría'
    };
    const titleEl = document.getElementById('admin-section-title');
    if (titleEl && titleMap[target]) {
        titleEl.textContent = titleMap[target];
    }

    if (target === 'dashboard') {
        loadDashboard();
    }
    if (target === 'pedidos') {
        loadOrders();
    }
    if (target === 'productos') {
        loadProductsAdmin();
    }
    if (target === 'inventario') {
        loadInventory();
    }
    if (target === 'usuarios') {
        loadUsers();
    }
    if (target === 'clientes') {
        loadCustomers();
    }
    if (target === 'auditoria') {
        setAuditView('logs');
    }
}

function openAdminSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('admin-sidebar-backdrop');
    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeAdminSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('admin-sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Sidebar toggle
    const menuToggle = document.getElementById('admin-menu-toggle');
    const sidebarClose = document.getElementById('admin-sidebar-close');
    const sidebarBackdrop = document.getElementById('admin-sidebar-backdrop');
    if (menuToggle) menuToggle.addEventListener('click', openAdminSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeAdminSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeAdminSidebar);

    // Sidebar navigation
    document.querySelectorAll('.admin-sidebar-item').forEach((item) => {
        item.addEventListener('click', (event) => {
            const target = event.currentTarget.getAttribute('data-target');
            if (target) {
                switchAdminSection(target);
                closeAdminSidebar();
            }
        });
    });

    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            const target = event.currentTarget.getAttribute('data-target');
            if (target) {
                switchAdminSection(target);
            }
        });
    });

    // Auto-generación de ID/Slug compacto desde nombre + talla + color + random
    const nameInput = document.getElementById('prod-name');
    const idInput = document.getElementById('prod-id');
    const prodSizesInput = document.getElementById('prod-sizes');

    if (nameInput && idInput) {
        nameInput.addEventListener('input', () => {
            if (!idInput.readOnly) {
                updateAutoGeneratedId();
            }
        });
    }
    if (prodSizesInput && idInput) {
        prodSizesInput.addEventListener('input', () => {
            if (!idInput.readOnly) {
                updateAutoGeneratedId();
            }
        });
    }
    if (idInput) {
        idInput.addEventListener('input', () => {
            userEditedProductId = true;
            if (!idInput.readOnly) {
                updateNewProductVariantStock();
            }
        });
    }

    const addColorBtn = document.getElementById('btn-add-color');
    if (addColorBtn) {
        addColorBtn.addEventListener('click', () => {
            addColorRow();
            updateAutoGeneratedId();
        });
    }

    // Observer for color row changes (deletion, addition)
    const colorsList = document.getElementById('prod-colors-list');
    if (colorsList) {
        const colorObserver = new MutationObserver(() => {
            updateAutoGeneratedId();
        });
        colorObserver.observe(colorsList, { childList: true });
        colorsList.addEventListener('input', (e) => {
            if (e.target.classList.contains('prod-color-name') || e.target.classList.contains('prod-color-hex')) {
                updateAutoGeneratedId();
            }
        });
    }

    // Remove color buttons delegate
    document.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('#prod-colors-list .btn-outline');
        if (removeBtn && removeBtn.innerHTML.includes('fa-trash')) {
            setTimeout(() => updateAutoGeneratedId(), 50);
        }
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const user = document.getElementById('username');
            const pass = document.getElementById('password');
            const errObj = document.getElementById('login-error');

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user ? user.value : '', password: pass ? pass.value : '' })
                });

                if (!res.ok) {
                    throw new Error('Credenciales inválidas');
                }

                const data = await res.json();
                if (!isLikelyJwt(data && data.token)) {
                    throw new Error('Sesion inválida. Intenta nuevamente.');
                }
                localStorage.setItem('admin_token', data.token);
                checkAuth();
            } catch (err) {
                if (errObj) {
                    errObj.textContent = err && err.message ? err.message : 'Credenciales inválidas';
                    errObj.style.display = 'block';
                }
            }
        });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('admin_token');
            checkAuth();
        });
    }

    const copySummaryBtn = document.getElementById('btn-copy-order-summary');
    if (copySummaryBtn) {
        copySummaryBtn.addEventListener('click', () => {
            copyCurrentOrderSummary();
        });
    }

    const orderModal = document.getElementById('order-modal');
    if (orderModal) {
        orderModal.addEventListener('click', (event) => {
            if (event.target === orderModal) {
                closeOrderModal();
            }
        });
    }

    const userForm = document.getElementById('user-form');
    if (userForm) {
        userForm.addEventListener('submit', (e) => saveUser(e));
    }

    const userModal = document.getElementById('user-modal');
    if (userModal) {
        userModal.addEventListener('click', (event) => {
            if (event.target === userModal) closeUserModal();
        });
    }

    const saleEnabledCheckbox = document.getElementById('prod-sale-enabled');
    if (saleEnabledCheckbox) {
        saleEnabledCheckbox.addEventListener('change', () => {
            const saleDetails = document.getElementById('sale-details');
            if (saleDetails) {
                saleDetails.style.display = saleEnabledCheckbox.checked ? 'grid' : 'none';
            }
        });
    }

    const bundle2xEnabledCheckbox = document.getElementById('prod-bundle-2x-enabled');
    if (bundle2xEnabledCheckbox) {
        bundle2xEnabledCheckbox.addEventListener('change', () => {
            const bundle2xDetails = document.getElementById('bundle-2x-details');
            if (bundle2xDetails) {
                bundle2xDetails.style.display = bundle2xEnabledCheckbox.checked ? 'grid' : 'none';
            }
        });
    }

    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const btn = document.getElementById('btn-save-prod');
            const errObj = document.getElementById('prod-error');
            const idInput = document.getElementById('prod-id');
            const isEdit = idInput ? idInput.readOnly : false;

            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Guardando...';
            }

            if (errObj) {
                errObj.style.display = 'none';
            }

            const colors = collectColorRows();
            const token = localStorage.getItem('admin_token');
            const productId = document.getElementById('prod-id');
            const safeProductId = productId ? productId.value : '';
            const url = isEdit ? `/api/products/${encodeURIComponent(safeProductId)}` : '/api/products';

            try {
                const fd = new FormData();
                if (!isEdit) {
                    fd.append('id', document.getElementById('prod-id') ? document.getElementById('prod-id').value : '');
                }
                fd.append('name', document.getElementById('prod-name') ? document.getElementById('prod-name').value : '');
                fd.append('price', document.getElementById('prod-price') ? document.getElementById('prod-price').value : '');
                fd.append('description', document.getElementById('prod-desc') ? document.getElementById('prod-desc').value : '');
                fd.append('sizes', document.getElementById('prod-sizes') ? document.getElementById('prod-sizes').value : '');
                fd.append('category', document.getElementById('prod-category') ? document.getElementById('prod-category').value : '');
                fd.append('colors', JSON.stringify(colors));
                fd.append('wholesale_enabled', document.getElementById('prod-wholesale-enabled') ? document.getElementById('prod-wholesale-enabled').checked : false);
                fd.append('wholesale_min_qty', document.getElementById('prod-wholesale-min') ? document.getElementById('prod-wholesale-min').value : 0);
                fd.append('wholesale_discount_percent', document.getElementById('prod-wholesale-percent') ? document.getElementById('prod-wholesale-percent').value : 0);
                fd.append('sale_enabled', document.getElementById('prod-sale-enabled') ? document.getElementById('prod-sale-enabled').checked : false);
                fd.append('sale_price', document.getElementById('prod-sale-price') ? document.getElementById('prod-sale-price').value : '');
                fd.append('bundle_2x_enabled', document.getElementById('prod-bundle-2x-enabled') ? document.getElementById('prod-bundle-2x-enabled').checked : false);
                fd.append('bundle_2x_price', document.getElementById('prod-bundle-2x-price') ? document.getElementById('prod-bundle-2x-price').value : '');

                const filesInput = document.getElementById('prod-images');
                const files = filesInput && filesInput.files ? filesInput.files : [];
                
                // Comprimir imágenes antes de subirlas
                for (let i = 0; i < files.length; i += 1) {
                    try {
                        const compressed = await compressImage(files[i]);
                        if (compressed) {
                            fd.append('images', compressed);
                        }
                    } catch (compressErr) {
                        console.warn('Error comprimiendo imagen, usando original:', compressErr);
                        fd.append('images', files[i]);
                    }
                }

                const res = await fetch(url, {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: fd
                });

                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                        clearAdminSession();
                        return;
                    }
                    const eData = await res.json();
                    throw new Error(eData.error || 'Error al guardar');
                }

                let createdProduct = null;
                if (!isEdit) {
                    try {
                        createdProduct = await res.json();
                    } catch (_) {
                        // response already consumed or not JSON
                    }
                }

                // Edit mode: no inline inventory changes — stock is edited via separate modal

                // Si es producto nuevo, establecer stock inicial por variante
                if (!isEdit) {
                    const variantStockData = collectNewVariantStockData();
                    const hasAnyStock = variantStockData.some((v) => v.quantity > 0);

                    if (hasAnyStock) {
                        try {
                            if (createdProduct && Array.isArray(createdProduct.variants)) {
                                // Use actual SKUs from response, match by size+color
                                for (const variant of createdProduct.variants) {
                                    const matchData = variantStockData.find((v) =>
                                        v.size === String(variant.size).toLowerCase() &&
                                        v.color_name === String(variant.color_name).toLowerCase().replace(/\s+/g, '-')
                                    );
                                    const qty = matchData ? Number(matchData.quantity) : 0;
                                    if (qty > 0) {
                                        await fetch('/api/inventory/entry', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${token}`
                                            },
                                            body: JSON.stringify({
                                                sku: variant.sku,
                                                quantity: qty,
                                                reason: 'Stock inicial al crear producto'
                                            })
                                        });
                                    }
                                }
                            } else {
                                // Fallback: use predicted SKUs
                                for (const variant of variantStockData) {
                                    if (variant.quantity > 0) {
                                        await fetch('/api/inventory/entry', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${token}`
                                            },
                                            body: JSON.stringify({
                                                sku: variant.sku,
                                                quantity: variant.quantity,
                                                reason: 'Stock inicial al crear producto'
                                            })
                                        });
                                    }
                                }
                            }
                        } catch (invErr) {
                            console.error('Error estableciendo stock inicial:', invErr);
                        }
                    }
                }

                closeProductModal();
                loadProductsAdmin();
            } catch (err) {
                console.error('Error guardando producto:', err);
                if (errObj) {
                    errObj.textContent = err.message || 'Error inesperado al guardar';
                    errObj.style.display = 'block';
                }
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Guardar';
                }
            }
        });
    }

    const customerForm = document.getElementById('customer-form');
    if (customerForm) {
        customerForm.addEventListener('submit', saveCustomer);
    }

    clearColorRows();
    addColorRow({ name: 'Rosa palo', hex: '#d1a3a4' });

    const imgEditContainer = document.getElementById('prod-images-edit-container');
    if (imgEditContainer) imgEditContainer.innerHTML = '';

    // Cerrar modales al hacer clic fuera
    const inventoryModal = document.getElementById('inventory-modal');
    if (inventoryModal) {
        inventoryModal.addEventListener('click', (event) => {
            if (event.target === inventoryModal) {
                closeInventoryModal();
            }
        });
    }

    const stockModal = document.getElementById('stock-modal');
    if (stockModal) {
        stockModal.addEventListener('click', (event) => {
            if (event.target === stockModal) {
                closeStockModal();
            }
        });
    }

    const auditDetailModal = document.getElementById('audit-detail-modal');
    if (auditDetailModal) {
        auditDetailModal.addEventListener('click', (event) => {
            if (event.target === auditDetailModal) {
                closeAuditDetailModal();
            }
        });
    }

    const productSettingsModal = document.getElementById('product-settings-modal');
    if (productSettingsModal) {
        productSettingsModal.addEventListener('click', (event) => {
            if (event.target === productSettingsModal) {
                closeProductSettingsModal();
            }
        });
    }
});

// ─── Inventory Module ─────────────────────────────────────────────────────────

let adminInventory = [];
let adminAlerts = [];
let currentInventoryModalSku = null;
let currentInvMode = 'add';
let lastMovementsData = [];

async function loadNotifications() {
    try {
        const res = await apiFetch('/api/inventory/alerts');
        if (res.ok) {
            adminAlerts = await res.json();
            updateNotificationBadge();
        }
    } catch (err) {
        console.error('Error load notifications', err);
    }
}

async function loadInventory() {
    try {
        const [inventoryRes, alertsRes] = await Promise.all([
            apiFetch('/api/inventory'),
            apiFetch('/api/inventory/alerts')
        ]);

        adminInventory = await inventoryRes.json();
        adminAlerts = await alertsRes.json();

        updateInventoryStats();
        renderInventoryTable(adminInventory);
        updateNotificationBadge();
    } catch (err) {
        console.error('Error load inventory', err);
        const list = document.getElementById('inventory-list');
        if (list) {
            list.innerHTML = '<div style="padding:2rem;text-align:center;color:#d63031;font-size:0.9rem;"><i class="fas fa-exclamation-triangle" style="display:block;margin-bottom:0.5rem;font-size:1.5rem;"></i>Error al cargar inventario. Intenta de nuevo.</div>';
        }
    }
}

function updateInventoryStats() {
    const totalVariants = Array.isArray(adminInventory) ? adminInventory.length : 0;
    const outOfStock = Array.isArray(adminAlerts) ? adminAlerts.filter((item) => Number(item.quantity) === 0).length : 0;
    const lowStock = Array.isArray(adminAlerts) ? adminAlerts.filter((item) => Number(item.quantity) > 0).length : 0;
    const okStock = Math.max(0, totalVariants - outOfStock - lowStock);

    const totalEl = document.getElementById('stat-total-variants');
    const lowEl = document.getElementById('stat-low-stock');
    const outEl = document.getElementById('stat-out-of-stock');
    const okEl = document.getElementById('stat-ok-stock');

    if (totalEl) totalEl.textContent = String(totalVariants);
    if (lowEl) lowEl.textContent = String(lowStock);
    if (outEl) outEl.textContent = String(outOfStock);
    if (okEl) okEl.textContent = String(okStock);
}

function updateNotificationBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const count = Array.isArray(adminAlerts) ? adminAlerts.length : 0;
    if (count > 0) {
        badge.textContent = String(count);
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function toggleNotifications() {
    const backdrop = document.getElementById('notif-backdrop');
    const panel = document.getElementById('notif-panel');
    if (!backdrop || !panel) return;
    const willOpen = !panel.classList.contains('open');
    if (willOpen) {
        backdrop.classList.add('open');
        panel.classList.add('open');
        renderNotifications();
        document.body.style.overflow = 'hidden';
    } else {
        backdrop.classList.remove('open');
        panel.classList.remove('open');
        document.body.style.overflow = '';
    }
}

function renderNotifications() {
    const list = document.getElementById('notif-list');
    if (!list) return;

    list.textContent = '';

    if (!Array.isArray(adminAlerts) || adminAlerts.length === 0) {
        list.innerHTML = '<div class="notif-empty"><i class="fas fa-check-circle" style="font-size:1.2rem;display:block;margin-bottom:0.4rem;color:#00b894;"></i>Sin alertas de stock</div>';
        return;
    }

    // Agrupar alertas por producto
    const groups = {};
    adminAlerts.forEach((item) => {
        const name = toSafeText(item.product_name);
        if (!groups[name]) groups[name] = [];
        groups[name].push(item);
    });

    Object.entries(groups).forEach(([productName, items]) => {
        const outCount = items.filter(it => (Number(it.quantity) || 0) === 0).length;
        const hasCritical = outCount > 0;

        const itemWrap = document.createElement('div');
        itemWrap.className = 'notif-item';

        const header = document.createElement('div');
        header.className = 'notif-item-header';
        header.innerHTML = `
            <span class="notif-dot ${hasCritical ? 'critical' : 'warning'}"></span>
            <span class="notif-name">${escapeHtml(productName)}</span>
            <span class="notif-meta">${items.length}v ${hasCritical ? `(${outCount} agot.)` : ''}</span>
            <i class="fas fa-chevron-down notif-chevron"></i>
        `;

        const body = document.createElement('div');
        body.className = 'notif-item-body';

        items.forEach((item) => {
            const qty = Number(item.quantity) || 0;
            const min = Number(item.min_stock_level) || 5;
            const isOut = qty === 0;
            const isLow = qty > 0 && qty <= min;

            const row = document.createElement('div');
            row.className = 'notif-variant-row';
            row.innerHTML = `
                <div style="display:flex;align-items:center;gap:0.35rem;min-width:0;">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${normalizeColorHex(item.color_hex)};border:1px solid rgba(0,0,0,0.08);flex-shrink:0;"></span>
                    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(toSafeText(item.size).toUpperCase())} · ${escapeHtml(item.color_name)}</span>
                    <span class="nv-sku">${escapeHtml(item.sku)}</span>
                </div>
                <div class="nv-stock ${isOut ? 'out' : isLow ? 'low' : 'ok'}">${qty}</div>
                <div class="notif-var-actions">
                    <button data-action="add" data-sku="${escapeHtml(item.sku)}" data-product="${escapeHtml(productName)}" data-qty="${qty}"><i class="fas fa-plus" style="font-size:0.6rem;"></i></button>
                    <button data-action="adjust" data-sku="${escapeHtml(item.sku)}" data-product="${escapeHtml(productName)}" data-qty="${qty}">Aj.</button>
                </div>
            `;
            body.appendChild(row);
        });

        header.addEventListener('click', () => {
            const isOpen = body.classList.contains('open');
            body.classList.toggle('open');
            const chevron = header.querySelector('.fa-chevron-down');
            if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
        });

        body.querySelectorAll('button[data-action]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.getAttribute('data-action');
                openInventoryModal({
                    sku: btn.getAttribute('data-sku'),
                    product_name: btn.getAttribute('data-product'),
                    quantity: Number(btn.getAttribute('data-qty'))
                }, action);
            });
        });

        itemWrap.appendChild(header);
        itemWrap.appendChild(body);
        list.appendChild(itemWrap);
    });
}

function renderAlertCards(alerts) {
    // Delegado al sistema de notificaciones globales
    adminAlerts = alerts;
    updateNotificationBadge();
}

function renderAlertsTable(alerts) {
    renderAlertCards(alerts);
}

function renderInventoryTable(inventory) {
    const list = document.getElementById('inventory-list');
    if (!list) return;

    list.textContent = '';

    if (!Array.isArray(inventory) || inventory.length === 0) {
        list.innerHTML = '<div style="padding:2rem;text-align:center;color:#94a3b8;font-size:0.9rem;"><i class="fas fa-box-open" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No hay datos de inventario.</div>';
        return;
    }

    // Agrupar por producto
    const groups = [];
    let currentGroup = null;
    inventory.forEach((item) => {
        const name = toSafeText(item.product_name);
        if (!currentGroup || currentGroup.name !== name) {
            currentGroup = { name, items: [] };
            groups.push(currentGroup);
        }
        currentGroup.items.push(item);
    });

    groups.forEach((group) => {
        const groupTotalStock = group.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
        const groupVariants = group.items.length;
        const outCount = group.items.filter(it => (Number(it.quantity) || 0) === 0).length;
        const lowCount = group.items.filter(it => {
            const q = Number(it.quantity) || 0;
            const m = Number(it.min_stock_level) || 0;
            return q > 0 && q <= m;
        }).length;

        let groupStatus = 'ok';
        let groupBadgeText = 'OK';
        if (outCount > 0) { groupStatus = 'out'; groupBadgeText = `${outCount} Agot.`; }
        else if (lowCount > 0) { groupStatus = 'low'; groupBadgeText = `${lowCount} Bajo`; }

        const itemWrap = document.createElement('div');
        itemWrap.className = 'inv-accordion-item';

        const header = document.createElement('div');
        header.className = 'inv-accordion-header';
        header.innerHTML = `
            <span class="inv-name">${escapeHtml(group.name)}</span>
            <span class="inv-total">${groupTotalStock} u.</span>
            <span class="inv-meta">
                <span class="inv-badge ${groupStatus}">${groupBadgeText}</span>
                <span style="font-size:0.7rem;color:#94a3b8;">${groupVariants}v</span>
            </span>
            <i class="fas fa-chevron-down inv-chevron"></i>
        `;

        const body = document.createElement('div');
        body.className = 'inv-accordion-body';

        // Header de mini-tabla de variantes
        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display:grid;grid-template-columns:1fr 80px 50px 60px;align-items:center;gap:0.5rem;padding:0.25rem 0.5rem 0.4rem;font-size:0.7rem;color:#94a3b8;font-weight:600;border-bottom:1px solid #e2e8f0;margin-bottom:0.2rem;';
        headerRow.innerHTML = '<span>Variante</span><span>SKU</span><span>Stock</span><span></span>';
        body.appendChild(headerRow);

        group.items.forEach((item) => {
            const qty = Number(item.quantity) || 0;
            const min = Number(item.min_stock_level) || 0;
            const isLow = qty <= min && qty > 0;
            const isOut = qty === 0;

            const row = document.createElement('div');
            row.className = 'inv-variant-row';
            row.innerHTML = `
                <div class="inv-var-name">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${normalizeColorHex(item.color_hex)};border:1px solid rgba(0,0,0,0.08);flex-shrink:0;"></span>
                    <span>${escapeHtml(toSafeText(item.size).toUpperCase())} · ${escapeHtml(item.color_name)}</span>
                </div>
                <div style="font-family:monospace;font-size:0.75rem;color:#64748b;">${escapeHtml(item.sku)}</div>
                <div class="inv-var-stock ${isOut ? 'out' : isLow ? 'low' : 'ok'}">${qty}</div>
                <div class="inv-var-actions">
                    <button title="Agregar"><i class="fas fa-plus" style="font-size:0.6rem;"></i></button>
                    <button title="Ajustar">Aj.</button>
                </div>
            `;

            const [addBtn, adjustBtn] = row.querySelectorAll('button');
            addBtn.addEventListener('click', () => openInventoryModal(item, 'add'));
            adjustBtn.addEventListener('click', () => openInventoryModal(item, 'adjust'));

            body.appendChild(row);
        });

        // Accordion toggle
        header.addEventListener('click', () => {
            const isOpen = body.classList.contains('open');
            body.classList.toggle('open');
            header.classList.toggle('active');
        });

        itemWrap.appendChild(header);
        itemWrap.appendChild(body);
        list.appendChild(itemWrap);
    });
}

function applyInventoryFilters() {
    const searchInput = document.getElementById('inventory-search');
    const statusInput = document.getElementById('inv-status-filter');
    const sortInput = document.getElementById('inventory-sort');
    const query = toSafeText(searchInput ? searchInput.value : '').toLowerCase();
    const statusFilter = toSafeText(statusInput ? statusInput.value : 'all');
    const sortBy = toSafeText(sortInput ? sortInput.value : '');

    if (!Array.isArray(adminInventory)) {
        renderInventoryTable(adminInventory);
        return;
    }

    let filtered = adminInventory.filter((item) => {
        const sku = toSafeText(item.sku).toLowerCase();
        const name = toSafeText(item.product_name).toLowerCase();
        const matchesSearch = !query || sku.includes(query) || name.includes(query);

        const qty = Number(item.quantity) || 0;
        const min = Number(item.min_stock_level) || 0;
        let matchesStatus = true;
        if (statusFilter === 'out') matchesStatus = qty === 0;
        else if (statusFilter === 'low') matchesStatus = qty > 0 && qty <= min;
        else if (statusFilter === 'ok') matchesStatus = qty > min;

        return matchesSearch && matchesStatus;
    });

    // Ordenamiento
    if (sortBy) {
        // Calcular stock total por producto para ordenar por stock
        const stockByProduct = {};
        if (sortBy === 'stock_asc' || sortBy === 'stock_desc') {
            filtered.forEach((item) => {
                const name = toSafeText(item.product_name);
                stockByProduct[name] = (stockByProduct[name] || 0) + (Number(item.quantity) || 0);
            });
        }

        filtered.sort((a, b) => {
            const nameA = toSafeText(a.product_name).toLowerCase();
            const nameB = toSafeText(b.product_name).toLowerCase();
            const skuA = toSafeText(a.sku).toLowerCase();
            const skuB = toSafeText(b.sku).toLowerCase();

            if (sortBy === 'name_asc') {
                if (nameA !== nameB) return nameA.localeCompare(nameB);
                return skuA.localeCompare(skuB);
            }
            if (sortBy === 'name_desc') {
                if (nameA !== nameB) return nameB.localeCompare(nameA);
                return skuB.localeCompare(skuA);
            }
            if (sortBy === 'stock_asc') {
                const stockA = stockByProduct[nameA] || 0;
                const stockB = stockByProduct[nameB] || 0;
                if (stockA !== stockB) return stockA - stockB;
                return nameA.localeCompare(nameB);
            }
            if (sortBy === 'stock_desc') {
                const stockA = stockByProduct[nameA] || 0;
                const stockB = stockByProduct[nameB] || 0;
                if (stockA !== stockB) return stockB - stockA;
                return nameA.localeCompare(nameB);
            }
            if (sortBy === 'sku_asc') {
                return skuA.localeCompare(skuB);
            }
            return 0;
        });
    }

    renderInventoryTable(filtered);
}

async function loadMovements() {
    const typeFilter = document.getElementById('movement-type-filter');
    const type = typeFilter ? typeFilter.value : '';

    try {
        let url = '/api/inventory/movements?limit=100&offset=0';
        if (type) {
            url += `&type=${encodeURIComponent(type)}`;
        }

        const res = await apiFetch(url);
        const data = await res.json();
        lastMovementsData = data.movements || [];
        renderMovementsTable(lastMovementsData);
    } catch (err) {
        console.error('Error load movements', err);
    }
}

function applyMovementFilter() {
    const searchInput = document.getElementById('movement-search');
    const query = toSafeText(searchInput ? searchInput.value : '').toLowerCase();

    if (!query) {
        renderMovementsTable(lastMovementsData);
        return;
    }

    const filtered = lastMovementsData.filter((m) => {
        const sku = toSafeText(m.sku).toLowerCase();
        const product = toSafeText(m.product_name).toLowerCase();
        const reason = toSafeText(m.reason).toLowerCase();
        const ref = toSafeText(m.reference_id).toLowerCase();
        return sku.includes(query) || product.includes(query) || reason.includes(query) || ref.includes(query);
    });

    renderMovementsTable(filtered);
}

function renderMovementsTable(movements) {
    const tbody = document.getElementById('movements-tbody');
    const cardsContainer = document.getElementById('movements-cards');
    if (!tbody && !cardsContainer) return;
    if (tbody) tbody.textContent = '';
    if (cardsContainer) cardsContainer.textContent = '';

    if (!Array.isArray(movements) || movements.length === 0) {
        const emptyHtml = '<div style="text-align:center;padding:2rem;color:#94a3b8;"><i class="fas fa-clock-rotate-left" style="font-size:2rem;display:block;margin-bottom:0.5rem;"></i>No hay movimientos registrados.</div>';
        if (tbody) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 9;
            td.style.textAlign = 'center';
            td.style.padding = '2rem';
            td.style.color = '#94a3b8';
            td.innerHTML = '<i class="fas fa-clock-rotate-left" style="font-size:2rem;display:block;margin-bottom:0.5rem;"></i>No hay movimientos registrados.';
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        if (cardsContainer) cardsContainer.innerHTML = emptyHtml;
        return;
    }

    movements.forEach((m) => {
        const type = toSafeText(m.movement_type).toLowerCase();
        const productName = toSafeText(m.product_name);
        const sku = toSafeText(m.sku);
        const qtyNum = Number(m.quantity) || 0;
        const prevQty = String(m.previous_quantity || 0);
        const newQty = String(m.new_quantity || 0);
        const reason = toSafeText(m.reason) || '-';
        const createdBy = toSafeText(m.created_by) || '-';
        const dateStr = formatOrderDate(m.created_at);
        let typeLabel = 'AJUSTE';
        let typeBg = '#fff8e6';
        let typeColor = '#b7791f';
        let qtyColor = '#1a202c';
        let qtyPrefix = '';
        let iconHtml = '<i class="fas fa-pen" style="color:#b7791f;font-size:0.75rem;"></i>';
        if (type === 'entrada') {
            typeLabel = 'ENTRADA'; typeBg = '#e6fffa'; typeColor = '#2c7a7b'; qtyColor = '#00b894'; qtyPrefix = '+';
            iconHtml = '<i class="fas fa-arrow-down" style="color:#00b894;font-size:0.75rem;"></i>';
        } else if (type === 'salida') {
            typeLabel = 'SALIDA'; typeBg = '#ffe5e5'; typeColor = '#d63031'; qtyColor = '#d63031'; qtyPrefix = '-';
            iconHtml = '<i class="fas fa-arrow-up" style="color:#d63031;font-size:0.75rem;"></i>';
        }
        let newQtyColor = '#00b894';
        if (Number(m.new_quantity) === 0) newQtyColor = '#d63031';
        else if (Number(m.new_quantity) <= (Number(m.min_stock_level) || 5)) newQtyColor = '#e67e22';

        // Desktop row
        if (tbody) {
            const tr = document.createElement('tr');
            if (type === 'entrada') tr.className = 'movement-row-entrada';
            else if (type === 'salida') tr.className = 'movement-row-salida';
            else tr.className = 'movement-row-ajuste';

            const tdIcon = document.createElement('td');
            const iconWrap = document.createElement('span');
            iconWrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:' + typeBg;
            iconWrap.innerHTML = iconHtml;
            tdIcon.appendChild(iconWrap);

            const tdDate = document.createElement('td');
            tdDate.textContent = dateStr;
            tdDate.style.fontSize = '0.85rem';
            tdDate.style.whiteSpace = 'nowrap';

            const tdType = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = 'status-badge';
            badge.style.background = typeBg;
            badge.style.color = typeColor;
            badge.textContent = typeLabel;
            tdType.appendChild(badge);

            const tdProduct = document.createElement('td');
            tdProduct.textContent = productName;

            const tdSku = document.createElement('td');
            tdSku.textContent = sku;
            tdSku.style.fontFamily = 'monospace';
            tdSku.style.fontSize = '0.8rem';

            const tdQty = document.createElement('td');
            const qtySpan = document.createElement('span');
            qtySpan.textContent = qtyPrefix + qtyNum;
            qtySpan.style.color = qtyColor;
            qtySpan.style.fontWeight = '600';
            tdQty.appendChild(qtySpan);

            const tdTransition = document.createElement('td');
            const prevSpan = document.createElement('span');
            prevSpan.textContent = prevQty;
            prevSpan.style.color = '#94a3b8';
            const arrowSpan = document.createElement('span');
            arrowSpan.textContent = ' → ';
            arrowSpan.style.color = '#64748b';
            arrowSpan.style.fontWeight = '600';
            const newSpan = document.createElement('strong');
            newSpan.textContent = newQty;
            newSpan.style.color = newQtyColor;
            tdTransition.appendChild(prevSpan);
            tdTransition.appendChild(arrowSpan);
            tdTransition.appendChild(newSpan);

            const tdReason = document.createElement('td');
            tdReason.textContent = reason;
            tdReason.style.fontSize = '0.85rem';
            tdReason.style.maxWidth = '200px';
            tdReason.style.overflow = 'hidden';
            tdReason.style.textOverflow = 'ellipsis';
            tdReason.style.whiteSpace = 'nowrap';

            const tdCreatedBy = document.createElement('td');
            tdCreatedBy.textContent = createdBy;
            tdCreatedBy.style.fontSize = '0.8rem';
            tdCreatedBy.style.color = '#64748b';
            tdCreatedBy.style.whiteSpace = 'nowrap';

            tr.appendChild(tdIcon);
            tr.appendChild(tdDate);
            tr.appendChild(tdType);
            tr.appendChild(tdProduct);
            tr.appendChild(tdSku);
            tr.appendChild(tdQty);
            tr.appendChild(tdTransition);
            tr.appendChild(tdReason);
            tr.appendChild(tdCreatedBy);
            tbody.appendChild(tr);
        }

        // Mobile card
        if (cardsContainer) {
            const card = document.createElement('div');
            card.className = 'mobile-card';
            card.innerHTML = `
                <div class="mobile-card-header">
                    <div class="mobile-card-status-wrap">
                        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:${typeBg};">${iconHtml}</span>
                        <span class="status-badge" style="background:${typeBg};color:${typeColor};font-size:0.75rem;">${typeLabel}</span>
                    </div>
                    <span style="font-size:0.8rem;color:#64748b;white-space:nowrap;">${dateStr}</span>
                </div>
                <div class="mobile-card-title" style="font-size:0.95rem;">${escapeHtml(productName)} <span style="font-family:monospace;font-size:0.8rem;color:#94a3b8;">${escapeHtml(sku)}</span></div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Cantidad</span>
                    <span class="mobile-card-value" style="color:${qtyColor};font-weight:700;">${qtyPrefix}${qtyNum}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Stock</span>
                    <span class="mobile-card-value"><span style="color:#94a3b8;">${prevQty}</span> <span style="color:#64748b;font-weight:600;">→</span> <strong style="color:${newQtyColor};">${newQty}</strong></span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Motivo</span>
                    <span class="mobile-card-value" style="font-size:0.85rem;">${escapeHtml(reason)}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Por</span>
                    <span class="mobile-card-value" style="font-size:0.85rem;color:#64748b;">${escapeHtml(createdBy)}</span>
                </div>
            `;
            cardsContainer.appendChild(card);
        }
    });
}

function setInvMode(mode) {
    currentInvMode = mode;
    const addSection = document.getElementById('inv-add-section');
    const removeSection = document.getElementById('inv-remove-section');
    const adjustSection = document.getElementById('inv-adjust-section');
    const addBtn = document.getElementById('inv-mode-add');
    const removeBtn = document.getElementById('inv-mode-remove');
    const adjustBtn = document.getElementById('inv-mode-adjust');

    if (addSection) addSection.style.display = mode === 'add' ? 'block' : 'none';
    if (removeSection) removeSection.style.display = mode === 'remove' ? 'block' : 'none';
    if (adjustSection) adjustSection.style.display = mode === 'adjust' ? 'block' : 'none';

    [addBtn, removeBtn, adjustBtn].forEach((btn) => {
        if (btn) {
            btn.style.background = 'white';
            btn.style.color = '#64748b';
        }
    });

    const activeBtn = mode === 'add' ? addBtn : mode === 'remove' ? removeBtn : adjustBtn;
    if (activeBtn) {
        activeBtn.style.background = 'var(--admin-primary)';
        activeBtn.style.color = 'white';
    }

    // Clear inputs
    const qtyAdd = document.getElementById('inv-modal-qty-add');
    const qtyRemove = document.getElementById('inv-modal-qty-remove');
    const newInput = document.getElementById('inv-modal-new');
    if (qtyAdd) qtyAdd.value = '';
    if (qtyRemove) qtyRemove.value = '';
    if (newInput) newInput.value = '';

    updateInvPreview();
}

function updateInvPreview() {
    const preview = document.getElementById('inv-preview');
    const currentDisplay = document.getElementById('inv-inv-current-val');
    const currentNum = Number(document.getElementById('inv-modal-current') ? document.getElementById('inv-modal-current').value : 0);
    const previewCurrent = document.getElementById('inv-preview-current');
    const previewNew = document.getElementById('inv-preview-new');

    if (!preview || !previewCurrent || !previewNew) return;

    let newQty = null;
    if (currentInvMode === 'add') {
        const addQty = Number(document.getElementById('inv-modal-qty-add') ? document.getElementById('inv-modal-qty-add').value : 0);
        if (addQty > 0) newQty = currentNum + addQty;
    } else if (currentInvMode === 'remove') {
        const removeQty = Number(document.getElementById('inv-modal-qty-remove') ? document.getElementById('inv-modal-qty-remove').value : 0);
        if (removeQty > 0) newQty = Math.max(0, currentNum - removeQty);
    } else {
        const adjustQty = Number(document.getElementById('inv-modal-new') ? document.getElementById('inv-modal-new').value : -1);
        if (adjustQty >= 0) newQty = adjustQty;
    }

    if (newQty !== null) {
        preview.style.display = 'block';
        previewCurrent.textContent = String(currentNum);
        previewNew.textContent = String(newQty);
        if (newQty === 0) previewNew.style.color = '#d63031';
        else if (newQty <= (Number(document.getElementById('inv-modal-min') ? document.getElementById('inv-modal-min').value : 5))) previewNew.style.color = '#e67e22';
        else previewNew.style.color = '#00b894';
    } else {
        preview.style.display = 'none';
    }
}

function openInventoryModal(item, mode) {
    const modal = document.getElementById('inventory-modal');
    const skuInput = document.getElementById('inv-modal-sku');
    const skuDisplay = document.getElementById('inv-modal-sku-display');
    const productInput = document.getElementById('inv-modal-product');
    const currentInput = document.getElementById('inv-modal-current');
    const currentDisplay = document.getElementById('inv-modal-current-display');
    const reasonInput = document.getElementById('inv-modal-reason');
    const errorEl = document.getElementById('inv-modal-error');

    currentInventoryModalSku = toSafeText(item.sku);

    if (skuInput) skuInput.value = currentInventoryModalSku;
    if (skuDisplay) skuDisplay.textContent = currentInventoryModalSku;
    if (productInput) productInput.value = toSafeText(item.product_name);
    const qty = Number(item.quantity) || 0;
    if (currentInput) currentInput.value = String(qty);
    if (currentDisplay) currentDisplay.textContent = String(qty);
    if (reasonInput) reasonInput.value = '';
    if (errorEl) errorEl.style.display = 'none';

    setInvMode(mode || 'add');
    updateInvPreview();

    if (modal) modal.style.display = 'flex';
}

function closeInventoryModal() {
    const modal = document.getElementById('inventory-modal');
    if (modal) modal.style.display = 'none';
    currentInventoryModalSku = null;
}

async function saveInventoryAdjustment() {
    if (!currentInventoryModalSku) return;

    const token = localStorage.getItem('admin_token');
    const currentQty = Number(document.getElementById('inv-modal-current') ? document.getElementById('inv-modal-current').value : 0);
    const reasonInput = document.getElementById('inv-modal-reason');
    const errorEl = document.getElementById('inv-modal-error');
    const btn = document.getElementById('btn-save-inventory');

    let endpoint = '';
    let body = {};

    if (currentInvMode === 'add') {
        const addQty = Number(document.getElementById('inv-modal-qty-add') ? document.getElementById('inv-modal-qty-add').value : 0);
        if (!Number.isInteger(addQty) || addQty <= 0) {
            if (errorEl) { errorEl.textContent = 'La cantidad debe ser un número entero mayor a 0.'; errorEl.style.display = 'block'; }
            return;
        }
        endpoint = '/api/inventory/entry';
        body = { sku: currentInventoryModalSku, quantity: addQty, reason: toSafeText(reasonInput ? reasonInput.value : '') || 'Ingreso de stock desde panel' };
    } else if (currentInvMode === 'remove') {
        const removeQty = Number(document.getElementById('inv-modal-qty-remove') ? document.getElementById('inv-modal-qty-remove').value : 0);
        if (!Number.isInteger(removeQty) || removeQty <= 0) {
            if (errorEl) { errorEl.textContent = 'La cantidad debe ser un número entero mayor a 0.'; errorEl.style.display = 'block'; }
            return;
        }
        if (removeQty > currentQty) {
            if (errorEl) { errorEl.textContent = `Solo hay ${currentQty} unidades disponibles. Usa "Ajustar" para establecer un valor exacto.`; errorEl.style.display = 'block'; }
            return;
        }
        endpoint = '/api/inventory/adjust';
        body = { sku: currentInventoryModalSku, quantity: currentQty - removeQty, reason: toSafeText(reasonInput ? reasonInput.value : '') || 'Salida de stock desde panel' };
    } else {
        const newQty = Number(document.getElementById('inv-modal-new') ? document.getElementById('inv-modal-new').value : NaN);
        if (!Number.isInteger(newQty) || newQty < 0) {
            if (errorEl) { errorEl.textContent = 'La cantidad debe ser un número entero mayor o igual a 0.'; errorEl.style.display = 'block'; }
            return;
        }
        endpoint = '/api/inventory/adjust';
        body = { sku: currentInventoryModalSku, quantity: newQty, reason: toSafeText(reasonInput ? reasonInput.value : '') || 'Ajuste manual desde panel admin' };
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                clearAdminSession();
                return;
            }
            const eData = await res.json();
            throw new Error(eData.error || 'Error al guardar');
        }

        closeInventoryModal();
        loadInventory();
        loadMovements();
    } catch (err) {
        if (errorEl) { errorEl.textContent = err.message; errorEl.style.display = 'block'; }
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
    }
}

function filterInventoryTable() {
    applyInventoryFilters();
}

// ─── Users Module ─────────────────────────────────────────────────────────────

let adminUsers = [];

async function loadUsers() {
    try {
        const res = await apiFetch('/api/users');
        const data = await res.json();
        adminUsers = Array.isArray(data) ? data : [];
        renderUsersTable(adminUsers);
    } catch (err) {
        console.error('Error loading users', err);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-tbody');
    const cardsContainer = document.getElementById('users-cards');
    if (!tbody && !cardsContainer) return;
    if (tbody) tbody.textContent = '';
    if (cardsContainer) cardsContainer.textContent = '';

    if (!Array.isArray(users) || users.length === 0) {
        if (tbody) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7;
            td.style.textAlign = 'center';
            td.style.padding = '2rem';
            td.style.color = '#94a3b8';
            td.textContent = 'No hay usuarios registrados.';
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        if (cardsContainer) {
            cardsContainer.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8;">No hay usuarios registrados.</div>';
        }
        return;
    }

    users.forEach((user) => {
        const role = toSafeText(user.role).toLowerCase();
        let roleLabel = role;
        let roleBg = '#e2e8f0';
        let roleColor = '#64748b';
        if (role === 'admin') { roleLabel = 'Admin'; roleBg = '#e8f4fd'; roleColor = '#2b6cb0'; }
        else if (role === 'vendedor') { roleLabel = 'Vendedor'; roleBg = '#e6fffa'; roleColor = '#2c7a7b'; }
        else if (role === 'operador_pedidos') { roleLabel = 'Op. Pedidos'; roleBg = '#fff8e6'; roleColor = '#b7791f'; }
        else if (role === 'operador_stock') { roleLabel = 'Op. Stock'; roleBg = '#fdf2f7'; roleColor = '#c2185b'; }

        const activeLabel = user.is_active ? 'Activo' : 'Inactivo';
        const activeBg = user.is_active ? '#e6fffa' : '#ffe5e5';
        const activeColor = user.is_active ? '#2c7a7b' : '#d63031';

        // Desktop table row
        if (tbody) {
            const tr = document.createElement('tr');

            const tdId = document.createElement('td');
            tdId.textContent = String(user.id);

            const tdUsername = document.createElement('td');
            tdUsername.textContent = toSafeText(user.username);

            const tdName = document.createElement('td');
            tdName.textContent = toSafeText(user.name);

            const tdEmail = document.createElement('td');
            tdEmail.textContent = toSafeText(user.email) || '-';
            tdEmail.style.fontSize = '0.85rem';

            const tdRole = document.createElement('td');
            const roleBadge = document.createElement('span');
            roleBadge.className = 'status-badge';
            roleBadge.style.background = roleBg;
            roleBadge.style.color = roleColor;
            roleBadge.textContent = roleLabel;
            tdRole.appendChild(roleBadge);

            const tdActive = document.createElement('td');
            const activeBadge = document.createElement('span');
            activeBadge.className = 'status-badge';
            activeBadge.style.background = activeBg;
            activeBadge.style.color = activeColor;
            activeBadge.textContent = activeLabel;
            tdActive.appendChild(activeBadge);

            const tdActions = document.createElement('td');
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.gap = '0.4rem';
            wrap.style.justifyContent = 'center';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-outline';
            editBtn.style.padding = '0.3rem 0.5rem';
            editBtn.style.fontSize = '0.8rem';
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.title = 'Editar usuario';
            editBtn.addEventListener('click', () => editUser(user));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-primary';
            deleteBtn.style.padding = '0.3rem 0.5rem';
            deleteBtn.style.fontSize = '0.8rem';
            deleteBtn.style.background = 'red';
            deleteBtn.style.border = 'none';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.title = 'Eliminar usuario';
            deleteBtn.addEventListener('click', () => deleteUserAction(user.id, user.username));

            wrap.appendChild(editBtn);
            wrap.appendChild(deleteBtn);
            tdActions.appendChild(wrap);

            tr.appendChild(tdId);
            tr.appendChild(tdUsername);
            tr.appendChild(tdName);
            tr.appendChild(tdEmail);
            tr.appendChild(tdRole);
            tr.appendChild(tdActive);
            tr.appendChild(tdActions);
            tbody.appendChild(tr);
        }

        // Mobile card
        if (cardsContainer) {
            const card = document.createElement('div');
            card.className = 'mobile-card';
            card.innerHTML = `
                <div class="mobile-card-header">
                    <div>
                        <div class="mobile-card-title">${escapeHtml(toSafeText(user.name) || 'Sin nombre')}</div>
                        <div style="font-size:0.85rem;color:#64748b;">@${escapeHtml(toSafeText(user.username))}</div>
                    </div>
                    <span class="status-badge" style="background:${activeBg};color:${activeColor};">${activeLabel}</span>
                </div>
                <div class="mobile-card-meta">
                    <span><i class="fas fa-envelope" style="font-size:0.75rem;"></i> ${escapeHtml(toSafeText(user.email) || '-')}</span>
                    <span><i class="fas fa-id-badge" style="font-size:0.75rem;"></i> ID: ${user.id}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Rol</span>
                    <span class="mobile-card-value"><span class="status-badge" style="background:${roleBg};color:${roleColor};font-size:0.75rem;">${roleLabel}</span></span>
                </div>
                <div class="mobile-card-actions" id="user-card-actions-${user.id}"></div>
            `;
            const actionWrap = card.querySelector(`#user-card-actions-${user.id}`);
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-outline';
            editBtn.type = 'button';
            editBtn.innerHTML = '<i class="fas fa-edit"></i> Editar';
            editBtn.addEventListener('click', () => editUser(user));
            actionWrap.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-outline';
            deleteBtn.type = 'button';
            deleteBtn.style.color = '#d63031';
            deleteBtn.style.borderColor = '#fecaca';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
            deleteBtn.addEventListener('click', () => deleteUserAction(user.id, user.username));
            actionWrap.appendChild(deleteBtn);

            cardsContainer.appendChild(card);
        }
    });
}

function togglePasswordEdit() {
    const checkbox = document.getElementById('user-change-password');
    const passGroup = document.getElementById('user-password-group');
    const passInput = document.getElementById('user-password');
    const passLabel = document.getElementById('user-password-label');
    const passHint = document.getElementById('user-password-hint');

    if (!checkbox || !passGroup || !passInput) return;

    if (checkbox.checked) {
        passGroup.style.display = 'block';
        passInput.required = true;
        passInput.value = '';
        if (passLabel) passLabel.innerHTML = 'Nueva contraseña <span style="color:#d63031">*</span>';
        if (passHint) passHint.textContent = 'Mínimo 6 caracteres';
    } else {
        passGroup.style.display = 'none';
        passInput.required = false;
        passInput.value = '';
    }
}

function openUserModal() {
    const form = document.getElementById('user-form');
    const title = document.getElementById('user-modal-title');
    const idInput = document.getElementById('user-id');
    const usernameInput = document.getElementById('user-username');
    const passToggle = document.getElementById('user-password-toggle');
    const changePassCheck = document.getElementById('user-change-password');
    const passGroup = document.getElementById('user-password-group');
    const passInput = document.getElementById('user-password');
    const passLabel = document.getElementById('user-password-label');
    const passHint = document.getElementById('user-password-hint');
    const errorEl = document.getElementById('user-error');

    if (form) form.reset();
    if (title) title.textContent = 'Nuevo Usuario';
    if (idInput) idInput.value = '';
    if (usernameInput) usernameInput.readOnly = false;

    // Hide "change password" toggle for new users
    if (passToggle) passToggle.style.display = 'none';
    if (changePassCheck) changePassCheck.checked = false;

    // Always show password field for new users
    if (passGroup) passGroup.style.display = 'block';
    if (passInput) { passInput.required = true; passInput.value = ''; }
    if (passLabel) passLabel.innerHTML = 'Contraseña <span style="color:#d63031">*</span>';
    if (passHint) passHint.textContent = 'Mínimo 6 caracteres';

    if (errorEl) errorEl.style.display = 'none';

    const modal = document.getElementById('user-modal');
    if (modal) modal.style.display = 'flex';
}

function closeUserModal() {
    const modal = document.getElementById('user-modal');
    if (modal) modal.style.display = 'none';
}

function editUser(user) {
    const form = document.getElementById('user-form');
    const title = document.getElementById('user-modal-title');
    const idInput = document.getElementById('user-id');
    const usernameInput = document.getElementById('user-username');
    const nameInput = document.getElementById('user-name');
    const emailInput = document.getElementById('user-email');
    const roleInput = document.getElementById('user-role');
    const activeInput = document.getElementById('user-active');
    const passToggle = document.getElementById('user-password-toggle');
    const changePassCheck = document.getElementById('user-change-password');
    const passGroup = document.getElementById('user-password-group');
    const passInput = document.getElementById('user-password');
    const passLabel = document.getElementById('user-password-label');
    const passHint = document.getElementById('user-password-hint');
    const errorEl = document.getElementById('user-error');

    if (form) form.reset();
    if (title) title.textContent = 'Editar Usuario';
    if (idInput) idInput.value = String(user.id);
    if (usernameInput) { usernameInput.value = toSafeText(user.username); usernameInput.readOnly = true; }
    if (nameInput) nameInput.value = toSafeText(user.name);
    if (emailInput) emailInput.value = toSafeText(user.email);
    if (roleInput) roleInput.value = toSafeText(user.role);
    if (activeInput) activeInput.value = user.is_active ? '1' : '0';

    // Show "change password" toggle for edit mode
    if (passToggle) passToggle.style.display = 'block';
    if (changePassCheck) changePassCheck.checked = false;

    // Hide password field by default in edit mode
    if (passGroup) passGroup.style.display = 'none';
    if (passInput) { passInput.required = false; passInput.value = ''; }
    if (passLabel) passLabel.innerHTML = 'Nueva contraseña <span style="color:#d63031">*</span>';
    if (passHint) passHint.textContent = 'Mínimo 6 caracteres';

    if (errorEl) errorEl.style.display = 'none';

    const modal = document.getElementById('user-modal');
    if (modal) modal.style.display = 'flex';
}

async function saveUser(e) {
    e.preventDefault();
    const token = localStorage.getItem('admin_token');
    const idInput = document.getElementById('user-id');
    const usernameInput = document.getElementById('user-username');
    const nameInput = document.getElementById('user-name');
    const emailInput = document.getElementById('user-email');
    const roleInput = document.getElementById('user-role');
    const activeInput = document.getElementById('user-active');
    const passInput = document.getElementById('user-password');
    const changePassCheck = document.getElementById('user-change-password');
    const errorEl = document.getElementById('user-error');
    const btn = document.getElementById('btn-save-user');

    if (errorEl) errorEl.style.display = 'none';

    const isEdit = idInput && idInput.value;
    const body = {
        name: toSafeText(nameInput ? nameInput.value : ''),
        email: toSafeText(emailInput ? emailInput.value : '') || null,
        role: toSafeText(roleInput ? roleInput.value : 'vendedor'),
        is_active: activeInput ? activeInput.value === '1' : true
    };

    if (!isEdit) {
        body.username = toSafeText(usernameInput ? usernameInput.value : '');
        body.password = toSafeText(passInput ? passInput.value : '');
        if (!body.username || !body.password) {
            if (errorEl) { errorEl.textContent = 'Usuario y contraseña son requeridos.'; errorEl.style.display = 'block'; }
            return;
        }
        if (body.password.length < 6) {
            if (errorEl) { errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; errorEl.style.display = 'block'; }
            return;
        }
    } else {
        // Only send password if "change password" is checked
        if (changePassCheck && changePassCheck.checked) {
            const pass = toSafeText(passInput ? passInput.value : '');
            if (!pass) {
                if (errorEl) { errorEl.textContent = 'Ingresa la nueva contraseña o desmarca "Cambiar contraseña".'; errorEl.style.display = 'block'; }
                return;
            }
            if (pass.length < 6) {
                if (errorEl) { errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; errorEl.style.display = 'block'; }
                return;
            }
            body.password = pass;
        }
    }

    const url = isEdit ? `/api/users/${encodeURIComponent(idInput.value)}` : '/api/users';
    const method = isEdit ? 'PUT' : 'POST';

    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                clearAdminSession();
                return;
            }
            const data = await res.json();
            throw new Error(data.error || 'Error al guardar usuario');
        }

        closeUserModal();
        loadUsers();
    } catch (err) {
        if (errorEl) { errorEl.textContent = err.message; errorEl.style.display = 'block'; }
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = isEdit ? 'Guardar Cambios' : 'Guardar Usuario'; }
    }
}

async function deleteUserAction(id, username) {
    if (!window.confirm(`¿Estás seguro de eliminar al usuario "${toSafeText(username)}"?`)) return;
    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) { clearAdminSession(); return; }
            const data = await res.json();
            alert(data.error || 'Error al eliminar usuario');
            return;
        }
        loadUsers();
    } catch (err) {
        alert('Error de conexión: ' + err.message);
    }
}

// ─── Customers Module ─────────────────────────────────────────────────────────

let adminCustomers = [];
let currentCustomerDetail = null;

async function loadCustomers() {
    try {
        const res = await apiFetch('/api/customers');
        const data = await res.json();
        adminCustomers = Array.isArray(data) ? data : [];
        renderCustomersTable();
    } catch (err) {
        console.error('Error loading customers', err);
    }
}

function renderCustomersTable() {
    const tbody = document.getElementById('customers-tbody');
    const cardsContainer = document.getElementById('customers-cards');
    if (!tbody && !cardsContainer) return;
    if (tbody) tbody.textContent = '';
    if (cardsContainer) cardsContainer.textContent = '';

    const searchInput = document.getElementById('search-customer');
    const query = toSafeText(searchInput ? searchInput.value : '').toLowerCase();

    const filtered = adminCustomers.filter((c) => {
        const name = toSafeText(c.name).toLowerCase();
        const phone = toSafeText(c.phone).toLowerCase();
        const city = toSafeText(c.city).toLowerCase();
        const email = toSafeText(c.email).toLowerCase();
        return name.includes(query) || phone.includes(query) || city.includes(query) || email.includes(query);
    });

    if (filtered.length === 0) {
        const emptyMsg = adminCustomers.length === 0 ? 'No hay clientes registrados todavía.' : 'No se encontraron clientes.';
        if (tbody) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 8;
            td.style.textAlign = 'center';
            td.style.padding = '2rem';
            td.style.color = '#94a3b8';
            td.textContent = emptyMsg;
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        if (cardsContainer) {
            cardsContainer.innerHTML = `<div style="text-align:center;padding:2rem;color:#94a3b8;">${emptyMsg}</div>`;
        }
        return;
    }

    filtered.forEach((c) => {
        const name = toSafeText(c.name) || '-';
        const phone = toSafeText(c.phone) || '-';
        const email = toSafeText(c.email) || '-';
        const city = toSafeText(c.city) || '-';
        const orderCount = Number(c.order_count) || 0;
        const totalSpent = `Q${toSafeMoney(c.total_spent).toFixed(2)}`;

        // Desktop table row
        if (tbody) {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', () => openCustomerDetailModal(c.id));

            const tdId = document.createElement('td');
            tdId.textContent = c.id;
            tdId.style.fontFamily = 'monospace';
            tdId.style.fontSize = '0.85rem';

            const tdName = document.createElement('td');
            tdName.textContent = name;
            tdName.style.fontWeight = '600';

            const tdPhone = document.createElement('td');
            tdPhone.textContent = phone;

            const tdEmail = document.createElement('td');
            tdEmail.textContent = email;
            tdEmail.style.fontSize = '0.85rem';

            const tdCity = document.createElement('td');
            tdCity.textContent = city;

            const tdOrders = document.createElement('td');
            tdOrders.style.textAlign = 'center';
            tdOrders.textContent = orderCount;
            tdOrders.style.fontWeight = '700';

            const tdTotal = document.createElement('td');
            tdTotal.style.textAlign = 'center';
            tdTotal.textContent = totalSpent;

            const tdActions = document.createElement('td');
            tdActions.style.textAlign = 'center';
            tdActions.style.whiteSpace = 'nowrap';
            const wrap = document.createElement('div');
            wrap.className = 'action-btns-wrap';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-outline';
            editBtn.style.padding = '0.45rem 0.6rem';
            editBtn.style.fontSize = '0.8rem';
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.title = 'Editar';
            editBtn.addEventListener('click', (e) => { e.stopPropagation(); openCustomerModal(c.id); });

            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-outline';
            delBtn.style.padding = '0.45rem 0.6rem';
            delBtn.style.fontSize = '0.8rem';
            delBtn.style.color = '#d63031';
            delBtn.style.borderColor = '#fecaca';
            delBtn.innerHTML = '<i class="fas fa-trash"></i>';
            delBtn.title = 'Eliminar';
            delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteCustomerAction(c.id, c.name); });

            wrap.appendChild(editBtn);
            wrap.appendChild(delBtn);
            tdActions.appendChild(wrap);

            tr.appendChild(tdId);
            tr.appendChild(tdName);
            tr.appendChild(tdPhone);
            tr.appendChild(tdEmail);
            tr.appendChild(tdCity);
            tr.appendChild(tdOrders);
            tr.appendChild(tdTotal);
            tr.appendChild(tdActions);
            tbody.appendChild(tr);
        }

        // Mobile card
        if (cardsContainer) {
            const card = document.createElement('div');
            card.className = 'mobile-card';
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => openCustomerDetailModal(c.id));
            card.innerHTML = `
                <div class="mobile-card-customer-name">${escapeHtml(name)}</div>
                <div class="mobile-card-customer-contact">
                    ${phone !== '-' ? `<span><i class="fas fa-phone" style="font-size:0.75rem;"></i> ${escapeHtml(phone)}</span> &middot; ` : ''}
                    ${city !== '-' ? `<span><i class="fas fa-map-marker-alt" style="font-size:0.75rem;"></i> ${escapeHtml(city)}</span>` : ''}
                </div>
                <div class="mobile-card-meta" style="margin-top:0.5rem;">
                    ${email !== '-' ? `<span><i class="fas fa-envelope" style="font-size:0.75rem;"></i> ${escapeHtml(email)}</span>` : ''}
                </div>
                <div style="display:flex;gap:1rem;margin-top:0.6rem;">
                    <div style="text-align:center;">
                        <div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Pedidos</div>
                        <div style="font-size:1.3rem;font-weight:700;color:#1a202c;">${orderCount}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Total</div>
                        <div style="font-size:1.3rem;font-weight:700;color:var(--secondary-color);">${totalSpent}</div>
                    </div>
                </div>
                <div class="mobile-card-actions" id="customer-card-actions-${c.id}" style="margin-top:0.7rem;"></div>
            `;
            const actionWrap = card.querySelector(`#customer-card-actions-${c.id}`);
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-outline';
            editBtn.type = 'button';
            editBtn.innerHTML = '<i class="fas fa-edit"></i> Editar';
            editBtn.addEventListener('click', (e) => { e.stopPropagation(); openCustomerModal(c.id); });
            actionWrap.appendChild(editBtn);

            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-outline';
            delBtn.type = 'button';
            delBtn.style.color = '#d63031';
            delBtn.style.borderColor = '#fecaca';
            delBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
            delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteCustomerAction(c.id, c.name); });
            actionWrap.appendChild(delBtn);

            cardsContainer.appendChild(card);
        }
    });
}

function openCustomerModal(id) {
    const modal = document.getElementById('customer-modal');
    const title = document.getElementById('customer-modal-title');
    const form = document.getElementById('customer-form');
    const errorDiv = document.getElementById('customer-error');
    const btn = document.getElementById('btn-save-customer');

    if (!modal || !form) return;

    form.reset();
    if (errorDiv) errorDiv.style.display = 'none';
    document.getElementById('customer-id').value = '';

    if (id) {
        const customer = adminCustomers.find((c) => String(c.id) === String(id));
        if (!customer) return;
        title.textContent = 'Editar Cliente';
        document.getElementById('customer-id').value = customer.id;
        document.getElementById('customer-name').value = toSafeText(customer.name);
        document.getElementById('customer-phone').value = toSafeText(customer.phone);
        document.getElementById('customer-email').value = toSafeText(customer.email);
        document.getElementById('customer-address').value = toSafeText(customer.address);
        document.getElementById('customer-city').value = toSafeText(customer.city);
        document.getElementById('customer-notes').value = toSafeText(customer.notes);
        btn.textContent = 'Guardar Cambios';
    } else {
        title.textContent = 'Nuevo Cliente';
        btn.textContent = 'Guardar Cliente';
    }

    modal.style.display = 'flex';
}

function closeCustomerModal() {
    const modal = document.getElementById('customer-modal');
    if (modal) modal.style.display = 'none';
}

async function saveCustomer(e) {
    if (e) e.preventDefault();
    const token = localStorage.getItem('admin_token');
    const id = document.getElementById('customer-id').value;
    const errorDiv = document.getElementById('customer-error');

    const body = {
        name: toSafeText(document.getElementById('customer-name').value),
        phone: toSafeText(document.getElementById('customer-phone').value),
        email: toSafeText(document.getElementById('customer-email').value) || null,
        address: toSafeText(document.getElementById('customer-address').value) || null,
        city: toSafeText(document.getElementById('customer-city').value) || null,
        notes: toSafeText(document.getElementById('customer-notes').value) || null
    };

    if (!body.name || !body.phone) {
        if (errorDiv) {
            errorDiv.textContent = 'Nombre y teléfono son obligatorios.';
            errorDiv.style.display = 'block';
        }
        return;
    }

    try {
        const url = id ? `/api/customers/${encodeURIComponent(id)}` : '/api/customers';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) { clearAdminSession(); return; }
            const data = await res.json();
            if (errorDiv) {
                errorDiv.textContent = data.error || 'Error al guardar cliente';
                errorDiv.style.display = 'block';
            }
            return;
        }

        closeCustomerModal();
        loadCustomers();
    } catch (err) {
        if (errorDiv) {
            errorDiv.textContent = 'Error de conexión: ' + err.message;
            errorDiv.style.display = 'block';
        }
    }
}

async function deleteCustomerAction(id, name) {
    if (!window.confirm(`¿Estás seguro de eliminar al cliente "${toSafeText(name)}"?`)) return;
    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`/api/customers/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) { clearAdminSession(); return; }
            const data = await res.json();
            alert(data.error || 'Error al eliminar cliente');
            return;
        }
        loadCustomers();
    } catch (err) {
        alert('Error de conexión: ' + err.message);
    }
}

async function openCustomerDetailModal(id) {
    const modal = document.getElementById('customer-detail-modal');
    if (!modal) return;

    const customer = adminCustomers.find((c) => String(c.id) === String(id));
    if (!customer) return;

    currentCustomerDetail = customer;

    document.getElementById('cd-name').textContent = toSafeText(customer.name) || '-';
    document.getElementById('cd-phone').textContent = toSafeText(customer.phone) || '-';

    const emailRow = document.getElementById('cd-email-row');
    const emailSpan = document.getElementById('cd-email');
    if (customer.email) {
        emailSpan.textContent = toSafeText(customer.email);
        emailRow.style.display = '';
    } else {
        emailRow.style.display = 'none';
    }

    const addressRow = document.getElementById('cd-address-row');
    const addressSpan = document.getElementById('cd-address');
    if (customer.address) {
        addressSpan.textContent = toSafeText(customer.address);
        addressRow.style.display = '';
    } else {
        addressRow.style.display = 'none';
    }

    const cityRow = document.getElementById('cd-city-row');
    const citySpan = document.getElementById('cd-city');
    if (customer.city) {
        citySpan.textContent = toSafeText(customer.city);
        cityRow.style.display = '';
    } else {
        cityRow.style.display = 'none';
    }

    const notesRow = document.getElementById('cd-notes-row');
    const notesSpan = document.getElementById('cd-notes');
    if (customer.notes) {
        notesSpan.textContent = toSafeText(customer.notes);
        notesRow.style.display = '';
    } else {
        notesRow.style.display = 'none';
    }

    document.getElementById('cd-order-count').textContent = Number(customer.order_count) || 0;
    document.getElementById('cd-total-spent').textContent = `Q${toSafeMoney(customer.total_spent).toFixed(2)}`;

    // Cargar pedidos del cliente
    const token = localStorage.getItem('admin_token');
    const ordersSection = document.getElementById('cd-orders-section');
    const noOrdersDiv = document.getElementById('cd-no-orders');
    const ordersTbody = document.getElementById('cd-orders-tbody');

    try {
        const res = await fetch(`/api/customers/${encodeURIComponent(id)}/orders`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401 || res.status === 403) {
            clearAdminSession();
            return;
        }
        const orders = await res.json();
        ordersTbody.textContent = '';

        if (Array.isArray(orders) && orders.length > 0) {
            ordersSection.style.display = '';
            noOrdersDiv.style.display = 'none';
            orders.forEach((o) => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', () => {
                    closeCustomerDetailModal();
                    openOrderModal(o.id);
                });

                const tdId = document.createElement('td');
                tdId.textContent = o.id;
                tdId.style.fontFamily = 'monospace';
                tdId.style.fontSize = '0.85rem';

                const tdDate = document.createElement('td');
                tdDate.textContent = formatOrderDate(o.created_at);
                tdDate.style.fontSize = '0.85rem';
                tdDate.style.whiteSpace = 'nowrap';

                const tdStatus = document.createElement('td');
                const statusBadge = document.createElement('span');
                statusBadge.className = `status-badge status-${normalizeStatus(o.status)}`;
                statusBadge.textContent = normalizeStatus(o.status);
                tdStatus.appendChild(statusBadge);

                const tdTotal = document.createElement('td');
                tdTotal.textContent = `Q${toSafeMoney(o.total).toFixed(2)}`;
                tdTotal.style.fontWeight = '600';

                tr.appendChild(tdId);
                tr.appendChild(tdDate);
                tr.appendChild(tdStatus);
                tr.appendChild(tdTotal);
                ordersTbody.appendChild(tr);
            });
        } else {
            ordersSection.style.display = 'none';
            noOrdersDiv.style.display = 'block';
        }
    } catch (err) {
        console.error('Error loading customer orders', err);
        ordersSection.style.display = 'none';
        noOrdersDiv.style.display = 'block';
    }

    modal.style.display = 'flex';
}

function closeCustomerDetailModal() {
    const modal = document.getElementById('customer-detail-modal');
    if (modal) modal.style.display = 'none';
    currentCustomerDetail = null;
}

function openCustomerModalFromDetail() {
    if (!currentCustomerDetail) return;
    closeCustomerDetailModal();
    openCustomerModal(currentCustomerDetail.id);
}

// ─── Audit Module ─────────────────────────────────────────────────────────────

let adminAuditLogs = [];
let currentAuditView = 'logs';

function setAuditView(view) {
    currentAuditView = view;
    const logsSection = document.getElementById('audit-logs-section');
    const movementsSection = document.getElementById('audit-movements-section');
    const btnLogs = document.getElementById('btn-audit-logs');
    const btnMovements = document.getElementById('btn-audit-movements');

    if (!logsSection || !movementsSection) return;

    if (view === 'logs') {
        logsSection.style.display = '';
        movementsSection.style.display = 'none';
        if (btnLogs) { btnLogs.className = 'btn btn-sm'; btnLogs.style.background = 'var(--secondary-color)'; btnLogs.style.color = '#fff'; }
        if (btnMovements) { btnMovements.className = 'btn btn-outline'; btnMovements.style.background = ''; btnMovements.style.color = ''; }
        loadAuditLogs();
    } else {
        logsSection.style.display = 'none';
        movementsSection.style.display = '';
        if (btnLogs) { btnLogs.className = 'btn btn-outline'; btnLogs.style.background = ''; btnLogs.style.color = ''; }
        if (btnMovements) { btnMovements.className = 'btn btn-sm'; btnMovements.style.background = 'var(--secondary-color)'; btnMovements.style.color = '#fff'; }
        loadMovements();
    }
}

async function loadAuditLogs() {
    const tableFilter = document.getElementById('audit-table-filter');
    const actionFilter = document.getElementById('audit-action-filter');
    const table = tableFilter ? tableFilter.value : '';
    const action = actionFilter ? actionFilter.value : '';

    try {
        let url = '/api/audit?limit=100&offset=0';
        if (table) url += `&table=${encodeURIComponent(table)}`;
        if (action) url += `&action=${encodeURIComponent(action)}`;
        const res = await apiFetch(url);
        const data = await res.json();
        adminAuditLogs = data.logs || [];
        renderAuditTable(adminAuditLogs);
    } catch (err) {
        console.error('Error loading audit logs', err);
    }
}

function renderAuditTable(logs) {
    const tbody = document.getElementById('audit-tbody');
    const cardsContainer = document.getElementById('audit-cards');
    if (!tbody && !cardsContainer) return;
    if (tbody) tbody.textContent = '';
    if (cardsContainer) cardsContainer.textContent = '';

    if (!Array.isArray(logs) || logs.length === 0) {
        if (tbody) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            td.style.textAlign = 'center';
            td.style.padding = '2rem';
            td.style.color = '#94a3b8';
            td.textContent = 'No hay registros de auditoría.';
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        if (cardsContainer) {
            cardsContainer.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8;">No hay registros de auditoría.</div>';
        }
        return;
    }

    logs.forEach((log) => {
        const table = toSafeText(log.table_name);
        const action = toSafeText(log.action).toLowerCase();
        const recordId = toSafeText(log.record_id);
        const changedBy = toSafeText(log.changed_by) || '-';
        const dateStr = formatOrderDate(log.changed_at);

        let tableLabel = table;
        let tableBg = '#e2e8f0';
        let tableColor = '#64748b';
        if (table === 'products') { tableLabel = 'Productos'; tableBg = '#e8f4fd'; tableColor = '#2b6cb0'; }
        else if (table === 'orders') { tableLabel = 'Pedidos'; tableBg = '#e6fffa'; tableColor = '#2c7a7b'; }
        else if (table === 'inventory') { tableLabel = 'Inventario'; tableBg = '#fff8e6'; tableColor = '#b7791f'; }
        else if (table === 'users') { tableLabel = 'Usuarios'; tableBg = '#fdf2f7'; tableColor = '#c2185b'; }

        let actionLabel = action;
        let actionBg = '#e2e8f0';
        let actionColor = '#64748b';
        if (action === 'create') { actionLabel = 'Crear'; actionBg = '#e6fffa'; actionColor = '#2c7a7b'; }
        else if (action === 'update') { actionLabel = 'Actualizar'; actionBg = '#fff8e6'; actionColor = '#b7791f'; }
        else if (action === 'delete') { actionLabel = 'Eliminar'; actionBg = '#ffe5e5'; actionColor = '#d63031'; }

        // Desktop row
        if (tbody) {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', () => openAuditDetailModal(log));

            const tdDate = document.createElement('td');
            tdDate.textContent = dateStr;
            tdDate.style.fontSize = '0.85rem';
            tdDate.style.whiteSpace = 'nowrap';

            const tdTable = document.createElement('td');
            const tableBadge = document.createElement('span');
            tableBadge.className = 'status-badge';
            tableBadge.style.fontSize = '0.65rem';
            tableBadge.style.background = tableBg;
            tableBadge.style.color = tableColor;
            tableBadge.textContent = tableLabel;
            tdTable.appendChild(tableBadge);

            const tdAction = document.createElement('td');
            const actionBadge = document.createElement('span');
            actionBadge.className = 'status-badge';
            actionBadge.style.fontSize = '0.65rem';
            actionBadge.style.background = actionBg;
            actionBadge.style.color = actionColor;
            actionBadge.textContent = actionLabel;
            tdAction.appendChild(actionBadge);

            const tdRecord = document.createElement('td');
            const recordText = document.createElement('span');
            recordText.textContent = recordId;
            recordText.style.fontFamily = 'monospace';
            recordText.style.fontSize = '0.8rem';
            const detailHint = document.createElement('span');
            detailHint.textContent = ' (click para ver)';
            detailHint.style.fontSize = '0.7rem';
            detailHint.style.color = '#94a3b8';
            tdRecord.appendChild(recordText);
            tdRecord.appendChild(detailHint);

            const tdBy = document.createElement('td');
            tdBy.textContent = changedBy;
            tdBy.style.fontSize = '0.85rem';

            const tdActionBtn = document.createElement('td');
            const viewBtn = document.createElement('button');
            viewBtn.className = 'btn btn-outline';
            viewBtn.style.padding = '0.3rem 0.6rem';
            viewBtn.style.fontSize = '0.8rem';
            viewBtn.innerHTML = '<i class="fas fa-eye"></i> Ver';
            viewBtn.addEventListener('click', (e) => { e.stopPropagation(); openAuditDetailModal(log); });
            tdActionBtn.appendChild(viewBtn);

            tr.appendChild(tdDate);
            tr.appendChild(tdTable);
            tr.appendChild(tdAction);
            tr.appendChild(tdRecord);
            tr.appendChild(tdBy);
            tr.appendChild(tdActionBtn);
            tbody.appendChild(tr);
        }

        // Mobile card
        if (cardsContainer) {
            const card = document.createElement('div');
            card.className = 'mobile-card';
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => openAuditDetailModal(log));
            card.innerHTML = `
                <div class="mobile-card-header">
                    <div class="mobile-card-status-wrap">
                        <span class="status-badge" style="background:${tableBg};color:${tableColor};font-size:0.7rem;">${tableLabel}</span>
                        <span class="status-badge" style="background:${actionBg};color:${actionColor};font-size:0.7rem;">${actionLabel}</span>
                    </div>
                    <span style="font-size:0.8rem;color:#64748b;white-space:nowrap;">${dateStr}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Registro</span>
                    <span class="mobile-card-value" style="font-family:monospace;font-size:0.85rem;">${escapeHtml(recordId)}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Por</span>
                    <span class="mobile-card-value" style="font-size:0.85rem;color:#64748b;">${escapeHtml(changedBy)}</span>
                </div>
            `;
            cardsContainer.appendChild(card);
        }
    });
}

function formatAuditValue(value) {
    if (value === null || value === undefined) return '<span style="color:#94a3b8;font-style:italic;">(vacío)</span>';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
        if (value === '') return '<span style="color:#94a3b8;font-style:italic;">(vacío)</span>';
        return escapeHtml(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return '<span style="color:#94a3b8;font-style:italic;">(lista vacía)</span>';
        return '<ul style="margin:0;padding-left:1.2rem;font-size:0.85rem;">' + value.map(v => `<li>${escapeHtml(String(v))}</li>`).join('') + '</ul>';
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.length === 0) return '<span style="color:#94a3b8;font-style:italic;">(vacío)</span>';
        return '<table style="width:100%;font-size:0.85rem;margin:0;">' + entries.map(([k, v]) => `<tr><td style="padding:0.2rem 0.4rem;color:#64748b;border:none;width:40%;">${escapeHtml(k)}</td><td style="padding:0.2rem 0.4rem;border:none;">${formatAuditValue(v)}</td></tr>`).join('') + '</table>';
    }
    return escapeHtml(String(value));
}

function buildAuditDiff(oldValues, newValues) {
    const oldObj = oldValues || {};
    const newObj = newValues || {};
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    if (allKeys.size === 0) {
        return '<p style="color:#94a3b8;">Sin datos detallados.</p>';
    }

    let rows = '';
    allKeys.forEach((key) => {
        const oldVal = oldObj[key];
        const newVal = newObj[key];
        const hasOld = key in oldObj;
        const hasNew = key in newObj;

        if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return; // Skip unchanged

        rows += `
            <tr>
                <td style="padding:0.5rem 0.8rem;border-bottom:1px solid #f1f5f9;font-weight:600;color:#334155;width:30%;">${escapeHtml(key)}</td>
                <td style="padding:0.5rem 0.8rem;border-bottom:1px solid #f1f5f9;background:#fff5f5;color:#991b1b;width:35%;">
                    ${hasOld ? formatAuditValue(oldVal) : '<span style="color:#94a3b8;font-style:italic;">(no existía)</span>'}
                </td>
                <td style="padding:0.5rem 0.8rem;border-bottom:1px solid #f1f5f9;background:#f0fdf4;color:#166534;width:35%;">
                    ${hasNew ? formatAuditValue(newVal) : '<span style="color:#94a3b8;font-style:italic;">(eliminado)</span>'}
                </td>
            </tr>
        `;
    });

    if (!rows) {
        return '<p style="color:#94a3b8;">Sin cambios detectados.</p>';
    }

    return `
        <table style="width:100%;border-collapse:collapse;margin-top:0.5rem;">
            <thead>
                <tr>
                    <th style="padding:0.5rem 0.8rem;background:#f8fafc;border-bottom:2px solid #e2e8f0;text-align:left;font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:30%;">Campo</th>
                    <th style="padding:0.5rem 0.8rem;background:#f8fafc;border-bottom:2px solid #e2e8f0;text-align:left;font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:35%;"><i class="fas fa-arrow-left" style="margin-right:0.3rem;"></i>Antes</th>
                    <th style="padding:0.5rem 0.8rem;background:#f8fafc;border-bottom:2px solid #e2e8f0;text-align:left;font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:35%;"><i class="fas fa-arrow-right" style="margin-right:0.3rem;"></i>Después</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function openAuditDetailModal(log) {
    const modal = document.getElementById('audit-detail-modal');
    const content = document.getElementById('audit-detail-content');
    if (!modal || !content) return;

    const action = toSafeText(log.action).toLowerCase();
    let actionLabel = 'Cambio';
    let actionColor = '#0369a1';
    if (action === 'create') { actionLabel = 'Creación'; actionColor = '#00b894'; }
    else if (action === 'update') { actionLabel = 'Actualización'; actionColor = '#e67e22'; }
    else if (action === 'delete') { actionLabel = 'Eliminación'; actionColor = '#d63031'; }

    const tableLabel = (() => {
        const t = toSafeText(log.table_name);
        if (t === 'products') return 'Productos';
        if (t === 'orders') return 'Pedidos';
        if (t === 'inventory') return 'Inventario';
        if (t === 'users') return 'Usuarios';
        return t;
    })();

    content.innerHTML = `
        <div style="background:#f8fafc;border-radius:10px;padding:1rem;margin-bottom:1.5rem;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:0.8rem;">
                <div>
                    <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.2rem;">Acción</div>
                    <span style="font-weight:700;color:${actionColor};">${actionLabel}</span>
                </div>
                <div>
                    <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.2rem;">Tabla</div>
                    <span style="font-weight:600;">${escapeHtml(tableLabel)}</span>
                </div>
                <div>
                    <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.2rem;">Registro</div>
                    <span style="font-family:monospace;font-size:0.9rem;">${escapeHtml(log.record_id)}</span>
                </div>
                <div>
                    <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.2rem;">Realizado por</div>
                    <span style="font-weight:600;">${escapeHtml(log.changed_by || '-')}</span>
                </div>
            </div>
            <div>
                <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.2rem;">Fecha</div>
                <span>${formatOrderDate(log.changed_at)}</span>
            </div>
        </div>

        ${action === 'create' && log.new_values ? `
            <div style="margin-bottom:1rem;">
                <h4 style="margin:0 0 0.5rem;font-size:0.95rem;color:#166534;"><i class="fas fa-plus-circle"></i> Datos creados</h4>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:0.8rem;">
                    ${formatAuditValue(log.new_values)}
                </div>
            </div>
        ` : ''}

        ${action === 'delete' && log.old_values ? `
            <div style="margin-bottom:1rem;">
                <h4 style="margin:0 0 0.5rem;font-size:0.95rem;color:#991b1b;"><i class="fas fa-trash"></i> Datos eliminados</h4>
                <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:0.8rem;">
                    ${formatAuditValue(log.old_values)}
                </div>
            </div>
        ` : ''}

        ${action === 'update' ? `
            <div style="margin-bottom:1rem;">
                <h4 style="margin:0 0 0.5rem;font-size:0.95rem;color:#b45309;"><i class="fas fa-pen-to-square"></i> Cambios realizados</h4>
                ${buildAuditDiff(log.old_values, log.new_values)}
            </div>
        ` : ''}
    `;

    modal.style.display = 'flex';
}

function closeAuditDetailModal() {
    const modal = document.getElementById('audit-detail-modal');
    if (modal) modal.style.display = 'none';
}

window.loadOrders = loadOrders;
window.filterOrders = filterOrders;
window.sortAdminProducts = sortAdminProducts;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.exportOrdersCsv = exportOrdersCsv;
window.deleteProduct = deleteProduct;
window.editProduct = editProduct;
window.openOrderModal = openOrderModal;
window.closeOrderModal = closeOrderModal;
window.loadInventory = loadInventory;
window.loadMovements = loadMovements;
window.filterInventoryTable = filterInventoryTable;
window.applyInventoryFilters = applyInventoryFilters;
window.applyMovementFilter = applyMovementFilter;
window.openInventoryModal = openInventoryModal;
window.closeInventoryModal = closeInventoryModal;
window.saveInventoryAdjustment = saveInventoryAdjustment;
window.setInvMode = setInvMode;
window.updateInvPreview = updateInvPreview;
window.updateNewProductVariantStock = updateNewProductVariantStock;
window.applyDefaultStockToNewVariants = applyDefaultStockToNewVariants;
window.openStockModal = openStockModal;
window.closeStockModal = closeStockModal;
window.bulkSetStockModal = bulkSetStockModal;
window.saveStockModalChanges = saveStockModalChanges;
window.loadNotifications = loadNotifications;
window.toggleNotifications = toggleNotifications;
window.renderNotifications = renderNotifications;
window.updateNotificationBadge = updateNotificationBadge;
window.setOrdersTab = setOrdersTab;
window.closePlaceholderModal = closePlaceholderModal;
window.openTrackingModal = openTrackingModal;
window.closeTrackingModal = closeTrackingModal;
window.submitTracking = submitTracking;
window.loadUsers = loadUsers;
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.editUser = editUser;
window.deleteUserAction = deleteUserAction;
window.loadAuditLogs = loadAuditLogs;
window.openAuditDetailModal = openAuditDetailModal;
window.closeAuditDetailModal = closeAuditDetailModal;
window.togglePasswordEdit = togglePasswordEdit;
window.setAuditView = setAuditView;
window.loadCustomers = loadCustomers;
window.openCustomerModal = openCustomerModal;
window.closeCustomerModal = closeCustomerModal;
window.saveCustomer = saveCustomer;
window.deleteCustomerAction = deleteCustomerAction;
window.openCustomerDetailModal = openCustomerDetailModal;
window.closeCustomerDetailModal = closeCustomerDetailModal;
window.openCustomerModalFromDetail = openCustomerModalFromDetail;
