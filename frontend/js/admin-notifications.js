/**
 * admin-notifications.js
 * Panel de envío de notificaciones push (pestaña Apps).
 * Depende de apiFetch() definido en admin.js.
 */

function toSafeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function formatNotificationDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    try {
        return new Intl.DateTimeFormat('es-GT', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(date);
    } catch {
        return date.toLocaleString();
    }
}

function showNotifError(msg) {
    const el = document.getElementById('notif-error');
    const successEl = document.getElementById('notif-success');
    if (el) {
        el.textContent = msg;
        el.style.display = 'block';
    }
    if (successEl) successEl.style.display = 'none';
}

function showNotifSuccess(msg) {
    const el = document.getElementById('notif-success');
    const errEl = document.getElementById('notif-error');
    if (el) {
        el.textContent = msg;
        el.style.display = 'block';
    }
    if (errEl) errEl.style.display = 'none';
}

function clearNotifMessages() {
    const err = document.getElementById('notif-error');
    const success = document.getElementById('notif-success');
    if (err) err.style.display = 'none';
    if (success) success.style.display = 'none';
}

function updateNotifTypeHint() {
    const type = document.getElementById('notif-type');
    const hint = document.getElementById('notif-type-hint');
    if (!type || !hint) return;

    if (type.value === 'live') {
        hint.innerHTML = '<i class="fas fa-info-circle"></i> Recomendado: enlace directo a tu transmisión en vivo de Facebook.';
    } else {
        hint.innerHTML = '<i class="fas fa-info-circle"></i> Opcional. Puede ser el enlace al producto en oferta o a la página principal del catálogo.';
    }
}

async function loadNotificationStats() {
    try {
        const res = await apiFetch('/api/notifications/stats');
        if (!res.ok) return;
        const data = await res.json();
        const el = document.getElementById('notif-registered-devices');
        if (el) el.textContent = Number(data.registeredDevices) || 0;
    } catch (err) {
        console.error('Error cargando estadísticas de notificaciones:', err);
    }
}

async function loadNotificationHistory() {
    const tbody = document.getElementById('notif-history-tbody');
    const cards = document.getElementById('notif-history-cards');
    if (!tbody && !cards) return;

    try {
        const res = await apiFetch('/api/notifications/history');
        if (!res.ok) return;
        const history = await res.json();
        renderNotificationHistory(Array.isArray(history) ? history : []);
    } catch (err) {
        console.error('Error cargando historial de notificaciones:', err);
    }
}

function renderNotificationHistory(history) {
    const tbody = document.getElementById('notif-history-tbody');
    const cards = document.getElementById('notif-history-cards');
    if (tbody) tbody.textContent = '';
    if (cards) cards.textContent = '';

    if (history.length === 0) {
        if (tbody) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7;
            td.style.textAlign = 'center';
            td.style.padding = '1.5rem';
            td.style.color = '#888';
            td.textContent = 'No hay notificaciones enviadas aún.';
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        if (cards) {
            cards.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8;">No hay notificaciones enviadas aún.</div>';
        }
        return;
    }

    history.forEach((item) => {
        const type = toSafeText(item.type).toLowerCase();
        const typeLabel = type === 'live' ? 'Live' : 'Promoción';
        const typeBg = type === 'live' ? '#f3e8ff' : '#e8f4fd';
        const typeColor = type === 'live' ? '#7c3aed' : '#2b6cb0';
        const dateStr = formatNotificationDate(item.sent_at);
        const recipients = Number(item.recipients_count) || 0;
        const success = Number(item.success_count) || 0;
        const failures = Number(item.failure_count) || 0;
        const sentBy = toSafeText(item.sent_by) || '-';

        if (tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td><strong>${toSafeText(item.title)}</strong></td>
                <td><span style="background:${typeBg};color:${typeColor};padding:0.25rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:700;">${typeLabel}</span></td>
                <td style="text-align:center;">${recipients}</td>
                <td style="text-align:center;color:#00b894;font-weight:600;">${success}</td>
                <td style="text-align:center;color:#d63031;font-weight:600;">${failures}</td>
                <td>${sentBy}</td>
            `;
            tbody.appendChild(tr);
        }

        if (cards) {
            const card = document.createElement('div');
            card.className = 'mobile-card';
            card.innerHTML = `
                <div class="mobile-card-header">
                    <div>
                        <div class="mobile-card-title">${toSafeText(item.title)}</div>
                        <div style="font-size:0.8rem;color:#64748b;margin-top:0.15rem;">${dateStr}</div>
                    </div>
                    <span style="background:${typeBg};color:${typeColor};padding:0.25rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:700;">${typeLabel}</span>
                </div>
                <div class="mobile-card-row"><span class="mobile-card-label">Mensaje</span><span class="mobile-card-value">${toSafeText(item.body)}</span></div>
                <div class="mobile-card-row"><span class="mobile-card-label">Destinatarios</span><span class="mobile-card-value">${recipients}</span></div>
                <div class="mobile-card-row"><span class="mobile-card-label">Exitosos</span><span class="mobile-card-value" style="color:#00b894;">${success}</span></div>
                <div class="mobile-card-row"><span class="mobile-card-label">Fallidos</span><span class="mobile-card-value" style="color:#d63031;">${failures}</span></div>
                <div class="mobile-card-row"><span class="mobile-card-label">Enviado por</span><span class="mobile-card-value">${sentBy}</span></div>
            `;
            cards.appendChild(card);
        }
    });
}

async function sendNotification() {
    clearNotifMessages();

    const titleInput = document.getElementById('notif-title');
    const bodyInput = document.getElementById('notif-body');
    const typeInput = document.getElementById('notif-type');
    const linkInput = document.getElementById('notif-link');

    const title = toSafeText(titleInput?.value);
    const body = toSafeText(bodyInput?.value);
    const type = toSafeText(typeInput?.value) || 'promo';
    const link = toSafeText(linkInput?.value) || null;

    if (!title) {
        showNotifError('El título es obligatorio.');
        return;
    }
    if (!body) {
        showNotifError('El mensaje es obligatorio.');
        return;
    }

    if (!window.confirm(`¿Estás seguro de enviar esta notificación a todos los dispositivos registrados?`)) {
        return;
    }

    try {
        const res = await apiFetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body, type, link })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            showNotifError(data.error || 'Error enviando la notificación.');
            return;
        }

        const data = await res.json();
        showNotifSuccess(`Notificación enviada. Dispositivos: ${data.recipients}, Exitosos: ${data.successCount}, Fallidos: ${data.failureCount}.`);

        // Limpiar formulario
        if (titleInput) titleInput.value = '';
        if (bodyInput) bodyInput.value = '';
        if (linkInput) linkInput.value = '';

        // Recargar stats e historial
        loadNotificationStats();
        loadNotificationHistory();
    } catch (err) {
        console.error('Error enviando notificación:', err);
        showNotifError('Error de conexión al enviar la notificación.');
    }
}

// Auto-cargar datos cuando se activa la pestaña Apps
function initNotificationsTab() {
    document.querySelectorAll('.admin-sidebar-item, .tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            if (target === 'apps') {
                loadNotificationStats();
                loadNotificationHistory();
            }
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotificationsTab);
} else {
    initNotificationsTab();
}
