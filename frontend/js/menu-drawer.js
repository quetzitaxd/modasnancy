/**
 * Menu Drawer Global — Bottom sheet para navegación entre todas las páginas
 * Uso: window.openMenuDrawer() / window.closeMenuDrawer()
 */
(function() {
    'use strict';

    // Evitar duplicar
    if (document.getElementById('menu-drawer')) return;

    const drawerHTML = `
    <div class="menu-drawer-overlay" id="menu-drawer-overlay" onclick="if(window.closeMenuDrawer)window.closeMenuDrawer()"></div>
    <div class="menu-drawer" id="menu-drawer" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="menu-drawer__header">
            <span class="menu-drawer__title">Menu</span>
            <button type="button" class="menu-drawer__close" onclick="if(window.closeMenuDrawer)window.closeMenuDrawer()" aria-label="Cerrar menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="menu-drawer__body">
            <!-- Categorias (solo si existe el sidebar) -->
            <div class="menu-drawer__section" id="menu-categories-section" style="display:none;">
                <div class="menu-drawer__section-title">Categorias</div>
                <div class="menu-drawer__links" id="menu-categories-list"></div>
            </div>

            <div class="menu-drawer__section">
                <div class="menu-drawer__section-title">Paginas</div>
                <a href="/" class="menu-drawer__link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Inicio
                </a>
                <a href="/carrito.html" class="menu-drawer__link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    Carrito
                </a>
                <a href="/instalar.html" class="menu-drawer__link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Instalar App
                </a>
            </div>

            <div class="menu-drawer__section">
                <div class="menu-drawer__section-title">Informacion</div>
                <a href="/nosotros.html" class="menu-drawer__link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    Nosotros
                </a>
                <a href="/envios.html" class="menu-drawer__link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    Envios
                </a>
                <a href="/tallas.html" class="menu-drawer__link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Guia de Tallas
                </a>
                <a href="/faq.html" class="menu-drawer__link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Preguntas Frecuentes
                </a>
                <a href="/devoluciones.html" class="menu-drawer__link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                    Cambios y Devoluciones
                </a>
                <a href="/privacidad.html" class="menu-drawer__link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Privacidad
                </a>
            </div>

            <div class="menu-drawer__section">
                <div class="menu-drawer__section-title">Live Shopping</div>
                <a href="https://live.modasnancy.com" class="menu-drawer__link menu-drawer__link--highlight" target="_blank" rel="noopener">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    live.modasnancy.com
                </a>
            </div>
        </div>
    </div>
    <style>
        .menu-drawer-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.45);
            z-index: 960;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease;
        }
        .menu-drawer-overlay.active { opacity: 1; pointer-events: auto; }
        .menu-drawer {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 961;
            background: #fff;
            border-radius: 20px 20px 0 0;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.12);
            transform: translateY(100%);
            transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            max-height: 85vh;
            display: flex;
            flex-direction: column;
        }
        .menu-drawer.active { transform: translateY(0); }
        .menu-drawer__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 1.25rem;
            border-bottom: 1px solid #f0f0f0;
        }
        .menu-drawer__title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #000;
        }
        .menu-drawer__close {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            color: #666;
        }
        .menu-drawer__body {
            overflow-y: auto;
            padding: 0.5rem 1rem 2rem;
        }
        .menu-drawer__section { margin-top: 1rem; }
        .menu-drawer__section:first-child { margin-top: 0; }
        .menu-drawer__section-title {
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #999;
            margin-bottom: 0.5rem;
            padding-left: 0.5rem;
        }
        .menu-drawer__link {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.65rem 0.5rem;
            border-radius: 10px;
            color: #333;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            transition: background 0.15s;
        }
        .menu-drawer__link:hover, .menu-drawer__link:active { background: #f5f5f5; }
        .menu-drawer__link--highlight { color: #e85c8a; font-weight: 600; }
        .menu-drawer__link svg { flex-shrink: 0; stroke-width: 2; }
        @media (min-width: 600px) {
            .menu-drawer { left: auto; right: 1rem; width: 360px; border-radius: 16px; bottom: calc(70px + env(safe-area-inset-bottom)); max-height: 70vh; }
            .menu-drawer-overlay { display: none; }
        }
    </style>`;

    const div = document.createElement('div');
    div.innerHTML = drawerHTML;
    while (div.firstChild) {
        document.body.appendChild(div.firstChild);
    }

    // Si existe el sidebar de categorías, copiar sus links al drawer
    const catSidebar = document.getElementById('cat-sidebar-list');
    if (catSidebar) {
        const section = document.getElementById('menu-categories-section');
        const list = document.getElementById('menu-categories-list');
        if (section && list) {
            section.style.display = '';
            const items = catSidebar.querySelectorAll('.cat-sidebar__item');
            items.forEach(function(item) {
                const filter = item.dataset.filter;
                const text = item.textContent.trim();
                if (!filter) return;
                const a = document.createElement('a');
                a.className = 'menu-drawer__link';
                a.href = '/';
                a.textContent = text;
                a.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (window.applyCategoryFilter) {
                        window.applyCategoryFilter(filter, item);
                    }
                    closeMenuDrawer();
                });
                list.appendChild(a);
            });
        }
    }

    window.openMenuDrawer = function() {
        const overlay = document.getElementById('menu-drawer-overlay');
        const drawer = document.getElementById('menu-drawer');
        if (overlay && drawer) {
            overlay.classList.add('active');
            drawer.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeMenuDrawer = function() {
        const overlay = document.getElementById('menu-drawer-overlay');
        const drawer = document.getElementById('menu-drawer');
        if (overlay && drawer) {
            overlay.classList.remove('active');
            drawer.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    // Cerrar con Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') window.closeMenuDrawer();
    });
})();
