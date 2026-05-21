/**
 * footer.js
 * Footer dinamico inyectado al final de cada pagina.
 * Usa BRAND_CONFIG para el logo, email y links.
 */

(function() {
    const brand = window.BRAND_CONFIG || {};
    const currentYear = new Date().getFullYear();

    const footerHtml = `
    <footer class="site-footer">
        <div class="footer__content">
            <div class="footer__brand">
                <a href="/" class="footer__logo">${brand.NAME || 'Modas Nancy'}</a>
                <p class="footer__intro">Boutique exclusiva de moda femenina. Envios a todo Guatemala con la mejor calidad y servicio garantizado.</p>
                <div class="footer__social">
                    ${brand.FACEBOOK ? `<a href="${brand.FACEBOOK}" target="_blank" rel="noopener" aria-label="Facebook"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>` : ''}
                    ${brand.INSTAGRAM ? `<a href="${brand.INSTAGRAM}" target="_blank" rel="noopener" aria-label="Instagram"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>` : ''}
                    ${brand.TIKTOK ? `<a href="${brand.TIKTOK}" target="_blank" rel="noopener" aria-label="TikTok"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg></a>` : ''}
                </div>
            </div>
            <div class="footer__col">
                <h3>Navegacion</h3>
                <a href="/catalogo.html">Catalogo</a>
                <a href="/ofertas.html">Ofertas</a>
                <a href="/nosotros.html">Nosotros</a>
                <a href="/tallas.html">Guia de Tallas</a>
                <a href="/envios.html">Envios</a>
            </div>
            <div class="footer__col">
                <h3>Servicio al Cliente</h3>
                <a href="/devoluciones.html">Cambios y Devoluciones</a>
                <a href="/faq.html">Preguntas Frecuentes</a>
                <a href="/privacidad.html">Politica de Privacidad</a>
            </div>
            <div class="footer__col">
                <h3>Contacto</h3>
                <p><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${brand.CITY || 'Ciudad de Guatemala'}</p>
                <p><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> <a href="mailto:${brand.EMAIL || 'soporte@modasnancy.com'}">${brand.EMAIL || 'soporte@modasnancy.com'}</a></p>
            </div>
            <div class="footer__col">
                <h3>Metodos de Pago</h3>
                <div class="footer__payments">
                    <p><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Pago con tarjeta</p>
                    <p><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> Deposito / Transferencia</p>
                    <p><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><path d="M1 10h22"/></svg> Pago contra entrega</p>
                </div>
                <div class="footer__secure">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span>Sitio Seguro <strong>SSL</strong></span>
                </div>
            </div>
        </div>
        <div class="footer__bottom">
            <a href="/privacidad.html">Politica de Privacidad</a>
            <p>&copy; ${currentYear} ${brand.NAME || 'Modas Nancy'}. Todos los derechos reservados.</p>
        </div>
    </footer>
    `;

    // Inyectar antes del cierre del body
    document.body.insertAdjacentHTML('beforeend', footerHtml);
})();
