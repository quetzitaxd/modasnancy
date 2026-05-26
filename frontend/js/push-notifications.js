/**
 * push-notifications.js
 * Registro y manejo de notificaciones push nativas (Capacitor + FCM).
 * Solo se activa cuando la app corre dentro del WebView nativo de Capacitor.
 */

(function() {
    function isCapacitorNative() {
        return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
    }

    if (!isCapacitorNative()) {
        // En navegador web normal, no hacemos nada nativo
        return;
    }

    const { PushNotifications } = window.Capacitor.Plugins;

    async function registerTokenWithBackend(token) {
        try {
            const res = await fetch('/api/push-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: token,
                    platform: window.Capacitor.getPlatform() // 'android' o 'ios'
                })
            });
            if (!res.ok) {
                console.warn('[Push] Backend no acepto el token:', res.status);
            } else {
                console.log('[Push] Token registrado en backend.');
            }
        } catch (err) {
            console.error('[Push] Error registrando token en backend:', err.message);
        }
    }

    async function initPushNotifications() {
        try {
            // 1. Solicitar permisos
            const result = await PushNotifications.requestPermissions();
            if (result.receive !== 'granted') {
                console.log('[Push] Permiso de notificaciones denegado.');
                return;
            }

            // 2. Registrar para recibir notificaciones
            await PushNotifications.register();

            // 3. Escuchar cuando se obtiene el token
            PushNotifications.addListener('registration', async (token) => {
                console.log('[Push] Token FCM recibido:', token.value);
                await registerTokenWithBackend(token.value);
            });

            // 4. Escuchar errores de registro
            PushNotifications.addListener('registrationError', (error) => {
                console.error('[Push] Error de registro FCM:', error);
            });

            // 5. Escuchar notificaciones recibidas en primer plano
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('[Push] Notificacion recibida en primer plano:', notification);
                // En primer plano, Capacitor no muestra la notificación automáticamente.
                // Podemos mostrar un toast usando la función global del proyecto si existe.
                if (typeof window.showToast === 'function') {
                    window.showToast(notification.body || notification.title || 'Nueva notificación', 'info');
                }
            });

            // 6. Escuchar cuando el usuario toca la notificación
            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                console.log('[Push] Notificacion tocada:', action);
                const data = action.notification?.data || {};
                const link = data.link || '';

                if (link) {
                    // Abrir enlace externo (Facebook, etc.)
                    if (typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins?.Browser) {
                        window.Capacitor.Plugins.Browser.open({ url: link });
                    } else {
                        window.open(link, '_blank');
                    }
                }
            });

            console.log('[Push] Sistema de notificaciones inicializado.');
        } catch (err) {
            console.error('[Push] Error inicializando push notifications:', err.message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPushNotifications);
    } else {
        initPushNotifications();
    }
})();
