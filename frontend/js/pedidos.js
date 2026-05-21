/**
 * Panel de Pedidos — modasnancy
 * Operadores de pedidos (operador_pedidos / admin)
 * Basado en la lógica de pedidos del panel admin
 */

let adminOrders = [];
let lastFilteredOrders = [];
let currentOrderModal = null;
let currentOrdersFilter = 'all';

function toSafeText(value) {
    if (value === null || value === undefined) return '';
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

function normalizeStatus(value) {
    const status = toSafeText(value).toLowerCase();
    if (status === 'pendiente' || status === 'confirmado' || status === 'enviado' || status === 'cancelado') {
        return status;
    }
    return 'pendiente';
}

function formatOrderDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    try {
        return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    } catch {
        return date.toLocaleString();
    }
}

function getOrdersUser() {
    try {
        const token = localStorage.getItem('orders_token');
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch {
        return null;
    }
}

function clearOrdersSession(message) {
    localStorage.removeItem('orders_token');
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginError = document.getElementById('login-error');

    if (loginView) loginView.style.display = 'grid';
    if (dashboardView) dashboardView.style.display = 'none';
    if (loginError) {
        loginError.textContent = toSafeText(message) || 'Sesión expirada. Inicia sesión nuevamente.';
        loginError.style.display = 'block';
    }
}

let isRefreshing = false;
let refreshPromise = null;

async function refreshAuthToken() {
    const token = localStorage.getItem('orders_token');
    if (!token) return null;

    try {
        const res = await fetch('/api/refresh', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) return null;

        const data = await res.json();
        if (data.token) {
            localStorage.setItem('orders_token', data.token);
            return data.token;
        }
    } catch {
        // Refresh falló
    }
    return null;
}

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('orders_token');
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

        clearOrdersSession();
    }

    return res;
}

function checkAuth() {
    const token = localStorage.getItem('orders_token');
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginError = document.getElementById('login-error');

    if (token && isLikelyJwt(token)) {
        const user = getOrdersUser();
        const allowedRoles = new Set(['admin', 'operador_pedidos']);
        if (user && allowedRoles.has(user.role)) {
            if (loginView) loginView.style.display = 'none';
            if (dashboardView) dashboardView.style.display = 'block';
            const nameEl = document.getElementById('user-name');
            if (nameEl) nameEl.textContent = user.name || user.sub || 'Operador';
            loadOrders();
            return;
        }
        // Si es vendedor u otro rol no autorizado
        if (user && (user.role === 'vendedor' || user.role === 'operador_stock')) {
            localStorage.removeItem('orders_token');
            if (loginError) {
                loginError.textContent = 'Acceso denegado. Este panel es solo para operadores de pedidos.';
                loginError.style.display = 'block';
            }
            if (loginView) loginView.style.display = 'grid';
            if (dashboardView) dashboardView.style.display = 'none';
            return;
        }
    }

    if (token && !isLikelyJwt(token)) {
        localStorage.removeItem('orders_token');
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

        if (sortBy === 'oldest') return leftTime - rightTime;
        if (sortBy === 'newest') return rightTime - leftTime;
        if (sortBy === 'total_desc') return rightTotal - leftTotal;
        if (sortBy === 'total_asc') return leftTotal - rightTotal;
        if (sortBy === 'name_asc') return leftCustomer.localeCompare(rightCustomer);
        return rightTime - leftTime;
    });

    return filtered;
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
    if (!tbody && !cardsContainer) return;
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
    if (!status) return;

    const token = localStorage.getItem('orders_token');
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
                clearOrdersSession();
                return;
            }
            const errData = await res.json().catch(() => ({}));
            alert(errData.error || 'Error al actualizar estado');
            return;
        }

        loadOrders();
    } catch {
        alert('Error conectando con servidor');
    }
}

function openOrderModal(orderId) {
    const safeId = toSafeText(orderId);
    const order = adminOrders.find((item) => toSafeText(item && item.id) === safeId);
    if (!order) return;

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

    if (title) title.textContent = `Pedido #${safeId}`;
    if (customer) customer.textContent = toSafeText(order.customer_name) || '-';
    if (status) status.textContent = normalizeStatus(order.status).toUpperCase();
    if (phone) phone.textContent = toSafeText(order.phone) || '-';
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
    if (date) date.textContent = formatOrderDate(order.created_at);
    if (address) address.textContent = `${toSafeText(order.address)}, ${toSafeText(order.city)}`.replace(/^,\s*/, '') || '-';
    if (total) total.textContent = `Q${toSafeMoney(order.total).toFixed(2)}`;

    const isCubopago = toSafeText(order.payment_method).toLowerCase() === 'cubopago';
    if (paymentMethod) paymentMethod.textContent = isCubopago ? 'Tarjeta de Crédito/Débito' : 'Pago contra entrega (Efectivo)';
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

    if (modal) modal.style.display = 'flex';
}

function closeOrderModal() {
    const modal = document.getElementById('order-modal');
    if (modal) modal.style.display = 'none';
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
    if (msgEl) msgEl.textContent = message || 'Esta función está pendiente de implementación.';
    if (modal) modal.style.display = 'flex';
}

function closePlaceholderModal() {
    const modal = document.getElementById('placeholder-modal');
    if (modal) modal.style.display = 'none';
}

function buildOrderSummary(order) {
    const safeOrder = order || {};
    const status = normalizeStatus(safeOrder.status);
    const items = Array.isArray(safeOrder.items) ? safeOrder.items : [];
    const itemLines = items.map((item) => {
        const qty = Number(item && item.quantity);
        const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
        const name = toSafeText(item && item.product_name) || toSafeText(item && item.name) || toSafeText(item && item.product_id) || 'Producto';
        const size = (toSafeText(item && item.size) || 'Única').toUpperCase();
        const color = toSafeText(item && item.color_name);
        return color
            ? `  ${safeQty} x ${name} (${size}, ${color})`
            : `  ${safeQty} x ${name} (${size})`;
    }).join('\n');

    return [
        `Pedido #${toSafeText(safeOrder.id)}`,
        `Cliente: ${toSafeText(safeOrder.customer_name)}`,
        `Teléfono: ${toSafeText(safeOrder.phone)}`,
        `Dirección: ${toSafeText(safeOrder.address)}, ${toSafeText(safeOrder.city)}`.replace(/^,\s*/, ''),
        `Estado: ${status.toUpperCase()}`,
        `Total: Q${toSafeMoney(safeOrder.total).toFixed(2)}`,
        `Fecha: ${formatOrderDate(safeOrder.created_at)}`,
        '',
        'Productos:',
        itemLines || '  (Sin productos)'
    ].join('\n');
}

async function copyCurrentOrderSummary() {
    if (!currentOrderModal) return;
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
        'id', 'fecha', 'cliente', 'telefono', 'email', 'direccion', 'ciudad', 'notas',
        'estado', 'metodo_pago', 'estado_pago', 'transaccion', 'autorizacion', 'total', 'productos'
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

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

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
                    throw new Error('Sesión inválida. Intenta nuevamente.');
                }

                const allowedRoles = new Set(['admin', 'operador_pedidos']);
                if (!allowedRoles.has(data.role)) {
                    throw new Error('Acceso denegado. Este panel es solo para operadores de pedidos.');
                }

                localStorage.setItem('orders_token', data.token);
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
            localStorage.removeItem('orders_token');
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
            if (event.target === orderModal) closeOrderModal();
        });
    }

    const trackingModal = document.getElementById('tracking-modal');
    if (trackingModal) {
        trackingModal.addEventListener('click', (event) => {
            if (event.target === trackingModal) closeTrackingModal();
        });
    }

    const placeholderModal = document.getElementById('placeholder-modal');
    if (placeholderModal) {
        placeholderModal.addEventListener('click', (event) => {
            if (event.target === placeholderModal) closePlaceholderModal();
        });
    }
});
