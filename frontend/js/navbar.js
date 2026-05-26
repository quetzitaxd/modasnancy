/**
 * navbar.js
 * Navbar dinamico inyectado en todas las paginas.
 * Usa BRAND_CONFIG para el logo y links.
 */

(function() {
    const navbarRoot = document.getElementById('navbar-root');
    if (!navbarRoot) return;

    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';

    const isActive = (href) => {
        if (href === '/') return page === '' || page === 'index.html';
        return path.endsWith(href);
    };

    const brandName = window.BRAND_CONFIG?.NAME || 'Modas Nancy';
    const brandShort = window.BRAND_CONFIG?.SHORT_NAME || 'Modas Nancy';

    const links = [
        { href: '/', label: 'Catalogo' }
    ];

    const linksHtml = links.map((link) => {
        const activeClass = isActive(link.href) ? 'active' : '';
        return `<a href="${link.href}" class="nav-link ${activeClass}">${link.label}</a>`;
    }).join('');

    const headerHtml = `
    <a href="#main-content" class="skip-link">Saltar al contenido principal</a>

    <header class="site-header">
        <nav class="navbar" aria-label="Navegacion principal">
            <a href="/" class="logo" aria-label="${brandName}, ir al inicio">
                <span class="logo__text">${brandShort}</span>
            </a>
            <button class="hamburger" id="hamburger-btn" aria-label="Abrir menu" aria-expanded="false" aria-controls="nav-links">
                <span></span><span></span><span></span>
            </button>
            <div class="nav-links" id="nav-links">
                ${linksHtml}
                <a href="javascript:void(0)" class="nav-link nav-link--cart" id="cart-icon-btn" aria-label="Carrito de compras">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <path d="M16 10a4 4 0 0 1-8 0"></path>
                    </svg>
                    <span class="cart-count" data-cart-count aria-hidden="true">0</span>
                </a>
            </div>
        </nav>
    </header>

    <div class="cart-overlay" id="cart-overlay" aria-hidden="true"></div>
    <aside class="cart-sidebar" id="cart-sidebar" aria-label="Carrito de compras">
        <div class="cart-sidebar__header">
            <h2>Mi Bolsa</h2>
            <button class="cart-sidebar__close" id="close-cart-btn" aria-label="Cerrar carrito">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        <div class="cart-sidebar__body" id="cart-sidebar-items">
            <div class="cart-empty">Tu bolsa esta vacia.</div>
        </div>
        <div class="cart-sidebar__footer">
            <div class="cart-sidebar__total">
                <span>Subtotal</span>
                <span id="cart-sidebar-total">${window.CURRENCY_CONFIG?.SYMBOL || 'Q'}0.00</span>
            </div>
            <a href="/checkout.html" class="btn btn--block btn--primary">Proceder al Pago</a>
        </div>
    </aside>

    <div class="toast-container" id="toast-container" aria-live="polite" aria-atomic="true"></div>

    <nav class="bottom-nav" aria-label="Navegacion movil">
        <a href="/" class="bottom-nav__item ${page === '' || page === 'index.html' ? 'active' : ''}" aria-label="Inicio">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Inicio</span>
        </a>
        <a href="/" class="bottom-nav__item ${isActive('/') ? 'active' : ''}" aria-label="Catalogo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Catalogo</span>
        </a>
        <a href="javascript:void(0)" class="bottom-nav__item" id="bottom-nav-cart" aria-label="Carrito">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            <span>Carrito</span>
            <span class="bottom-nav__badge" data-cart-count>0</span>
        </a>
    </nav>
    `;

    navbarRoot.insertAdjacentHTML('beforebegin', headerHtml);
    navbarRoot.remove();

    // Asegurar target del skip-link
    const mainEl = document.querySelector('main');
    if (mainEl && !mainEl.id) {
        mainEl.id = 'main-content';
    } else if (!mainEl) {
        const firstSection = document.querySelector('section');
        if (firstSection && !firstSection.id) {
            firstSection.id = 'main-content';
        }
    }

    // Mobile menu toggle
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navLinksEl = document.getElementById('nav-links');
    if (hamburgerBtn && navLinksEl) {
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navLinksEl.classList.toggle('open');
            hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
        });

        document.addEventListener('click', (e) => {
            if (navLinksEl.classList.contains('open') && !navLinksEl.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                navLinksEl.classList.remove('open');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Cart sidebar
    const cartBtn = document.getElementById('cart-icon-btn');
    const bottomCartBtn = document.getElementById('bottom-nav-cart');
    const closeCartBtn = document.getElementById('close-cart-btn');
    const cartSidebar = document.getElementById('cart-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');

    if (cartSidebar && cartOverlay) {
        const openCart = () => {
            cartSidebar.classList.add('open');
            cartOverlay.classList.add('show');
            if (window.Cart) window.Cart.renderSidebar();
        };
        const closeCart = () => {
            cartSidebar.classList.remove('open');
            cartOverlay.classList.remove('show');
        };

        if (cartBtn) cartBtn.addEventListener('click', (e) => { e.preventDefault(); openCart(); });
        if (bottomCartBtn) bottomCartBtn.addEventListener('click', (e) => { e.preventDefault(); openCart(); });
        if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
        cartOverlay.addEventListener('click', closeCart);
        window.openCartSidebar = openCart;
    }
})();


