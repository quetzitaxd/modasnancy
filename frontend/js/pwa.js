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

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Mostrar boton de instalacion personalizado
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.style.display = 'flex';
            installBtn.addEventListener('click', async () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('[PWA] Usuario instalo la app');
                }
                deferredPrompt = null;
            });
        }
    });

    window.addEventListener('appinstalled', () => {
        console.log('[PWA] App instalada');
        deferredPrompt = null;
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) installBtn.style.display = 'none';
    });
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
