/* /public/navMini.js
   Navbar mini-cart + wishlist (observer-only; no DOM creation)
   - Wires the buttons already present in /navbar.html
   - Cart toggle:    #nav-cart-toggle   -> menu #cart-menu
   - Wishlist toggle:#nav-wish-toggle   -> menu #pp-wish-menu
   - Count pill:     #cart-count  (single source of truth)
   - Renders on hover, focus, Bootstrap 'show.bs.dropdown', or click
   - Listens to pp:cart:* and PetsBus wishlist events for live refresh
   - Adds: race-proof first-open handling, auth-tolerant wishlist loader,
           localStorage fallback, tiny TTL cache to avoid re-fetch flapping
*/

import { getCart } from '/cartUtils.js';
import { PetsBus } from '/petsEvents.js';

// Debug helper: lightweight runtime event collector for dropdown wiring/issues
if (typeof window !== 'undefined' && !window.__ppDropdownDebug) {
  try {
    window.__ppDropdownDebug = {
      events: [],
      push(tag, info) {
        try { this.events.push({ t: Date.now(), tag, info }); } catch {}
        try { console.debug('[pp:dbg]', tag, info); } catch {}
      }
    };
  } catch {}
}

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

/* ---------- tiny cache (avoid hammering endpoints) ---------- */
const CACHE_TTL_MS = 15_000; // 15s is plenty for mini views
const cache = {
  wishlist: { ts: 0, data: null, auth: null },
  cart:     { ts: 0, data: null },
};
const fresh = (ts) => (Date.now() - ts) < CACHE_TTL_MS;

/* ---------- localStorage fallback helpers (do NOT change keys) ---------- */
function fromLocal(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const val = JSON.parse(raw);
    if (Array.isArray(val)) return val;
    if (val && Array.isArray(val.items)) return val.items;
    if (val && Array.isArray(val.wishlist)) return val.wishlist;
    return fallback;
  } catch {
    return fallback;
  }
}
function toLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ---------- wishlist fetchers (auth-tolerant) ---------- */
async function fetchWishlistHandlesAPI() {
  const r = await fetch('/api/wishlist', { credentials: 'include' });
  if (r.status === 401) return { auth: false, handles: [] };
  if (!r.ok) throw new Error('wishlist ' + r.status);
  const j = await r.json();
  const handles = Array.isArray(j) ? j
    : Array.isArray(j?.items) ? j.items
    : Array.isArray(j?.wishlist) ? j.wishlist
    : [];
  return { auth: true, handles };
}

async function fetchWishlistHandles() {
  // Serve cached if fresh
  if (fresh(cache.wishlist.ts) && cache.wishlist.data) {
    return { auth: cache.wishlist.auth ?? true, handles: cache.wishlist.data };
  }
  try {
    const { auth, handles } = await fetchWishlistHandlesAPI();
    cache.wishlist = { ts: Date.now(), data: handles, auth };
    // Store a soft cache for UI continuity (doesn't replace API truth)
    toLocal('pp.wishlist', handles);
    return { auth, handles };
  } catch {
    // Fallback to local cache if available
    const handles = fromLocal('pp.wishlist', []);
    cache.wishlist = { ts: Date.now(), data: handles, auth: true };
    return { auth: true, handles, error: true };
  }
}

async function fetchProductByHandle(handle) {
  // Strict sanitize handle: non-empty, reasonable length, allowed chars only.
  const raw = String(handle || '').trim();
  if (!raw || raw.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9/_-]{0,199}$/.test(raw)) {
    throw new Error('Invalid product handle');
  }
  const h = raw;
  const r = await fetch(`/api/products/handle/${encodeURIComponent(h)}`, { credentials: 'include' });
  if (!r.ok) throw new Error('product fetch ' + r.status);
  const j = await r.json();
  return j?.product || j;
}

/* ---------- painters ---------- */
function paintBadge() {
  const pill = $('#cart-count');
  if (!pill) return;
  if (!fresh(cache.cart.ts)) {
    cache.cart.data = getCart() || [];
    cache.cart.ts = Date.now();
  }
  const cart = cache.cart.data;
  const total = (cart || []).reduce((s, it) => s + (Number(it?.quantity) || 0), 0);
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
  if (!fresh(cache.cart.ts)) {
    cache.cart.data = getCart() || [];
    cache.cart.ts = Date.now();
  }
  const cart = cache.cart.data;
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
  if (error && (!handles || handles.length === 0)) { menuEl.innerHTML = wishlistErrorHTML(); return; }
  if (!auth)  { menuEl.innerHTML = wishlistEmptyHTML(false); return; }
  // Filter out invalid handles (must match the server's allowed pattern)
  const validHandles = (handles || []).filter((h) => {
    const s = String(h || '').trim();
    return /^[A-Za-z0-9/_-]{1,200}$/.test(s);
  });
  if (!validHandles.length) { menuEl.innerHTML = wishlistEmptyHTML(true); return; }
  const max = 10;
  const toLoad = validHandles.slice(0, max);
  const cards = [];
  for (const h of toLoad) {
    try { const p = await fetchProductByHandle(h); cards.push(productCardMini(p)); }
    catch { /* skip individual failures */ }
  }
  menuEl.innerHTML = `
    <div class="p-3">
      <div class="d-flex gap-2 overflow-auto" style="max-width:min(90vw,520px)">${cards.join('')}</div>
      <div class="d-grid mt-2">
        <a class="btn btn-sm btn-outline-secondary" href="/wishlist.html">Open wishlist</a>
      </div>
      ${validHandles.length > max ? `<div class="text-muted small mt-2">Showing ${max} of ${validHandles.length}</div>` : ``}
    </div>`;
}

/* ---------- race-proof first-open + each-show binding ---------- */
function bindMini(toggleEl, renderFn, menuEl) {
  if (!toggleEl || !menuEl) return;
  try { window.__ppDropdownDebug?.push('navMini.bind:init', { id: toggleEl.id || null, cls: toggleEl.className }); } catch {}
  // Render once immediately so users see content even if no BS events fire.
  let firstPainted = false;
  const initial = () => { if (firstPainted) return; firstPainted = true; try { renderFn(menuEl); } catch {} };
  // Bootstrap path: render every time it’s shown (uses cache, so it’s light).
  on(toggleEl, 'shown.bs.dropdown', (ev) => { try { window.__ppDropdownDebug?.push('navMini.event', { type: 'shown.bs.dropdown', id: toggleEl.id }); } catch {} ; renderFn(menuEl); });
  // Non-BS path: hover/focus/click (first time) to ensure we paint if BS is blocked.
  on(toggleEl, 'mouseenter', (e) => { try { window.__ppDropdownDebug?.push('navMini.event', { type: 'mouseenter', id: toggleEl.id }); } catch {} ; initial(e); }, { once: true });
  on(toggleEl, 'focusin',   (e) => { try { window.__ppDropdownDebug?.push('navMini.event', { type: 'focusin', id: toggleEl.id }); } catch {} ; initial(e); }, { once: true });
  on(toggleEl, 'click',     (e) => { try { window.__ppDropdownDebug?.push('navMini.event', { type: 'click', id: toggleEl.id }); } catch {} ; initial(e); }, { once: true });
  try { toggleEl.dataset.wiredBy = (toggleEl.dataset.wiredBy ? toggleEl.dataset.wiredBy + ',navMini' : 'navMini'); } catch {}
}

/* ---------- wire existing DOM (no creation) ---------- */
function wire() {
  const cartToggle = $('#nav-cart-toggle');
  const cartMenu   = $('#cart-menu');
  const wishToggle = $('#nav-wish-toggle');
  const wishMenu   = $('#pp-wish-menu');
  if (!cartToggle || !cartMenu) return false;
  try { window.__ppDropdownDebug?.push('navMini.wire', { cartToggle: !!cartToggle, wishToggle: !!wishToggle }); } catch {}
  // Initial paints (fast local for cart; skeleton->fetch for wishlist runs on first open)
  try { paintBadge(); } catch {}
  try { renderMiniCart(cartMenu); } catch {}
  bindMini(cartToggle, (el) => renderMiniCart(el), cartMenu);
  if (wishToggle && wishMenu) bindMini(wishToggle, (el) => renderWishlist(el), wishMenu);
  try { cartToggle.dataset.wired = (cartToggle.dataset.wired ? cartToggle.dataset.wired + ',navMini' : 'navMini'); } catch {}
  try { if (wishToggle) wishToggle.dataset.wired = (wishToggle.dataset.wired ? wishToggle.dataset.wired + ',navMini' : 'navMini'); } catch {}
  // Live updates invalidate caches and repaint
  const repaintCart = () => { cache.cart.ts = 0; paintBadge(); renderMiniCart(cartMenu); };
  on(document, 'pp:cart:changed', repaintCart);
  on(document, 'pp:cart:add',     repaintCart);
  on(document, 'pp:cart:remove',  repaintCart);
  try {
    const reWish = () => { cache.wishlist.ts = 0; if (wishMenu) renderWishlist(wishMenu); };
    PetsBus.on?.('wishlist:add',     reWish);
    PetsBus.on?.('wishlist:remove',  reWish);
    PetsBus.on?.('wishlist:refresh', reWish);
    PetsBus.on?.('auth:login',       reWish);
    PetsBus.on?.('auth:logout',      reWish);
  } catch {}
  return true;
}

/* ---------- boot after navbar is injected ---------- */
(function boot() {
  // Prevent double-binding if navMini has already wired itself
  try { if (typeof window !== 'undefined' && window.__ppNavMiniWired) { window.__ppDropdownDebug?.push('navMini.alreadyWired', {}); return; } } catch {}
  try { if (typeof window !== 'undefined') window.__ppNavMiniWired = true; } catch {}
  if (wire()) return;
  const root = document.getElementById('navbar-container') || document.documentElement;
  const mo = new MutationObserver(() => { if (wire()) mo.disconnect(); });
  mo.observe(root, { childList: true, subtree: true });
})();
