/**
 * pwa.js
 * Registro del Service Worker y utilidades PWA.
 */

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('[PWA] Service Worker registrado:', registration.scope);

                    // Escuchar actualizaciones
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // Nueva version disponible
                                showUpdateBanner();
                            }
                        });
                    });
                })
                .catch((err) => {
                    console.warn('[PWA] Error registrando SW:', err);
                });
        });
    }
}

function showUpdateBanner() {
    const banner = document.createElement('div');
    banner.className = 'update-banner';
    banner.innerHTML = `
        <span>Hay una nueva version disponible.</span>
        <button id="btn-update-sw">Actualizar</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('btn-update-sw').addEventListener('click', () => {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
    });
}

// Detectar modo standalone (instalada)
function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

// Mostrar prompt de instalacion (Android) o instrucciones (iOS)
function setupInstallPrompt() {
    let deferredPrompt = null;
    let beforeinstallpromptFired = false;

    window.addEventListener('beforeinstallprompt', (e) => {
        beforeinstallpromptFired = true;
        e.preventDefault();
        deferredPrompt = e;
        console.log('[PWA] beforeinstallprompt capturado');

        const installBtn = document.getElementById('pwa-install-btn');
        const installBtnText = document.getElementById('install-btn-text');
        if (installBtn) {
            installBtn.disabled = false;
            installBtn.style.opacity = '1';
            if (installBtnText) {
                installBtnText.textContent = 'Instalar en mi telefono';
            } else {
                installBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Instalar en mi telefono';
            }
            installBtn.onclick = async () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('[PWA] Usuario instalo la app');
                }
                deferredPrompt = null;
            };
        }
    });

    window.addEventListener('appinstalled', () => {
        console.log('[PWA] App instalada');
        deferredPrompt = null;
        const installBtn = document.getElementById('pwa-install-btn');
        const installBtnText = document.getElementById('install-btn-text');
        if (installBtn) {
            installBtn.disabled = true;
            if (installBtnText) {
                installBtnText.textContent = 'App instalada';
            }
        }
        const installedMsg = document.getElementById('installed-message');
        if (installedMsg) installedMsg.classList.add('visible');
    });

    // Fallback: si no llega beforeinstallprompt en 5s, mostrar mensaje
    setTimeout(() => {
        if (!beforeinstallpromptFired) {
            const installBtn = document.getElementById('pwa-install-btn');
            const installBtnText = document.getElementById('install-btn-text');
            if (installBtn && installBtn.disabled) {
                if (installBtnText) {
                    installBtnText.textContent = 'Agrega a inicio desde el menu del navegador';
                } else {
                    installBtn.innerHTML = '<i class="fas fa-info-circle"></i> Agrega a inicio desde el menu del navegador';
                }
            }
        }
    }, 5000);
}

// Banner de offline/online
function setupNetworkStatus() {
    function updateStatus() {
        const offlineBadge = document.getElementById('offline-badge');
        if (!navigator.onLine) {
            if (!offlineBadge) {
                const badge = document.createElement('div');
                badge.id = 'offline-badge';
                badge.className = 'offline-badge';
                badge.textContent = 'Sin conexion';
                document.body.appendChild(badge);
            }
        } else {
            if (offlineBadge) {
                offlineBadge.classList.add('online');
                offlineBadge.textContent = 'Conexion restaurada';
                setTimeout(() => offlineBadge.remove(), 2500);
            }
        }
    }

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
}

// Inicializar PWA
document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    setupInstallPrompt();
    setupNetworkStatus();
});

window.isStandalone = isStandalone;
