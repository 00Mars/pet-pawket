/* /public/navMini.js
   Navbar mini-cart + wishlist (observer-only; no DOM creation)
   - Wires the buttons already present in /navbar.html
   - Cart toggle:   #nav-cart-toggle   -> menu #cart-menu
   - Wishlist toggle:#nav-wish-toggle  -> menu #pp-wish-menu
   - Count pill:     #cart-count  (single source of truth)
   - Renders on hover, focus, or Bootstrap 'show.bs.dropdown'
   - Listens to pp:cart:* and PetsBus wishlist events for live refresh
*/

import { getCart } from '/cartUtils.js';
import { PetsBus } from '/petsEvents.js';

/* ---------- small utils ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const money = (n) => {
  const v = Number(n);
  return Number.isFinite(v)
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v)
    : '';
};

const on = (el, ev, fn, opts) => { try { el.addEventListener(ev, fn, opts); } catch {} };

/* ---------- wishlist fetchers ---------- */
async function fetchWishlistHandles() {
  try {
    const r = await fetch('/api/wishlist', { credentials: 'include' });
    if (r.status === 401) return { auth: false, handles: [] };
    const j = await r.json();
    const handles = Array.isArray(j) ? j
                   : Array.isArray(j?.items) ? j.items
                   : Array.isArray(j?.wishlist) ? j.wishlist
                   : [];
    return { auth: true, handles };
  } catch {
    return { auth: true, handles: [], error: true };
  }
}
async function fetchProductByHandle(handle) {
  const r = await fetch(`/api/products/handle/${encodeURIComponent(handle)}`, { credentials: 'include' });
  if (!r.ok) throw new Error('product fetch ' + r.status);
  const j = await r.json();
  return j?.product || j;
}

/* ---------- painters ---------- */
function paintBadge() {
  const pill = $('#cart-count');
  if (!pill) return;
  const total = (getCart() || []).reduce((s, it) => s + (Number(it?.quantity) || 0), 0);
  pill.textContent = String(total);
}

function cartEmptyHTML() {
  return `
    <div class="p-3">
      <div class="text-center text-muted small">Your cart is empty.</div>
      <div class="d-grid mt-2">
        <a class="btn btn-sm btn-primary" href="/shop.html">Shop now</a>
      </div>
    </div>`;
}

function renderMiniCart(menuEl) {
  const cart = getCart();
  if (!Array.isArray(cart) || cart.length === 0) { menuEl.innerHTML = cartEmptyHTML(); return; }

  const max = 6;
  const items = cart.slice(0, max);
  const subtotal = items.reduce(
    (s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0
  );

  const lines = items.map(it => {
    const img = it.image
      ? `<img src="${it.image}" alt="" class="flex-shrink-0 rounded" style="width:48px;height:48px;object-fit:cover;">`
      : `<div class="flex-shrink-0 rounded bg-light" style="width:48px;height:48px;"></div>`;
    const title = (it.title || 'Item') +
                  (it.variantTitle && it.variantTitle !== 'Default' ? ` — ${it.variantTitle}` : '');
    const qtyPrice = `${Number(it.quantity)||1} × ${money(Number(it.price)||0)}`;
    const lineTotal = money((Number(it.price)||0) * (Number(it.quantity)||0));
    return `
      <div class="list-group-item list-group-item-action d-flex align-items-center gap-2">
        ${img}
        <div class="flex-grow-1">
          <div class="text-truncate">${title}</div>
          <div class="text-muted small">${qtyPrice}</div>
        </div>
        <div class="ms-2 fw-semibold small">${lineTotal}</div>
      </div>`;
  }).join('');

  menuEl.innerHTML = `
    <div class="list-group list-group-flush">${lines}</div>
    <div class="p-3 border-top">
      <div class="d-flex justify-content-between align-items-center">
        <span class="fw-semibold">Subtotal</span>
        <span class="fw-bold">${money(subtotal)}</span>
      </div>
      <div class="d-grid gap-2 mt-2">
        <a class="btn btn-sm btn-outline-secondary" href="/cart.html">View cart</a>
        <a class="btn btn-sm btn-primary" href="/checkout">Checkout</a>
      </div>
      ${cart.length > max ? `<div class="text-muted small mt-2">Showing ${max} of ${cart.length}</div>` : ``}
    </div>`;
}

function wishlistSkeleton(menuEl) {
  menuEl.innerHTML = `
    <div class="p-3">
      <div class="d-flex gap-2 overflow-auto" style="max-width:min(90vw,520px)">
        ${Array.from({length:4}).map(()=>`
          <div class="card" style="width:120px;">
            <div class="ratio ratio-1x1 bg-light"></div>
            <div class="card-body p-2">
              <div class="placeholder-wave">
                <span class="placeholder col-8" style="height:0.8rem;"></span>
              </div>
            </div>
          </div>`).join('')}
      </div>
      <div class="d-grid mt-2">
        <a class="btn btn-sm btn-outline-secondary" href="/wishlist.html">Open wishlist</a>
      </div>
    </div>`;
}
function wishlistEmptyHTML(auth=true) {
  return `<div class="p-3 small ${auth ? 'text-muted' : ''}">
    ${auth ? 'Your wishlist is empty.' : 'Please sign in to view your wishlist.'}
  </div>`;
}
function wishlistErrorHTML() {
  return `<div class="p-3 small text-danger">Failed to load wishlist.</div>`;
}
function productCardMini(p) {
  const handle = encodeURIComponent(p.handle || p.slug || '');
  const img    = p?.image?.src || p?.featuredImage?.url || p?.images?.[0]?.src || p?.images?.[0]?.url || '';
  const title  = (p.title || p.name || 'Product').slice(0, 60);
  return `
    <a class="card text-decoration-none" href="/products/${handle}?handle=${handle}" style="width:140px;">
      ${img ? `<img class="card-img-top" src="${img}" alt="${title}" loading="lazy">`
             : `<div class="ratio ratio-1x1 bg-light"></div>`}
      <div class="card-body p-2">
        <div class="small text-truncate" title="${title}">${title}</div>
      </div>
    </a>`;
}
async function renderWishlist(menuEl) {
  wishlistSkeleton(menuEl);
  const { auth, handles, error } = await fetchWishlistHandles();
  if (error) { menuEl.innerHTML = wishlistErrorHTML(); return; }
  if (!auth)  { menuEl.innerHTML = wishlistEmptyHTML(false); return; }
  if (!handles.length) { menuEl.innerHTML = wishlistEmptyHTML(true); return; }

  const max = 10;
  const toLoad = handles.slice(0, max);
  const cards = [];
  for (const h of toLoad) {
    try { const p = await fetchProductByHandle(h); cards.push(productCardMini(p)); }
    catch { /* skip */ }
  }

  menuEl.innerHTML = `
    <div class="p-3">
      <div class="d-flex gap-2 overflow-auto" style="max-width:min(90vw,520px)">${cards.join('')}</div>
      <div class="d-grid mt-2">
        <a class="btn btn-sm btn-outline-secondary" href="/wishlist.html">Open wishlist</a>
      </div>
      ${handles.length > max ? `<div class="text-muted small mt-2">Showing ${max} of ${handles.length}</div>` : ``}
    </div>`;
}

/* ---------- wire existing DOM (no creation) ---------- */
function onFirstOpen(toggleEl, action) {
  if (!toggleEl) return;
  let done = false;
  const run = () => { if (done) return; done = true; Promise.resolve(action()).catch(()=>{}); };

  // Works with Bootstrap dropdowns
  on(toggleEl, 'show.bs.dropdown', run, { once: true });
  // Also work with pure CSS hover/focus
  on(toggleEl, 'mouseenter', run, { once: true });
  on(toggleEl, 'focusin',   run, { once: true });
  // Fallback on click
  on(toggleEl, 'click', run, { once: true });
}

function wire() {
  const cartToggle = $('#nav-cart-toggle');
  const cartMenu   = $('#cart-menu');
  const wishToggle = $('#nav-wish-toggle');
  const wishMenu   = $('#pp-wish-menu');

  if (!cartToggle || !cartMenu) return false;

  // Initial paint
  try { paintBadge(); } catch {}
  try { renderMiniCart(cartMenu); } catch {}

  // Lazy refresh on open
  onFirstOpen(cartToggle, () => renderMiniCart(cartMenu));
  if (wishToggle && wishMenu) onFirstOpen(wishToggle, () => renderWishlist(wishMenu));

  // Live updates
  on(document, 'pp:cart:changed', () => { paintBadge(); renderMiniCart(cartMenu); });
  on(document, 'pp:cart:add',     () => { paintBadge(); renderMiniCart(cartMenu); });
  try {
    PetsBus.on?.('wishlist:add',     () => { if (wishMenu) renderWishlist(wishMenu); });
    PetsBus.on?.('wishlist:remove',  () => { if (wishMenu) renderWishlist(wishMenu); });
    PetsBus.on?.('wishlist:refresh', () => { if (wishMenu) renderWishlist(wishMenu); });
    PetsBus.on?.('auth:login',       () => { if (wishMenu) renderWishlist(wishMenu); });
    PetsBus.on?.('auth:logout',      () => { if (wishMenu) renderWishlist(wishMenu); });
  } catch {}

  return true;
}

/* ---------- boot after navbar is injected ---------- */
(function boot() {
  if (wire()) return;
  const root = document.getElementById('navbar-container') || document.documentElement;
  const mo = new MutationObserver(() => { if (wire()) mo.disconnect(); });
  mo.observe(root, { childList: true, subtree: true });
})();
