/**
 * cart.js
 * Fuente unica de verdad del carrito para modasnancy.
 * 7 capas: Storage -> State -> Product Cache -> Pricing -> Summary -> Renderers -> Events
 */

const ACTIONS = {
  UPDATE_QTY: 'update-qty',
  REMOVE: 'remove',
};

const CART_KEY_SEPARATOR = '::';

window.Cart = {
  // ── Estado interno ──────────────────────────────────────────
  _items: [],
  _products: [],
  _productsLoaded: false,
  _loadingPromise: null,
  STORAGE_KEY: 'modasnancy_cart',

  // ── Layer 1: Storage ────────────────────────────────────────
  load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        this._items = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this._items = [];
        return;
      }
      // Normalizar a estructura minima. Ignorar campos legacy (price, sale_enabled, etc.)
      this._items = parsed
        .map((item) => ({
          product_id: item.product_id,
          sku: item.sku,
          size: item.size || 'Unica',
          color_name: item.color_name || '',
          image: item.image || '',
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        }))
        .filter((item) => item.product_id && item.sku);
    } catch {
      this._items = [];
    }
  },

  save() {
    const minimal = this._items.map((item) => ({
      product_id: item.product_id,
      sku: item.sku,
      size: item.size,
      color_name: item.color_name,
      image: item.image,
      quantity: item.quantity,
    }));
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(minimal));
  },

  clear() {
    this._items = [];
    localStorage.removeItem(this.STORAGE_KEY);
    this.updateCount();
    this._dispatch();
  },

  // ── Layer 2: Cart State ────────────────────────────────────
  makeKey(item) {
    return `${item.product_id}${CART_KEY_SEPARATOR}${item.size}${CART_KEY_SEPARATOR}${item.color_name}`;
  },

  add(item) {
    const key = this.makeKey(item);
    const existing = this._items.find((i) => this.makeKey(i) === key);

    if (existing) {
      existing.quantity = Math.max(1, (existing.quantity || 0) + (item.quantity || 1));
    } else {
      this._items.push({
        product_id: item.product_id,
        sku: item.sku,
        size: item.size || 'Unica',
        color_name: item.color_name || '',
        image: item.image || '',
        quantity: Math.max(1, item.quantity || 1),
      });
    }

    this.save();
    this._dispatch();
  },

  remove(cartKey) {
    this._items = this._items.filter((i) => this.makeKey(i) !== cartKey);
    this.save();
    this._dispatch();
  },

  updateQty(cartKey, delta) {
    const item = this._items.find((i) => this.makeKey(i) === cartKey);
    if (!item) return;

    item.quantity = (item.quantity || 0) + delta;
    if (item.quantity <= 0) {
      this.remove(cartKey);
      return;
    }

    this.save();
    this._dispatch();
  },

  setItems(items) {
    this._items = Array.isArray(items) ? items : [];
    this.save();
    this._dispatch();
  },

  // ── Layer 3: Product Cache ─────────────────────────────────
  async ensureProductsLoaded() {
    if (this._productsLoaded) return;
    if (this._loadingPromise) return this._loadingPromise;

    this._loadingPromise = (async () => {
      try {
        const products = await getProducts();
        this._products = Array.isArray(products) ? products : [];
        this._productsLoaded = true;
      } catch (err) {
        console.error('[Cart] Error cargando productos:', err);
        this._products = [];
      } finally {
        this._loadingPromise = null;
      }
    })();

    return this._loadingPromise;
  },

  findProduct(id) {
    if (!this._productsLoaded) return null;
    return this._products.find((p) => String(p.id) === String(id)) || null;
  },

  // ── Layer 4: Pricing Engine ────────────────────────────────
  _getQtyByProduct() {
    const map = {};
    this._items.forEach((item) => {
      const pid = item.product_id;
      map[pid] = (map[pid] || 0) + (Number(item.quantity) || 0);
    });
    return map;
  },

  _getFinalPrice(freshProduct, totalQty) {
    if (!freshProduct) {
      return { price: 0, originalPrice: 0, badge: null };
    }

    const price = Number(freshProduct.price) || 0;
    const originalPrice = Number(freshProduct.original_price) || 0;

    // 1. Wholesale (mayorista)
    if (
      freshProduct.wholesale_enabled &&
      totalQty >= freshProduct.wholesale_min_qty &&
      freshProduct.wholesale_discount_percent > 0
    ) {
      const discounted = price * (1 - freshProduct.wholesale_discount_percent / 100);
      return {
        price: discounted,
        originalPrice: price,
        badge: { text: `-${freshProduct.wholesale_discount_percent}% Mayorista`, type: 'wholesale' },
      };
    }

    // 2. Bundle 2x
    if (freshProduct.bundle_2x_enabled && freshProduct.bundle_2x_price > 0 && totalQty >= 2) {
      const pairs = Math.floor(totalQty / 2);
      const singles = totalQty % 2;
      const totalBundle = pairs * freshProduct.bundle_2x_price + singles * price;
      const avg = totalBundle / totalQty;
      return {
        price: avg,
        originalPrice: price,
        badge: { text: 'Oferta 2x', type: 'bundle' },
      };
    }

    // 3. Sale
    if (freshProduct.sale_enabled && originalPrice > 0 && originalPrice !== price) {
      return {
        price,
        originalPrice,
        badge: { text: 'Oferta', type: 'sale' },
      };
    }

    return { price, originalPrice: 0, badge: null };
  },

  // ── Layer 5: Summary Engine ────────────────────────────────
  getSummary() {
    const qtyByProduct = this._getQtyByProduct();

    return this._items.map((item) => {
      const fresh = this.findProduct(item.product_id);

      if (!fresh) {
        return {
          ...item,
          unavailable: true,
          name: 'Producto no disponible',
          finalPrice: 0,
          itemTotal: 0,
          badge: { text: 'No disponible', type: 'unavailable' },
        };
      }

      const totalQty = qtyByProduct[item.product_id] || 0;
      const pricing = this._getFinalPrice(fresh, totalQty);
      const qty = Number(item.quantity) || 1;

      return {
        ...item,
        name: fresh.name || 'Producto',
        image: item.image || (fresh.images && fresh.images[0]) || '',
        unavailable: false,
        price: Number(fresh.price) || 0,
        originalPrice: pricing.originalPrice,
        finalPrice: pricing.price,
        itemTotal: pricing.price * qty,
        badge: pricing.badge,
      };
    });
  },

  getTotal() {
    return this.getSummary()
      .filter((s) => !s.unavailable)
      .reduce((sum, s) => sum + s.itemTotal, 0);
  },

  getCount() {
    return this._items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  },

  // ── Layer 6: Renderers (puros, no mutan estado) ────────────
  badgeStyle(type) {
    const styles = {
      wholesale: { bg: '#e84393', color: 'white' },
      bundle: { bg: '#fde68a', color: '#b45309' },
      sale: { bg: '#d63031', color: 'white' },
      unavailable: { bg: '#e2e8f0', color: '#64748b' },
    };
    return styles[type] || styles.unavailable;
  },

  renderSidebar() {
    const container = document.getElementById('cart-sidebar-items');
    const totalEl = document.getElementById('cart-sidebar-total');
    if (!container) return;

    container.innerHTML = '';
    const summary = this.getSummary();

    if (summary.length === 0) {
      if (totalEl) totalEl.textContent = formatMoney(0);
      container.innerHTML = '<div class="cart-empty">Tu bolsa esta vacia.</div>';
      return;
    }

    let total = 0;

    summary.forEach((s) => {
      if (!s.unavailable) total += s.itemTotal;

      const encodedKey = encodeURIComponent(this.makeKey(s));
      const imgSrc = safeImageUrl(s.image, '/assets/placeholder.svg');
      const sizeLabel = (s.size || 'Unica').toUpperCase();
      const colorLabel = s.color_name ? ` | Color: ${s.color_name}` : '';

      let priceHtml = '';
      if (s.unavailable) {
        priceHtml = '<span style="color:#999;font-size:0.8rem;">Producto ya no disponible</span>';
      } else if (s.badge) {
        const style = this.badgeStyle(s.badge.type);
        priceHtml = `
          <div class="cart-item__price">
            ${s.originalPrice > 0 ? `<span style="text-decoration:line-through;color:#999;font-size:0.8rem;margin-right:0.3rem;">${formatMoney(s.originalPrice)}</span>` : ''}
            ${formatMoney(s.finalPrice)}
          </div>
          <span style="font-size:0.7rem;padding:1px 5px;border-radius:3px;display:inline-block;margin-top:2px;color:${style.color};background:${style.bg};">${s.badge.text}</span>
        `;
      } else {
        priceHtml = `<div class="cart-item__price">${formatMoney(s.finalPrice)}</div>`;
      }

      const actionsHtml = s.unavailable
        ? ''
        : `
          <div class="cart-item__actions">
            <div class="qty-controls">
              <button class="qty-btn" type="button" aria-label="Disminuir cantidad" data-cart-action="${ACTIONS.UPDATE_QTY}" data-cart-key="${encodedKey}" data-delta="-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <span class="qty-value" aria-label="Cantidad ${s.quantity}">${s.quantity}</span>
              <button class="qty-btn" type="button" aria-label="Aumentar cantidad" data-cart-action="${ACTIONS.UPDATE_QTY}" data-cart-key="${encodedKey}" data-delta="1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
            <button class="cart-item__remove" type="button" data-cart-action="${ACTIONS.REMOVE}" data-cart-key="${encodedKey}">Eliminar</button>
          </div>
        `;

      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <img src="${imgSrc}" alt="${safeText(s.name)}" class="cart-item__img" loading="lazy">
        <div class="cart-item__details">
          <div class="cart-item__name">${safeText(s.name)}</div>
          <div class="cart-item__meta">Talla: ${sizeLabel}${colorLabel}</div>
          ${priceHtml}
          ${actionsHtml}
        </div>
      `;
      container.appendChild(row);
    });

    if (totalEl) totalEl.textContent = formatMoney(total);
  },

  renderCheckout() {
    const container = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const totalEl = document.getElementById('checkout-total');
    if (!container) return;

    container.innerHTML = '';
    const summary = this.getSummary();

    if (summary.length === 0) return;

    let total = 0;

    summary.forEach((s) => {
      if (!s.unavailable) total += s.itemTotal;

      const encodedKey = encodeURIComponent(this.makeKey(s));
      const row = document.createElement('div');
      row.className = 'cart-item';

      const img = createSafeImage(s.image, 'https://via.placeholder.com/80x100?text=Img', '', s.name);
      const details = document.createElement('div');
      details.className = 'cart-item-details';

      const head = document.createElement('div');
      head.style.display = 'flex';
      head.style.justifyContent = 'space-between';
      head.style.marginBottom = '0.5rem';

      const title = document.createElement('div');
      title.className = 'cart-item-title';
      title.textContent = safeText(s.name) || 'Producto';

      const priceLabel = document.createElement('div');
      priceLabel.style.fontWeight = '600';
      priceLabel.style.color = 'var(--accent-color)';

      if (s.unavailable) {
        priceLabel.innerHTML = '<span style="color:#999;">No disponible</span>';
      } else if (s.badge) {
        const style = this.badgeStyle(s.badge.type);
        priceLabel.innerHTML = `
          ${s.originalPrice > 0 ? `<span style="text-decoration:line-through;color:#999;font-size:0.8rem;margin-right:0.5rem;">${formatMoney(s.originalPrice)}</span>` : ''}
          ${formatMoney(s.finalPrice)}
          <div style="font-size:0.7rem;background:${style.bg};color:${style.color};padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px;">${s.badge.text}</div>
        `;
      } else {
        priceLabel.textContent = formatMoney(s.finalPrice);
      }

      head.appendChild(title);
      head.appendChild(priceLabel);

      const meta = document.createElement('div');
      meta.className = 'cart-item-meta';
      const sizeLabel = (safeText(s.size) || 'Unica').toUpperCase();
      const colorLabel = safeText(s.color_name);
      meta.textContent = colorLabel ? `Talla: ${sizeLabel} | Color: ${colorLabel}` : `Talla: ${sizeLabel}`;

      const actions = document.createElement('div');
      actions.className = 'cart-item-actions';

      if (!s.unavailable) {
        const qtyControls = document.createElement('div');
        qtyControls.className = 'qty-controls';

        const minusBtn = document.createElement('button');
        minusBtn.type = 'button';
        minusBtn.className = 'qty-btn';
        minusBtn.innerHTML = '<i class="fas fa-minus" style="font-size:10px"></i>';
        minusBtn.setAttribute('data-cart-action', ACTIONS.UPDATE_QTY);
        minusBtn.setAttribute('data-cart-key', encodedKey);
        minusBtn.setAttribute('data-delta', '-1');

        const qtyLabel = document.createElement('span');
        qtyLabel.style.cssText = 'font-size:0.95rem;font-weight:600;width:24px;text-align:center;';
        qtyLabel.textContent = String(s.quantity);

        const plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.className = 'qty-btn';
        plusBtn.innerHTML = '<i class="fas fa-plus" style="font-size:10px"></i>';
        plusBtn.setAttribute('data-cart-action', ACTIONS.UPDATE_QTY);
        plusBtn.setAttribute('data-cart-key', encodedKey);
        plusBtn.setAttribute('data-delta', '1');

        qtyControls.appendChild(minusBtn);
        qtyControls.appendChild(qtyLabel);
        qtyControls.appendChild(plusBtn);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-item-btn';
        removeBtn.style.fontSize = '0.9rem';
        removeBtn.innerHTML = '<i class="far fa-trash-alt"></i> Eliminar';
        removeBtn.setAttribute('data-cart-action', ACTIONS.REMOVE);
        removeBtn.setAttribute('data-cart-key', encodedKey);

        actions.appendChild(qtyControls);
        actions.appendChild(removeBtn);
      }

      details.appendChild(head);
      details.appendChild(meta);
      details.appendChild(actions);

      row.appendChild(img);
      row.appendChild(details);
      container.appendChild(row);
    });

    if (subtotalEl) subtotalEl.textContent = formatMoney(total);
    if (totalEl) totalEl.textContent = formatMoney(total);

    const disclaimerEl = document.getElementById('checkout-price-disclaimer');
    if (!disclaimerEl && totalEl) {
      const totalRow = totalEl.parentElement;
      if (totalRow) {
        const disc = document.createElement('div');
        disc.id = 'checkout-price-disclaimer';
        disc.style.cssText = 'font-size:0.7rem;color:#94a3b8;margin-top:0.3rem;';
        disc.textContent = 'Los precios se confirman al momento de procesar el pedido.';
        totalRow.appendChild(disc);
      }
    }
  },

  updateCount() {
    const total = this.getCount();

    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = String(total);
      el.style.display = total > 0 ? 'flex' : 'none';
    });

    const countEl = document.getElementById('cart-count');
    if (countEl) countEl.textContent = String(total);

    const bottomCountEl = document.getElementById('bottom-nav-cart-count');
    if (bottomCountEl) {
      bottomCountEl.textContent = String(total);
      bottomCountEl.style.display = total > 0 ? 'flex' : 'none';
    }
  },

  // ── Layer 7: Events ───────────────────────────────────────
  _dispatch() {
    this.updateCount();
    if (document.getElementById('cart-sidebar-items')) {
      this.renderSidebar();
    }
    if (document.getElementById('cart-items')) {
      this.renderCheckout();
    }

    document.dispatchEvent(
      new CustomEvent('cart:updated', {
        detail: {
          items: this._items,
          total: this.getTotal(),
          count: this.getCount(),
        },
      })
    );
  },

  subscribe(callback) {
    const handler = (e) => callback(e.detail);
    document.addEventListener('cart:updated', handler);
    return () => document.removeEventListener('cart:updated', handler);
  },

  _setupEventDelegation() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cart-action]');
      if (!btn) return;

      const action = btn.dataset.cartAction;
      const key = btn.dataset.cartKey;
      if (!key || !action) return;

      if (action === ACTIONS.UPDATE_QTY) {
        const delta = Number(btn.dataset.delta);
        if (Number.isNaN(delta)) return;
        this.updateQty(decodeURIComponent(key), delta);
      }

      if (action === ACTIONS.REMOVE) {
        this.remove(decodeURIComponent(key));
      }
    });
  },

  // ── Inicialización ─────────────────────────────────────────
  async init() {
    this.load();
    await this.ensureProductsLoaded();
    this.updateCount();
    this._setupEventDelegation();

    if (document.getElementById('cart-sidebar-items')) {
      this.renderSidebar();
    }

    if (document.getElementById('cart-items')) {
      this.renderCheckout();
    }

    this._dispatch();
  },
};

// ── Alias legacy (compatibilidad con scripts inline en HTML) ──
window.getCart = () => window.Cart._items;
window.addToCart = (item) => window.Cart.add(item);
window.clearCart = () => window.Cart.clear();

window.updateCartQty = (index, delta) => {
    const cart = window.Cart._items;
    if (!cart[index]) return;
    const key = window.Cart.makeKey(cart[index]);
    window.Cart.updateQty(key, delta);
};

window.removeFromCart = (index) => {
    const cart = window.Cart._items;
    if (!cart[index]) return;
    const key = window.Cart.makeKey(cart[index]);
    window.Cart.remove(key);
};

window.calculateCartTotal = (products) => {
    if (Array.isArray(products)) {
        window.Cart._products = products;
        window.Cart._productsLoaded = true;
    }
    return window.Cart.getTotal();
};

window.saveCart = (items) => window.Cart.setItems(items);
