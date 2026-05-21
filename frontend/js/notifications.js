/**
 * SISTEMA DE NOTIFICACIONES EN PESTAÑA (TAB)
 * Este script hace que el título de la pestaña parpadee cuando el usuario no está viendo la página.
 */

(function() {
    // CONFIGURACIÓN
    const MENSAGE_NOTIFICACION = "🔔 Tienes un mensaje...";
    const INTERVALO_MS = 1000;

    let originalTitle = document.title;
    let notificationInterval = null;
    let showingOriginal = true;

    // Escuchar el cambio de visibilidad de la página
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            startBlinking();
        } else {
            stopBlinking();
        }
    });

    function startBlinking() {
        if (notificationInterval) return;
        
        // Guardar el título actual por si cambió (ej: navegación SPA o carga dinámica)
        originalTitle = document.title;
        
        notificationInterval = setInterval(() => {
            document.title = showingOriginal ? MENSAGE_NOTIFICACION : originalTitle;
            showingOriginal = !showingOriginal;
        }, INTERVALO_MS);
    }

    function stopBlinking() {
        if (notificationInterval) {
            clearInterval(notificationInterval);
            notificationInterval = null;
        }
        
        // Restaurar el título original inmediatamente
        document.title = originalTitle;
        showingOriginal = true;
    }
})();
