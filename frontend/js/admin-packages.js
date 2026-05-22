/**
 * admin-packages.js
 * CRUD de paquetes para venta en directo en el panel de admin.
 */

let adminPackages = [];
let editingPackageId = null;

console.log('[admin-packages.js] Script cargado correctamente v20260521-1');

function toSafeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function escapeHtml(str) {
    return toSafeText(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatMoneyAdmin(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 'Q0.00';
    return `Q${parsed.toFixed(2)}`;
}

// ─── API helpers (usamos apiFetch del admin.js si existe, sino fetch simple) ─

async function apiPackages(url, options = {}) {
    const token = localStorage.getItem('admin_token');
    const headers = { ...(options.headers || {}) };
    if (token && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
}

// ─── Carga y render ─────────────────────────────────────────────────────────

async function loadPackages() {
    try {
        adminPackages = await apiPackages('/api/packages') || [];
        renderPackagesTable();
    } catch (err) {
        console.error('Error cargando paquetes:', err);
        alert('Error cargando paquetes: ' + err.message);
    }
}

function renderPackagesTable() {
    const tbody = document.getElementById('packages-tbody');
    const cards = document.getElementById('packages-cards');
    if (!tbody && !cards) return;
    if (tbody) tbody.innerHTML = '';
    if (cards) cards.innerHTML = '';

    if (!Array.isArray(adminPackages) || adminPackages.length === 0) {
        if (tbody) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7;
            td.style.textAlign = 'center';
            td.style.padding = '1.5rem';
            td.style.color = '#888';
            td.textContent = 'No hay paquetes registrados.';
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        if (cards) {
            cards.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8;">No hay paquetes registrados.</div>';
        }
        return;
    }

    adminPackages.forEach((pkg) => {
        const isActive = pkg.is_active === 1 || pkg.is_active === true;
        const imgUrl = pkg.image_url || '/assets/placeholder.svg';

        // Desktop
        if (tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${escapeHtml(imgUrl)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;" onerror="this.src='/assets/placeholder.svg'"></td>
                <td><strong>${escapeHtml(pkg.code)}</strong></td>
                <td>${escapeHtml(pkg.name)}</td>
                <td>${formatMoneyAdmin(pkg.price)}</td>
                <td>${pkg.stock_quantity}</td>
                <td><span class="status-badge" style="${isActive ? 'background:#e8f5e9;color:#388e3c;' : 'background:#ffebee;color:#c62828;'}">${isActive ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <div class="order-actions">
                        <button type="button" class="btn btn-outline" style="padding:0.4rem 0.55rem;" onclick="editPackage(${pkg.id})"><i class="fas fa-edit"></i> Editar</button>
                        <button type="button" class="btn btn-outline" style="padding:0.4rem 0.55rem; color:${isActive?'#d63031':'#388e3c'}; border-color:${isActive?'#fecaca':'#bbf7d0'};" onclick="togglePackageStatus(${pkg.id}, ${isActive ? 0 : 1})">${isActive ? 'Desactivar' : 'Activar'}</button>
                        <button type="button" class="btn btn-outline" style="padding:0.4rem 0.55rem; color:#d63031; border-color:#fecaca;" onclick="deletePackage(${pkg.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }

        // Mobile card
        if (cards) {
            const card = document.createElement('div');
            card.className = 'mobile-card';
            card.innerHTML = `
                <div class="mobile-card-header">
                    <div class="mobile-card-order-id">${escapeHtml(pkg.code)}</div>
                    <span class="status-badge" style="${isActive ? 'background:#e8f5e9;color:#388e3c;' : 'background:#ffebee;color:#c62828;'}">${isActive ? 'Activo' : 'Inactivo'}</span>
                </div>
                <div class="mobile-card-title">${escapeHtml(pkg.name)}</div>
                <div class="mobile-card-meta">Stock: ${pkg.stock_quantity} | Precio: ${formatMoneyAdmin(pkg.price)}</div>
                <div class="mobile-card-actions">
                    <button class="btn btn-outline" onclick="editPackage(${pkg.id})"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn btn-outline" style="color:${isActive?'#d63031':'#388e3c'}; border-color:${isActive?'#fecaca':'#bbf7d0'};" onclick="togglePackageStatus(${pkg.id}, ${isActive ? 0 : 1})">${isActive ? 'Desactivar' : 'Activar'}</button>
                    <button class="btn btn-outline" style="color:#d63031; border-color:#fecaca;" onclick="deletePackage(${pkg.id})"><i class="fas fa-trash"></i></button>
                </div>
            `;
            cards.appendChild(card);
        }
    });
}

// ─── Modal ─────────────────────────────────────────────────────────────────

function openPackageModal(pkgId) {
    console.log('[admin-packages.js] openPackageModal llamado con pkgId:', pkgId);
    editingPackageId = pkgId || null;
    const modal = document.getElementById('package-modal');
    const title = document.getElementById('package-modal-title');
    const form = document.getElementById('package-form');
    const errorEl = document.getElementById('package-modal-error');
    const preview = document.getElementById('package-image-preview');

    if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
    if (preview) preview.src = '/assets/placeholder.svg';
    form?.reset();

    if (pkgId) {
        const pkg = adminPackages.find((p) => p.id === pkgId);
        if (!pkg) return;
        if (title) title.textContent = 'Editar Paquete';
        document.getElementById('pkg-code').value = pkg.code;
        document.getElementById('pkg-name').value = pkg.name;
        document.getElementById('pkg-desc').value = pkg.description || '';
        document.getElementById('pkg-price').value = pkg.price;
        document.getElementById('pkg-stock').value = pkg.stock_quantity;
        document.getElementById('pkg-active').checked = pkg.is_active === 1 || pkg.is_active === true;
        if (preview && pkg.image_url) preview.src = pkg.image_url;
        // No se permite editar codigo
        document.getElementById('pkg-code').disabled = true;
    } else {
        if (title) title.textContent = 'Nuevo Paquete';
        document.getElementById('pkg-code').disabled = false;
    }

    if (modal) modal.classList.add('active');
}

function closePackageModal() {
    const modal = document.getElementById('package-modal');
    if (modal) modal.classList.remove('active');
    editingPackageId = null;
}

function handlePackageImagePreview() {
    const input = document.getElementById('pkg-image');
    const preview = document.getElementById('package-image-preview');
    if (!input || !preview) return;
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { preview.src = e.target.result; };
        reader.readAsDataURL(input.files[0]);
    }
}

async function savePackageForm(e) {
    e.preventDefault();
    const errorEl = document.getElementById('package-modal-error');
    if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }

    const code = document.getElementById('pkg-code').value.trim();
    const name = document.getElementById('pkg-name').value.trim();
    const description = document.getElementById('pkg-desc').value.trim();
    const price = Number(document.getElementById('pkg-price').value);
    const stock = Number(document.getElementById('pkg-stock').value);
    const isActive = document.getElementById('pkg-active').checked;
    const imageInput = document.getElementById('pkg-image');

    if (!code || !name) {
        if (errorEl) { errorEl.textContent = 'Codigo y nombre son obligatorios.'; errorEl.style.display = 'block'; }
        return;
    }
    if (!Number.isFinite(price) || price <= 0) {
        if (errorEl) { errorEl.textContent = 'Precio invalido.'; errorEl.style.display = 'block'; }
        return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
        if (errorEl) { errorEl.textContent = 'Stock invalido.'; errorEl.style.display = 'block'; }
        return;
    }

    const formData = new FormData();
    formData.append('code', code);
    formData.append('name', name);
    formData.append('description', description);
    formData.append('price', price);
    formData.append('stock_quantity', stock);
    formData.append('is_active', isActive ? 1 : 0);
    if (imageInput && imageInput.files && imageInput.files[0]) {
        formData.append('images', imageInput.files[0]);
    }

    try {
        if (editingPackageId) {
            await apiPackages(`/api/packages/${editingPackageId}`, { method: 'PUT', body: formData });
        } else {
            await apiPackages('/api/packages', { method: 'POST', body: formData });
        }
        closePackageModal();
        loadPackages();
    } catch (err) {
        if (errorEl) { errorEl.textContent = err.message; errorEl.style.display = 'block'; }
    }
}

async function togglePackageStatus(id, newStatus) {
    try {
        await apiPackages(`/api/packages/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: newStatus })
        });
        loadPackages();
    } catch (err) {
        alert(err.message);
    }
}

async function deletePackage(id) {
    if (!window.confirm('¿Eliminar este paquete? Esta accion no se puede deshacer.')) return;
    try {
        await apiPackages(`/api/packages/${id}`, { method: 'DELETE' });
        loadPackages();
    } catch (err) {
        alert(err.message);
    }
}

function editPackage(id) {
    openPackageModal(id);
}

// ─── Auto-carga cuando se activa la pestaña ────────────────────────────────

function initPackagesTab() {
    // Escuchar clicks en los tabs para cargar paquetes cuando se activa
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
            if (m.target.id === 'paquetes' && m.target.classList.contains('active')) {
                loadPackages();
            }
        });
    });
    const pane = document.getElementById('paquetes');
    if (pane) observer.observe(pane, { attributes: true, attributeFilter: ['class'] });
}

// Inicializar al cargar si la pestaña ya esta activa
document.addEventListener('DOMContentLoaded', () => {
    initPackagesTab();
    if (document.getElementById('paquetes')?.classList.contains('active')) {
        loadPackages();
    }

    // Bind form
    const form = document.getElementById('package-form');
    if (form) form.addEventListener('submit', savePackageForm);
});

// Exponer globales
window.loadPackages = loadPackages;
window.openPackageModal = openPackageModal;
window.closePackageModal = closePackageModal;
window.editPackage = editPackage;
window.togglePackageStatus = togglePackageStatus;
window.deletePackage = deletePackage;
window.handlePackageImagePreview = handlePackageImagePreview;
