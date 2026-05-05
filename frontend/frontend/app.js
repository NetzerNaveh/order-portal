const API = 'https://order-portal-2x3o.onrender.com';

let token = localStorage.getItem('token') || null;
let cart = {}; // { productId: { product, quantity } }
let products = [];

// ── Utils ──────────────────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  el.classList.add('active');
}

function setLoading(on) {
  document.getElementById('loading').classList.toggle('hidden', !on);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError(id) {
  document.getElementById('id').classList.add('hidden');
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה');
  return data;
}

// ── Auth ───────────────────────────────────────────────────────────────────────

let currentPhone = '';

document.getElementById('btn-send-otp').addEventListener('click', async () => {
  const phone = document.getElementById('phone-input').value.trim();
  if (!phone) return showError('login-error', 'הזן מספר טלפון');

  setLoading(true);
  try {
    await apiFetch('/api/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) });
    currentPhone = phone;
    document.getElementById('otp-phone').textContent = phone;
    document.getElementById('step-phone').classList.add('hidden');
    document.getElementById('step-otp').classList.remove('hidden');
  } catch (e) {
    showError('login-error', e.message);
  } finally {
    setLoading(false);
  }
});

document.getElementById('btn-verify-otp').addEventListener('click', async () => {
  const code = document.getElementById('otp-input').value.trim();
  if (!code) return showError('otp-error', 'הזן קוד אימות');

  setLoading(true);
  try {
    const data = await apiFetch('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: currentPhone, code }),
    });
    token = data.token;
    localStorage.setItem('token', token);
    document.getElementById('user-name').textContent = `שלום, ${data.contact.name}`;
    await loadProducts();
    showScreen('screen-products');
  } catch (e) {
    showError('otp-error', e.message);
  } finally {
    setLoading(false);
  }
});

document.getElementById('btn-resend').addEventListener('click', async () => {
  setLoading(true);
  try {
    await apiFetch('/api/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone: currentPhone }) });
    document.getElementById('otp-error').classList.add('hidden');
  } catch (e) {
    showError('otp-error', e.message);
  } finally {
    setLoading(false);
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  token = null;
  localStorage.removeItem('token');
  cart = {};
  updateCartCount();
  document.getElementById('step-phone').classList.remove('hidden');
  document.getElementById('step-otp').classList.add('hidden');
  document.getElementById('phone-input').value = '';
  document.getElementById('otp-input').value = '';
  showScreen('screen-login');
});

// ── Products ───────────────────────────────────────────────────────────────────

async function loadProducts() {
  setLoading(true);
  try {
    products = await apiFetch('/api/products');
    renderProducts();
  } finally {
    setLoading(false);
  }
}

function getImageUrl(img) {
  if (!img) return null;
  if (img.startsWith('/')) return `${API}${img}`;
  return img;
}

function renderProducts() {
  const list = document.getElementById('products-list');
  list.innerHTML = '';
  products.forEach(p => {
    const qty = cart[p.id]?.quantity || 0;
    const priceDisplay = p.price != null ? `₪${Number(p.price).toFixed(2)}` : '';
    const imgUrl = getImageUrl(p.image);
    const row = document.createElement('div');
    row.className = 'product-row';
    row.innerHTML = `
      <div class="product-row-img">
        ${imgUrl ? `<img src="${imgUrl}" alt="${p.name}" loading="lazy">` : ''}
      </div>
      <div>
        <div class="product-row-name">${p.name}</div>
        ${p.unit ? `<div class="product-row-unit">${p.unit}</div>` : ''}
      </div>
      <div class="product-row-price">${priceDisplay}</div>
      <div class="quantity-control">
        <button class="qty-btn" onclick="changeQty('${p.id}', -1)">−</button>
        <span class="qty-display" id="qty-${p.id}">${qty}</span>
        <button class="qty-btn" onclick="changeQty('${p.id}', 1)">+</button>
      </div>
    `;
    list.appendChild(row);
  });
}

function changeQty(productId, delta) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const current = cart[productId]?.quantity || 0;
  const newQty = Math.max(0, current + delta);

  if (newQty === 0) {
    delete cart[productId];
  } else {
    cart[productId] = { product, quantity: newQty };
  }

  document.getElementById(`qty-${productId}`).textContent = newQty;
  updateCartCount();
}

function updateCartCount() {
  const total = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cart-count').textContent = total;
}

// ── Cart ───────────────────────────────────────────────────────────────────────

document.getElementById('btn-cart').addEventListener('click', () => {
  renderCart();
  showScreen('screen-cart');
});

document.getElementById('btn-back').addEventListener('click', () => {
  showScreen('screen-products');
});

function renderCart() {
  const container = document.getElementById('cart-items');
  const items = Object.values(cart);

  if (items.length === 0) {
    container.innerHTML = '';
    document.getElementById('cart-empty').classList.remove('hidden');
    document.getElementById('cart-footer').classList.add('hidden');
    return;
  }

  document.getElementById('cart-empty').classList.add('hidden');
  document.getElementById('cart-footer').classList.remove('hidden');

  container.innerHTML = items.map(({ product, quantity }) => {
    const lineTotal = product.price != null ? `₪${(Number(product.price) * quantity).toFixed(2)}` : '';
    return `
    <div class="cart-item">
      <div class="cart-item-name">${product.name}</div>
      <div class="quantity-control">
        <button class="qty-btn" onclick="changeQtyCart('${product.id}', -1)">−</button>
        <span class="qty-display">${quantity}</span>
        <button class="qty-btn" onclick="changeQtyCart('${product.id}', 1)">+</button>
      </div>
      <div class="cart-item-price">${lineTotal}</div>
    </div>`;
  }).join('');

  const total = items.reduce((sum, { product, quantity }) => sum + (Number(product.price) || 0) * quantity, 0);
  document.getElementById('cart-total').textContent = `₪${total.toFixed(2)}`;
}

function changeQtyCart(productId, delta) {
  changeQty(productId, delta);
  renderCart();
}

document.getElementById('btn-submit-order').addEventListener('click', async () => {
  const items = Object.values(cart).map(({ product, quantity }) => ({
    productId: product.id,
    quantity,
    price: product.price,
    name: product.name,
  }));
  const notes = document.getElementById('order-notes').value.trim();

  setLoading(true);
  try {
    const result = await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify({ items, notes }) });
    cart = {};
    document.getElementById('order-notes').value = '';
    updateCartCount();
    renderProducts();

    // הודעת אישור מותאמת אישית
    const msg = document.getElementById('confirm-msg');
    if (result.repName && result.repVerb && result.repContactVerb) {
      msg.textContent = `תודה רבה על ההזמנה, היא נקלטה במערכת, ${result.repName} ${result.repVerb} ${result.repContactVerb} איתכם קשר בקרוב לאישור ההזמנה`;
    } else {
      msg.textContent = 'תודה רבה על ההזמנה, היא נקלטה במערכת ויצרו איתכם קשר בקרוב לאישור ההזמנה';
    }

    showScreen('screen-confirm');
  } catch (e) {
    alert('שגיאה בשליחת ההזמנה: ' + e.message);
  } finally {
    setLoading(false);
  }
});

// ── Confirm ────────────────────────────────────────────────────────────────────

document.getElementById('btn-new-order').addEventListener('click', () => {
  showScreen('screen-products');
});

// ── Init ───────────────────────────────────────────────────────────────────────

(async () => {
  if (token) {
    try {
      await loadProducts();
      showScreen('screen-products');
    } catch {
      token = null;
      localStorage.removeItem('token');
      showScreen('screen-login');
    }
  } else {
    showScreen('screen-login');
  }
})();
