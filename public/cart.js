// /public/cart.js
// LocalStorage cart + Storefront checkout (your existing model), plus
// dynamic navbar offset so content never hides behind fixed bars.

import { getCart, saveCart, updateCartBadge } from './cartUtils.js';

const T = {
  container: () => document.getElementById('cart-items'),
  total: () => document.getElementById('cart-total'),
  status: () => document.getElementById('cart-status'),
  checkoutBtn: () => document.getElementById('checkout-button'),
  navWrap: () => document.getElementById('navbar-container'),
};

/* ---------- NAV OFFSET (fixes top clipping) ---------- */
function throttle(fn, ms=150){ let t=null, lastArgs=null; return (...a)=>{ lastArgs=a; if(t) return; t=setTimeout(()=>{ t=null; fn(...lastArgs); }, ms); }; }

function measureNavOffset(){
  const root = T.navWrap();
  if (!root) return 0;
  // Try common parts in your navbar stack
  const bar = root.querySelector('.announcement-bar');
  const nav = root.querySelector('.custom-navbar') || root.querySelector('.navbar') || root.firstElementChild;
  let h = 0;
  if (bar) h += bar.offsetHeight || 0;
  if (nav) h += nav.offsetHeight || 0;
  // Fallback to 120px if nothing found (matches your visual stack)
  return h || 120;
}

function applyNavOffset(){
  const px = measureNavOffset();
  document.documentElement.style.setProperty('--nav-offset', px + 'px');
}

function initNavOffsetWatcher(){
  // Apply once after injection
  applyNavOffset();
  // Re-apply on resize
  window.addEventListener('resize', throttle(applyNavOffset, 150));
  // Watch injected navbar for size/structure changes
  const nav = T.navWrap();
  if (!nav) return;
  const mo = new MutationObserver(throttle(applyNavOffset, 50));
  mo.observe(nav, { childList:true, subtree:true, attributes:true });
}

/* ---------- Status helper ---------- */
function setStatus(msg=''){ const el = T.status(); if (el) el.textContent = msg; }

/* ---------- Render ---------- */
function renderCart() {
  const cartItems = getCart();
  const container = T.container();
  const totalEl = T.total();
  if (!container || !totalEl) return;

  container.innerHTML = '';
  let total = 0;

  if (cartItems.length === 0) {
    container.innerHTML = '<tr><td colspan="6" class="text-center py-4">Your cart is empty.</td></tr>';
    totalEl.textContent = '$0.00';
    updateCartBadge();
    return;
  }

  cartItems.forEach((item, index) => {
    total += item.price * item.quantity;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><img src="${escape(item.image)}" alt="" class="cart-thumb" loading="lazy" decoding="async"></td>
      <td>
        <p class="cart-title mb-1">${escape(item.title)}</p>
        ${item.variantTitle ? `<div class="cart-meta">${escape(item.variantTitle)}</div>` : ''}
      </td>
      <td class="text-end">$${Number(item.price).toFixed(2)}</td>
      <td class="text-center">
        <div class="qty-wrap">
          <input type="number" class="form-control quantity-input" name="quantity-${index}"
                 data-index="${index}" value="${item.quantity}" min="1" inputmode="numeric">
        </div>
      </td>
      <td class="text-end">$${(item.price * item.quantity).toFixed(2)}</td>
      <td class="text-end">
        <button class="btn btn-remove remove-item" data-index="${index}" aria-label="Remove item">×</button>
      </td>
    `;
    container.appendChild(row);
  });

  totalEl.textContent = `$${total.toFixed(2)}`;
  updateCartBadge();
}

/* ---------- Listeners ---------- */
function setupCartListeners() {
  const table = T.container();
  if (!table) return;

  table.addEventListener('change', (e) => {
    const input = e.target.closest('.quantity-input');
    if (!input) return;
    const index = Number(input.dataset.index);
    const cart = getCart();
    const next = Math.max(1, Number(input.value || 1));
    cart[index].quantity = next;
    saveCart(cart);
    renderCart();
  });

  table.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-item');
    if (!btn) return;
    const index = Number(btn.dataset.index);
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
    renderCart();
  });

  // Keep multiple tabs in sync
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'cart') renderCart();
  });
}

/* ---------- Checkout (Storefront) ---------- */
async function redirectToCheckout() {
  try {
    setStatus('Preparing checkout…');
    const cartItems = getCart();
    if (!cartItems.length) return;

    const lineItems = cartItems.map(item => ({
      variantId: item.variantId,
      quantity: item.quantity
    }));

    const res = await fetch('https://yx0ksi-xv.myshopify.com/api/2024-04/graphql.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': '409b760bb918367d377eb3a598c1298d'
      },
      body: JSON.stringify({
        query: `
          mutation checkoutCreate($input: CheckoutCreateInput!) {
            checkoutCreate(input: $input) {
              checkout { webUrl }
              checkoutUserErrors { message }
            }
          }`,
        variables: { input: { lineItems } }
      })
    });

    const json = await res.json();
    const checkoutUrl = json?.data?.checkoutCreate?.checkout?.webUrl;
    const errors = json?.data?.checkoutCreate?.checkoutUserErrors;

    if (checkoutUrl) {
      location.href = checkoutUrl;
    } else if (errors?.length) {
      alert('Checkout failed: ' + errors.map(e => e.message).join(', '));
    } else if (json.errors) {
      console.error('GraphQL Errors:', json.errors);
      alert('Checkout failed due to a server error.');
    } else {
      alert('Checkout failed. Please try again.');
    }
  } catch (e) {
    console.error('[checkout] error', e);
    alert('Could not start checkout. Please try again.');
  } finally {
    setStatus('');
  }
}

/* ---------- Utils ---------- */
function escape(s=''){ return String(s).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Wait a tick so navbar/footer injectors can run, then measure
  setTimeout(() => {
    initNavOffsetWatcher();
    renderCart();
    setupCartListeners();
    updateCartBadge();
    const btn = T.checkoutBtn();
    btn?.addEventListener('click', redirectToCheckout);
  }, 0);
});
