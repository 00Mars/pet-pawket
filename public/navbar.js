// public/navbar.js — overlay wiring + navbar injection (sleek search UX + stable icon animation)
import { attachNavbarModals } from './navbarModals.js';
import { updateAuthDisplay, logout, login, onAuthChange } from './auth.js';
import { toggleMobileMenu } from './mobileToggle.js';
import { setupDropdownToggles } from './dropdownToggles.js';
import { setupResponsiveMobileMenu } from './mobileRelocation.js';

console.info('[navbar.js] v6.1-search-polish+icon-fix');

// ------- small helpers -------
function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function debounce(fn, ms=180){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
const byId = (...ids) => { for (const id of ids) { const el = id ? document.getElementById(id) : null; if (el) return el; } return null; };
const bySel = (root, ...sels) => { const R = root || document; for (const s of sels) { const el = s ? R.querySelector(s) : null; if (el) return el; } return null; };
const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);

// Optional helper (cookie auth is default; this only adds Bearer if present)
export function authFetch(url, options = {}) {
  const token = localStorage.getItem?.('authToken'); // may be null
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { credentials: 'include', ...options, headers });
}

// -------------------------------
// Cart badge (unchanged behaviour)
// -------------------------------
function ensureCartBadge(root = document) {
  const cartLink = root.querySelector('.cart-link, [href="/cart.html"]');
  if (!cartLink) return;
  if (cartLink.querySelector('#cart-count, .cart-count, .cart-badge')) return;
  const badge = document.createElement('span');
  badge.className = 'cart-count';
  badge.id = 'cart-count';
  badge.textContent = '0';
  cartLink.appendChild(badge);
}

// -------------------------------
// Auth UI wiring (kept minimal)
// -------------------------------
function wireLogoutButtons(root=document){
  root.querySelectorAll?.('#logoutBtn, #logout-btn, [data-action="logout"]').forEach((btn) => {
    if (btn.dataset.wiredLogout) return;
    btn.dataset.wiredLogout = '1';
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await logout(); await updateAuthDisplay(); }
      catch (err) { console.error('[logout] error:', err); }
    });
  });
}

function wireLoginForm(root=document){
  const form = (root.querySelector ? root.querySelector('#loginForm') : document.getElementById('loginForm'));
  if (!form || form.dataset.wiredLogin) return;
  form.dataset.wiredLogin = '1';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('[name="email"]')?.value || '';
    const password = form.querySelector('[name="password"]')?.value || '';
    try { await login(email, password); await updateAuthDisplay(); }
    catch (err) { console.error('[login] error:', err); }
  });
}

/* ========================================================================
   Search Icon Micro-interaction (fixes "random pops" on hover/tap)
   - Animates only the icon glyph (.bi-search) if present to avoid layout shift
   - Uses pointer events for consistent mouse/touch behavior
   - Avoids transition: all; transforms only
   - Disables hover scaling on touch-only devices
======================================================================== */
function injectSearchIconStyles(){
  if (document.getElementById('pp-search-icon-styles')) return;
  const style = document.createElement('style');
  style.id = 'pp-search-icon-styles';
  style.textContent = `
  /* Base target class we add at runtime */
  .pp-search-activator {
    --ppScale: 1;
    transform: translateZ(0) scale(var(--ppScale));
    transition: transform 160ms cubic-bezier(.2,.8,.2,1);
    will-change: transform;
    transform-origin: 50% 50%;
    backface-visibility: hidden;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    contain: paint; /* isolate transforms from parent button animations */
  }
  /* Hover only on devices that truly support it */
  @media (hover:hover) and (pointer:fine) {
    .pp-search-activator:hover,
    .pp-search-activator.is-hover { --ppScale: 1.12; }
    .pp-search-activator:active,
    .pp-search-activator.is-pressing { --ppScale: .96; transition-duration: 90ms; }
    .pp-search-activator:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(28,100,242,.25); border-radius: 8px; }
  }
  /* On touch, use an explicit pressed class instead of :hover emulation */
  @media (hover:none) {
    .pp-search-activator.is-pressing { --ppScale: .94; transition-duration: 90ms; }
  }
  /* When overlay is open, keep the icon steady */
  .pp-search-activator[data-state="open"] { --ppScale: 1 !important; }
  `;
  document.head.appendChild(style);
}

function wireSearchIconMicroUX(root=document){
  injectSearchIconStyles();

  const triggers = root.querySelectorAll?.(
    '#search-icon, .nav-search-btn, [data-action="open-search"], [aria-controls="search-overlay"], [aria-controls="searchOverlay"]'
  ) || [];

  triggers.forEach((el) => {
    // Prefer animating the inner search glyph if available
    const target = el.querySelector?.('.bi-search, [data-icon="search"], svg, i') || el;
    if (target.classList.contains('pp-search-activator')) return;
    target.classList.add('pp-search-activator');

    // Hover feel (attach to the trigger so even if pointer is over padding, glyph scales)
    el.addEventListener('pointerenter', (e)=>{ if (e.pointerType === 'mouse') target.classList.add('is-hover'); });
    el.addEventListener('pointerleave', ()=> target.classList.remove('is-hover'));

    // Press state for all pointers
    const pressOn = ()=> target.classList.add('is-pressing');
    const pressOff= ()=> target.classList.remove('is-pressing');
    el.addEventListener('pointerdown', pressOn, { passive:true });
    el.addEventListener('pointerup',   pressOff, { passive:true });
    el.addEventListener('pointercancel', pressOff);
    el.addEventListener('lostpointercapture', pressOff);
  });

  // Mark open/closed state for stable scaling
  const setOpenState = (isOpen) => {
    triggers.forEach((el) => {
      const t = el.querySelector?.('.pp-search-activator') || el;
      if (!t) return;
      if (isOpen) t.setAttribute('data-state','open'); else t.removeAttribute('data-state');
    });
  };
  // expose so the overlay code can toggle it
  window.__ppSearchIconState = setOpenState;
}

/* ========================================================================
   Search Overlay — polished UI (glass), thumbnails, keyboard nav
======================================================================== */
function injectSearchOverlayStyles(){
  if (document.getElementById('search-overlayStyles')) return;
  const style = document.createElement('style');
  style.id = 'search-overlayStyles';
  style.textContent = `
  :root{
    --pp-surface: rgba(255,255,255,.78);
    --pp-stroke: rgba(0,0,0,.08);
    --pp-muted: #6c757d;
    --pp-ring: rgba(28,100,242,.25);
    --pp-hover: rgba(0,0,0,.04);
    --pp-shadow: 0 10px 30px rgba(0,0,0,.15);
  }
  .hidden{display:none!important}
  #search-overlay, #searchOverlay, .search-overlay, .searchOverlay {
    position:fixed; inset:0; z-index:2147483000;
    display:flex; align-items:flex-start; justify-content:center;
    padding:10vh 16px;
    background:rgba(240,248,255,.28);
    -webkit-backdrop-filter: blur(14px) saturate(120%);
    backdrop-filter: blur(14px) saturate(120%);
  }
  #search-overlay.hidden, #searchOverlay.hidden, .search-overlay.hidden, .searchOverlay.hidden { display:none!important; }
  .search-card{
    width:min(980px,96vw);
    background:var(--pp-surface);
    border-radius:18px;
    border:1px solid var(--pp-stroke);
    box-shadow: var(--pp-shadow);
    overflow:hidden;
  }
  .search-head{
    display:flex; align-items:center; gap:.75rem;
    padding:.75rem 1rem; border-bottom:1px solid var(--pp-stroke);
    position:sticky; top:0; background:var(--pp-surface); z-index:2;
  }
  .search-head .input-wrap{ position:relative; flex:1; display:flex; align-items:center; }
  .search-head .input-wrap i{ position:absolute; left:10px; font-size:18px; opacity:.55; }
  .search-head input{
    width:100%; border:1px solid rgba(0,0,0,.12);
    border-radius:12px; padding:.55rem .9rem .55rem 2rem; font-size:16px; outline:none; background:#fff;
  }
  .search-head input:focus{ box-shadow:0 0 0 3px var(--pp-ring); border-color:rgba(28,100,242,.35); }
  .search-hints{ margin-left:auto; display:flex; gap:.35rem; align-items:center; color:var(--pp-muted); font-size:12px; }
  .kbd{border:1px solid rgba(0,0,0,.2);border-bottom-width:2px;border-radius:6px;padding:2px 6px;font-size:12px;color:#333;background:#f7f7f8}
  .search-tools{
    display:flex; gap:.5rem; align-items:center; padding:.5rem 1rem; border-bottom:1px solid var(--pp-stroke);
    background:linear-gradient(180deg, rgba(255,255,255,.85), rgba(255,255,255,.65));
    position:sticky; top:54px; z-index:1;
  }
  .search-tools select{ border:1px solid rgba(0,0,0,.12); border-radius:10px; padding:.45rem .75rem; background:#fff; }
  .search-tools button{ border:1px solid rgba(0,0,0,.12); border-radius:10px; padding:.45rem .75rem; background:#fff; cursor:pointer; }
  .search-results{ max-height:60vh; overflow:auto; padding:10px 12px; }
  .section-title{ font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--pp-muted); margin:10px 6px 6px; }
  .result-item{
    display:grid; grid-template-columns:56px 1fr auto; gap:12px; align-items:center;
    padding:10px; border-radius:12px; border:1px solid var(--pp-stroke); background:#fff;
    transition:transform .06s ease, box-shadow .06s ease, background-color .06s ease;
    text-decoration:none; color:inherit;
  }
  .result-item + .result-item{ margin-top:8px; }
  .result-item:hover{ transform:translateY(-1px); box-shadow:0 6px 18px rgba(0,0,0,.08); background: #fff; }
  .result-thumb{ width:56px; height:56px; border-radius:10px; object-fit:cover; background:#f4f5f7; border:1px solid var(--pp-stroke); display:flex; align-items:center; justify-content:center; font-weight:700; color:#444; }
  .result-body .title{ font-weight:700; line-height:1.2; }
  .result-body .meta{ font-size:12px; color:#6c757d; }
  .price{ font-weight:700; opacity:.9; }
  .tag{ display:inline-block; font-size:11px; padding:.15rem .4rem; border-radius:999px; border:1px solid var(--pp-stroke); margin-left:8px; color:#555; background:#fafafa; }
  .mark{ background: #fff2ac; border-radius:4px; padding:0 2px; }
  .skeleton{ animation: sk 1.1s linear infinite alternate; background:linear-gradient(90deg, #f2f3f4 0%, #f7f8f9 50%, #f2f3f4 100%); background-size:200% 100%; }
  .sk-line{ height:14px; border-radius:6px; }
  .sk-thumb{ width:56px; height:56px; border-radius:10px; }
  @keyframes sk { from{background-position:0% 0;} to{background-position:100% 0;} }
  `;
  document.head.appendChild(style);
}

function getOverlayEl(){ return byId('search-overlay', 'searchOverlay'); }

function ensureSearchOverlayMarkup(){
  let overlay = getOverlayEl();
  if (overlay) return overlay; // reuse if navbar.html already has it
  overlay = document.createElement('div');
  overlay.id = 'search-overlay';
  overlay.className = 'search-overlay hidden';
  overlay.innerHTML = `
    <div class="search-card" role="dialog" aria-modal="true" aria-labelledby="searchLabel">
      <div class="search-head">
        <div class="input-wrap">
          <i class="bi bi-search"></i>
          <input id="searchInput" type="text" placeholder="Search your pets, journal & products…" aria-label="Search" />
        </div>
        <div class="search-hints">
          <span class="d-none d-md-inline">Press</span><span class="kbd">/</span><span class="d-none d-md-inline">or</span><span class="kbd">⌘K</span>
          <button id="searchCloseBtn" class="search-close" title="Close" aria-label="Close">×</button>
        </div>
      </div>
      <div class="search-tools">
        <select id="searchCategory" aria-label="Category">
          <option value="all" selected>All Categories</option>
          <option value="products">Products</option>
          <option value="pets">Pets</option>
          <option value="journal">Journal</option>
        </select>
        <button id="searchGo" type="button">Search</button>
      </div>
      <div class="search-results" id="searchResults" role="listbox" aria-live="polite"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function openSearchOverlay(){
  injectSearchOverlayStyles();
  const overlay = ensureSearchOverlayMarkup();
  overlay.classList.remove('hidden');
  const input = overlay.querySelector('#searchInput, [data-search-input]');
  const results = overlay.querySelector('#searchResults, #search-results, .search-results');
  if (input && results){ input.value=''; results.innerHTML=''; setTimeout(()=>input.focus(),0); }
  document.documentElement.style.overflow = 'hidden';
  window.__petpawketSearch = window.__petpawketSearch || {};
  window.__petpawketSearch.open = openSearchOverlay;
  window.__petpawketSearch.close = closeSearchOverlay;
  window.__ppSearchIconState?.(true); // keep icon steady while open
  wireSearchOverlayOnce();
}

function closeSearchOverlay(){
  const overlay = getOverlayEl();
  if (!overlay) return;
  overlay.classList.add('hidden');
  const input = overlay.querySelector('#searchInput, [data-search-input]');
  const results = overlay.querySelector('#searchResults, #search-results, .search-results');
  if (input) input.value = '';
  if (results) results.innerHTML = '';
  document.documentElement.style.overflow = '';
  window.__ppSearchIconState?.(false);
}

function wireSearchOverlayOnce(){
  const overlay = getOverlayEl();
  if (!overlay || overlay.dataset.wiredOverlay) return;
  overlay.dataset.wiredOverlay = '1';
  const input    = overlay.querySelector('#searchInput, [data-search-input]');
  const results  = overlay.querySelector('#searchResults, #search-results, .search-results');
  const closeBtn = overlay.querySelector('#searchCloseBtn, .search-close, [data-close]');
  const goBtn    = overlay.querySelector('#searchGo');
  const catSel   = overlay.querySelector('#searchCategory');

  // Backdrop click closes (outside the card)
  overlay.addEventListener('click', (e) => {
    const card = overlay.querySelector('.search-card');
    if (card && !card.contains(e.target)) closeSearchOverlay();
  });
  if (closeBtn) closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); closeSearchOverlay(); });

  const setSkeleton = () => {
    if (!results) return;
    const block = (i) => `
      <div class="result-item">
        <div class="result-thumb skeleton sk-thumb"></div>
        <div class="result-body" style="display:flex;flex-direction:column;gap:6px;">
          <div class="skeleton sk-line" style="width:${70 + i*5}%"></div>
          <div class="skeleton sk-line" style="width:${40 + i*2}%"></div>
        </div>
      </div>`;
    results.innerHTML = `<div class="section-title">Searching…</div>${block(1)}${block(2)}${block(3)}`;
  };

  const runSearch = debounce(async () => {
    const q = (input?.value || '').trim();
    if (!q) { if (results) results.innerHTML = ''; return; }
    setSkeleton();
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      renderResults(results, data, { q, cat: catSel?.value || 'all' });
      wireKeyboardNav(results);
    } catch (err) {
      console.error('[search] error:', err);
      if (results) results.innerHTML = `<div class="result-item"><div class="result-body"><div class="title">Search failed</div><div class="meta">Please try again.</div></div></div>`;
    }
  }, 240);

  if (input){
    input.addEventListener('input', runSearch);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
  }
  if (goBtn) goBtn.addEventListener('click', (e)=>{ e.preventDefault(); runSearch(); });
  if (catSel) catSel.addEventListener('change', runSearch);

  // Hotkeys
  document.addEventListener('keydown', (e) => {
    const isMac = (navigator.platform || '').toUpperCase().includes('MAC');
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearchOverlay(); }
    const tag = document.activeElement?.tagName;
    if (e.key === '/' && !['INPUT','TEXTAREA'].includes(tag || '')) { e.preventDefault(); openSearchOverlay(); }
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) { e.preventDefault(); closeSearchOverlay(); }
  });
}

function highlight(text, q){
  if (!text || !q) return escapeHtml(text || '');
  try {
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')})`,'ig');
    return escapeHtml(text).replace(re, '<span class="mark">$1</span>');
  } catch { return escapeHtml(text); }
}

function renderResults(container, payload, { q, cat='all' }){
  if (!container) return;
  const pets = payload?.pets || [];
  const journal = payload?.journal || [];
  const products = payload?.products || [];

  const sections = [];

  if ((cat==='pets' || cat==='all') && pets.length){
    sections.push(`
      <div class="section-title">Pets</div>
      ${pets.map(p => {
        const initials = (p.name || '?').slice(0,1).toUpperCase();
        const meta = [p.species, p.breed].filter(Boolean).join(' • ');
        return `
        <a class="result-item" href="/account.html#pets" tabindex="0" role="option">
          <div class="result-thumb" aria-hidden="true">${escapeHtml(initials)}</div>
          <div class="result-body">
            <div class="title">${highlight(p.name || 'Pet', q)} <span class="tag">Profile</span></div>
            <div class="meta">${escapeHtml(meta)}</div>
          </div>
          <div class="price"><i class="bi bi-heart"></i></div>
        </a>`;
      }).join('')}
    `);
  }

  if ((cat==='journal' || cat==='all') && journal.length){
    sections.push(`
      <div class="section-title">Journal</div>
      ${journal.map(e => {
        const text = (e.text || '');
        const snippet = text.length > 140 ? text.slice(0,140)+'…' : text;
        return `
        <a class="result-item" href="/account.html#journal" tabindex="0" role="option">
          <div class="result-thumb" aria-hidden="true"><i class="bi bi-journals"></i></div>
          <div class="result-body">
            <div class="title">${highlight(e.petName || 'Pet', q)} <span class="tag">Entry</span></div>
            <div class="meta">${highlight(snippet, q)} ${e.mood ? `• Mood: ${escapeHtml(e.mood)}` : ''}</div>
          </div>
          <div class="price"><i class="bi bi-arrow-right-short"></i></div>
        </a>`;
      }).join('')}
    `);
  }

  if ((cat==='products' || cat==='all') && products.length){
    sections.push(`
      <div class="section-title">Products</div>
      ${products.map(p => {
        const img = p.featuredImage?.url || p.image || '';
        return `
        <a class="result-item" href="/products/${encodeURIComponent(p.handle)}" tabindex="0" role="option">
          <img class="result-thumb" src="${escapeHtml(img || '/assets/images/placeholder.png')}" alt="" />
          <div class="result-body">
            <div class="title">${highlight(p.title, q)} ${p.availableForSale ? '' : '<span class="tag">Out</span>'}</div>
            <div class="meta">${p.productType ? escapeHtml(p.productType) : 'Product'} ${p.vendor ? '• '+escapeHtml(p.vendor) : ''}</div>
          </div>
          <div class="price">${p.price ? `$${Number(p.price).toFixed(2)}` : ''}</div>
        </a>`;
      }).slice(0,12).join('')}
    `);
  }

  container.innerHTML = sections.join('') || `
    <div class="section-title">No results</div>
    <div class="result-item"><div class="result-thumb">✦</div><div class="result-body"><div class="title">No results for “${escapeHtml(q)}”.</div><div class="meta">Try another keyword.</div></div></div>
  `;
}

// Keyboard nav for results list (↑/↓/Enter)
function wireKeyboardNav(container){
  if (!container) return;
  const items = [...container.querySelectorAll('.result-item')];
  if (!items.length) return;

  let idx = 0;
  const focusItem = (i) => {
    idx = (i + items.length) % items.length;
    items[idx].focus();
    items[idx].scrollIntoView({ block:'nearest', inline:'nearest' });
  };

  // Prime first item
  items[0].setAttribute('tabindex','0');

  container.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown'){ e.preventDefault(); focusItem(idx+1); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); focusItem(idx-1); }
    else if (e.key === 'Enter'){
      const a = document.activeElement?.closest('.result-item');
      if (a && a.getAttribute('href')) { window.location.href = a.getAttribute('href'); }
    }
  }, { passive:false });
}

// Global delegated click: works even if navbar not yet injected
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="open-search"], [data-toggle="search-overlay"], [aria-controls="search-overlay"], [aria-controls="searchOverlay"], #searchOpenBtn, .nav-search-btn, .search-toggle, #search-icon');
  if (!btn) return;
  e.preventDefault();
  openSearchOverlay();
});

// -------------------------------
// Exported: injectNavbar
// -------------------------------
export function injectNavbar(callback){
  fetch('/navbar.html', { credentials: 'include' })
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
    .then((html) => {
      let container = document.getElementById('navbar-container');
      if (!container){ container = document.createElement('div'); container.id = 'navbar-container'; document.body.prepend(container); }
      container.innerHTML = html;

      // Normalize legacy IDs so CSS works consistently
      (function normalizeIds() {
        const map = {
          'searchOverlay': 'search-overlay',
          'searchResults': 'search-results',
          'mobileMenu': 'mobile-menu',
          'mobileToggle-left': 'mobile-toggle-left',
          'mobileToggle-center': 'mobile-toggle-center',
          'heroCarousel': 'hero-carousel',
          'editPetJournal': 'edit-pet-journal',
          'journalModal': 'journal-modal',
        };
        for (const [oldId, nextId] of Object.entries(map)) {
          const oldEl = document.getElementById(oldId);
          if (oldEl && !document.getElementById(nextId)) oldEl.id = nextId;
        }
      })();

      // Wire icon micro-interaction on the injected navbar
      wireSearchIconMicroUX(container);

      // If navbar.html already includes the overlay structure, preload styles
      (function wireSearchOverlayIfPresent() {
        const overlay = byId('search-overlay', 'searchOverlay');
        if (!overlay) return;
        injectSearchOverlayStyles();
      })();

      requestAnimationFrame(() => {
        attachNavbarModals?.();
        onAuthChange?.(updateAuthDisplay);
        updateAuthDisplay?.();
        wireLogoutButtons(container);
        wireLoginForm(container);
        ensureCartBadge();

        try { callback?.(); } catch (e) { console.warn('[injectNavbar] callback warn:', e); }
      });

      if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch-device');

      const toggles = container.querySelectorAll('.mobile-menu-toggle');
      toggles.forEach((t) => t.addEventListener('click', toggleMobileMenu));
      setupResponsiveMobileMenu?.();
      setupDropdownToggles?.();
    })
    .catch((err) => console.error('[injectNavbar] Injection failed:', err));
}

// Auto-run on DOM ready so the navbar appears and the search trigger is active.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => injectNavbar());
} else {
  injectNavbar();
}
