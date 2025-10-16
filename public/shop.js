/* /public/shop.js */

import { productCardHTML, productSkeletonHTML } from './components/productCard.js';
import { PetsBus } from './petsEvents.js';

console.info('[shop.js] v5-compact-mypets');

// incremental render invalidation token
let __pp_renderToken = 0;

const GRID         = document.getElementById('pp-grid');
const STATUS       = document.getElementById('pp-status');
const SEARCH       = document.getElementById('pp-search');
const SEL_CATEGORY = document.getElementById('pp-category');
const SEL_SORT     = document.getElementById('pp-sort');
const SEL_PAGE     = document.getElementById('pp-page-size');   // keep existing ID
const CHIPS_WRAP   = document.querySelector('.pp-chips');
const SUB_TOGGLE   = document.getElementById('pp-subscribe-only');
const MY_TOGGLE    = document.getElementById('pp-my-pets-toggle');
const PAGE         = document.querySelector('.shop-page');

const MODAL_EL       = document.getElementById('pp-subscribe-modal');
const MODAL_TITLE    = document.getElementById('pp-subscribe-title');
const MODAL_SUMMARY  = document.getElementById('pp-subscribe-summary');
const MODAL_INTERVAL = document.getElementById('pp-subscribe-interval');
const MODAL_PRICE    = document.getElementById('pp-subscribe-price');
const MODAL_CONFIRM  = document.getElementById('pp-subscribe-confirm');

let bsModal = null;
if (MODAL_EL && typeof bootstrap !== 'undefined') {
  // eslint-disable-next-line no-undef
  bsModal = new bootstrap.Modal(MODAL_EL, { backdrop: true, keyboard: true });
}

const ALLOW_OFFLINE  = (PAGE?.getAttribute('data-allow-offline') === 'true') || hasQuery('offline');
const INITIAL_LIMIT  = 36;
const CHUNK_SIZE     = 16;

// Subscription config
const SUBSCRIBE_DEFAULT   = { intervals: ['2w','4w','8w'], discountPct: 10 };
const SUBSCRIBE_OVERRIDES = {};

// Categories (kept consistent with existing)
const CATEGORY_RULES = [
  { key: 'dog',         tests: [/dog/i, /canine/i, /puppy/i, /chew/i, /leash/i, /collar/i] },
  { key: 'cat',         tests: [/cat/i, /feline/i, /kitten/i, /litter/i, /scratcher/i] },
  { key: 'small-pet',   tests: [/hamster/i, /bunny|rabbit/i, /guinea/i, /gerbil/i, /small pet/i] },
  { key: 'bird',        tests: [/bird/i, /parrot/i, /aviary/i, /perch/i, /seed/i] },
  { key: 'fish',        tests: [/fish/i, /aquarium/i, /betta/i, /filter/i, /tank/i] },
  { key: 'accessories', tests: [/bowl/i, /bed/i, /toy/i, /treat/i, /accessor/i, /apparel|bandana/i] },
];
const CATEGORY_KEYS = CATEGORY_RULES.map(r => r.key);

// Offline sample (tiny; used only if ALLOW_OFFLINE)
const SAMPLE_PRODUCTS = [
  { id: 'gid://shopify/Product/1', handle: 'rope-toy', title: 'Rope Toy', tags: ['dog','toy'], priceRange: { minVariantPrice: { amount: '9.99', currencyCode: 'USD' }, maxVariantPrice: { amount: '9.99', currencyCode: 'USD' } }, featuredImage: { url: '/assets/images/sample/rope-toy.jpg' } },
  { id: 'gid://shopify/Product/2', handle: 'cat-scratcher', title: 'Cat Scratcher', tags: ['cat','scratcher'], priceRange: { minVariantPrice: { amount: '19.99', currencyCode: 'USD' }, maxVariantPrice: { amount: '24.99', currencyCode: 'USD' } }, featuredImage: { url: '/assets/images/sample/cat-scratcher.jpg' } },
];

// State
const state = {
  all: [],
  filtered: [],
  byKey: Object.create(null),
  subscribeOnly: false,
  myPetsMode: false,
  myPets: [],
};

function setStatus(msg='') { if (STATUS) STATUS.textContent = msg; }

/* --------------------------------
   Boot + wiring
-------------------------------- */
const debouncedSearch = debounce(() => {
  updateQueryParam('q', SEARCH?.value || null);
  applyFiltersAndRender();
}, 200);

SEARCH?.addEventListener('input', debouncedSearch);

SEL_CATEGORY?.addEventListener('change', () => {
  const cat = getSelectedCategory();
  updateQueryParam('pet', cat || null);
  syncChips(cat);
  applyFiltersAndRender();
});

SEL_SORT?.addEventListener('change', () => {
  updateQueryParam('sort', SEL_SORT.value || null);
  applyFiltersAndRender();
});

SEL_PAGE?.addEventListener('change', () => {
  const val = Number(SEL_PAGE.value) || 0;
  updateQueryParam('per', val || null);
  applyFiltersAndRender();
});

CHIPS_WRAP?.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  const cat = (btn.getAttribute('data-chip') || '');
  setCategory(cat);
  applyFiltersAndRender();
});

SUB_TOGGLE?.addEventListener('change', () => {
  state.subscribeOnly = !!SUB_TOGGLE.checked;
  updateQueryParam('subscribe', state.subscribeOnly ? 1 : null);
  applyFiltersAndRender();
});

MY_TOGGLE?.addEventListener('change', async () => {
  state.myPetsMode = !!MY_TOGGLE.checked;
  updateQueryParam('mypets', state.myPetsMode ? 1 : null);
  if (state.myPetsMode) {
    await ensureMyPetsPane();
  } else {
    hideMyPetsPane();
  }
  applyFiltersAndRender();
});

// Navbar bridge → sync
document.addEventListener('pp:shop:set', async (e) => {
  const d = e.detail || {};
  if (typeof d.pet === 'string') setCategory(d.pet);
  if (typeof d.q === 'string' && SEARCH) { SEARCH.value = d.q; updateQueryParam('q', d.q || null); }
  if (typeof d.sort === 'string' && SEL_SORT) { SEL_SORT.value = d.sort; updateQueryParam('sort', d.sort || null); }
  if (typeof d.per !== 'undefined' && SEL_PAGE) { SEL_PAGE.value = String(d.per); updateQueryParam('per', d.per || null); }
  if (d.subscribe != null) { state.subscribeOnly = !!d.subscribe; updateQueryParam('subscribe', state.subscribeOnly ? 1 : null); }
  if (d.myPets != null) { state.myPetsMode = !!d.myPets; updateQueryParam('mypets', state.myPetsMode ? 1 : null); }
  syncToggles();
  if (state.myPetsMode) await ensureMyPetsPane();
  applyFiltersAndRender();
});

window.addEventListener('popstate', () => {
  hydrateFromURL();
  syncToggles();
  applyFiltersAndRender();
});

/* --------------------------------
   Data fetch / normalize
-------------------------------- */
async function loadProducts(limit) {
  const url = `/api/products/featured?limit=${Number(limit) || INITIAL_LIMIT}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  const res = await fetch(url, { credentials: 'include', signal: ctrl.signal });
  clearTimeout(t);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data?.items) ? data.items
            : Array.isArray(data?.products) ? data.products
            : Array.isArray(data?.products?.nodes) ? data.products.nodes
            : [];
  if (!Array.isArray(list)) throw new Error('Unexpected products shape');
  return list;
}

function enrichNode(p) { return { ...p, _category: inferCategory(p) }; }
function indexProducts() {
  state.byKey = Object.create(null);
  for (const p of state.all) {
    const k = p.id || p.handle || '';
    if (k) state.byKey[k] = p;
  }
}

/* --------------------------------
   Rendering (UPGRADED: chunked + delegated)
-------------------------------- */
function renderSkeleton(n = 8) {
  if (!GRID) return;
  let html = '';
  for (let i = 0; i < n; i++) html += productSkeletonHTML();
  GRID.innerHTML = html;
}

function renderGrid(list) {
  if (!GRID) return;
  if (!Array.isArray(list) || list.length === 0) { GRID.innerHTML = ''; return; }

  // Cancel any in-progress render
  __pp_renderToken++;
  const token = __pp_renderToken;

  GRID.innerHTML = '';

  // Single delegated listeners (prevents rebinding each render)
  if (!GRID.__pp_delegated) {
    GRID.addEventListener('click', (e) => {
      // Wishlist
      const wish = e.target.closest('.pp-card .wish');
      if (wish) { onWishClick(wish); return; }
    });
    GRID.addEventListener('keydown', (e) => {
      // Make Enter/Space activate the stretched-link for accessibility parity
      const a = e.target.closest('.pp-card .view-link');
      if (!a) return;
      if (e.key === 'Enter' || e.key === ' ') { a.click(); e.preventDefault(); }
    });
    GRID.__pp_delegated = true;
  }

  const n = list.length;
  let i = 0;

  const step = () => {
    if (token !== __pp_renderToken) return; // canceled
    const slice = list.slice(i, i + CHUNK_SIZE).map(productCardHTML).join('');
    GRID.insertAdjacentHTML('beforeend', slice);
    i += CHUNK_SIZE;
    if (i < n) {
      requestAnimationFrame(step);
    } else {
      injectSubscribeButtons(); // only once all cards are present
    }
  };

  requestAnimationFrame(step);
}

/* Subscribe UI (main grid and panes) */
function injectSubscribeButtons() {
  injectSubscribeButtonsIn(GRID, state.subscribeOnly);
}
function injectSubscribeButtonsIn(root, force=false) {
  if (!root) return;
  if (!force) {
    root.querySelectorAll('.pp-subscribe-cta').forEach(el => el.remove());
    if (!state.subscribeOnly) return;
  }
  root.querySelectorAll('.pp-card').forEach(card => {
    if (card.querySelector('.pp-subscribe-cta')) return;
    const id     = card.getAttribute('data-id') || card.getAttribute('data-product-id') || '';
    const handle = card.getAttribute('data-handle') || card.getAttribute('data-product-handle') || '';
    const key    = id || handle;

    // Prefer adding the subscribe row near existing CTAs
    const host = card.querySelector('.cta-row') || card.querySelector('.body') || card;
    const wrap = document.createElement('div');
    wrap.className = 'pp-subscribe-cta d-flex align-items-center justify-content-between mt-2';
    wrap.innerHTML = `
      <button type="button" class="btn btn-primary btn-sm" data-action="pp-subscribe" data-key="${key}">
        Subscribe
      </button>
      <small class="text-muted ms-2">Save ${getDefaultDiscount()}%</small>
    `;
    host.appendChild(wrap);
  });

  const handler = (e) => {
    const btn = e.target.closest('[data-action="pp-subscribe"]');
    if (!btn) return;
    openSubscribeModalForKey(btn.getAttribute('data-key') || '');
  };
  // Attach once per root
  root.removeEventListener('click', handler);
  root.addEventListener('click', handler);
}

function openSubscribeModalForKey(key) {
  if (!MODAL_EL || !MODAL_TITLE || !MODAL_INTERVAL || !MODAL_PRICE || !MODAL_CONFIRM) return;

  let p = state.byKey[key];
  if (!p) {
    const card = document.querySelector(`.pp-card [data-action="pp-subscribe"][data-key="${CSS.escape(key)}"]`)?.closest('.pp-card');
    if (card) {
      p = {
        id:     card.getAttribute('data-id') || null,
        handle: card.getAttribute('data-handle') || null,
        title:  card.querySelector('.title')?.textContent?.trim() || 'Product',
        featuredImage: { url: card.querySelector('img')?.getAttribute('src') || '' },
      };
    }
  }
  if (!p) return;

  const { intervals } = getSubConfig(p);
  MODAL_TITLE.textContent   = p.title || 'Subscribe';
  MODAL_SUMMARY && (MODAL_SUMMARY.textContent = 'Choose how often you’d like to receive this item.');
  MODAL_INTERVAL.innerHTML  = intervals.map(v => `<option value="${v}">${formatInterval(v)}</option>`).join('');

  const [min] = readPrices(state.byKey[key] || p);
  const priceAfter = (min ?? 0) * (1 - (getDefaultDiscount(p) / 100));
  MODAL_PRICE.textContent   = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(priceAfter);

  bsModal?.show();

  const onConfirm = async () => {
    try {
      // Emit to your subscription flow if present
      PetsBus?.emit?.('subscribe:add', { product: p.handle || p.id, interval: MODAL_INTERVAL.value });
    } catch {}
    gentleToast('Subscription added (preview).');
    bsModal?.hide();
    MODAL_CONFIRM.removeEventListener('click', onConfirm);
  };
  MODAL_CONFIRM.addEventListener('click', onConfirm, { once: true });
}

/* -------------------------------
   Wishlist (uses event bus; toggles heart icon)
-------------------------------- */
function onWishClick(btn) {
  const handle = btn.getAttribute('data-handle') || '';
  if (!handle) return;

  // Emit to existing event bus (keeps parity with the rest of the site)
  try { PetsBus.emit('wishlist:add', { handle }); } catch {}

  // Toggle pressed + icon (bi-heart ⇄ bi-heart-fill)
  const pressed = btn.getAttribute('aria-pressed') === 'true';
  btn.setAttribute('aria-pressed', String(!pressed));
  const icon = btn.querySelector('.bi');
  if (icon) {
    icon.classList.toggle('bi-heart', pressed);
    icon.classList.toggle('bi-heart-fill', !pressed);
  }
  gentleToast(pressed ? 'Removed from wishlist.' : 'Added to wishlist!');
}

/* --------------------------------
   My Pets pane (unchanged behavior)
-------------------------------- */
async function ensureMyPetsPane() {
  const host = document.getElementById('pp-my-pane');
  if (!host) return;
  host.classList.remove('d-none');
  host.innerHTML = loadingMyPetsHtml();
  try {
    const r = await fetch('/api/pets', { credentials: 'include' });
    if (!r.ok) throw new Error('pets');
    const pets = await r.json();
    state.myPets = Array.isArray(pets) ? pets : [];
    if (!state.myPets.length) { host.innerHTML = noPetsHtml(); return; }
    host.innerHTML = petsPaneHtml(state.myPets);
  } catch {
    host.innerHTML = loadErrorHtml();
  }
}
function hideMyPetsPane() {
  const host = document.getElementById('pp-my-pane');
  if (!host) return;
  host.innerHTML = '';
  host.classList.add('d-none');
}
function loadingMyPetsHtml() {
  return `
    <div class="alert alert-light border">
      <div class="d-flex align-items-center gap-2">
        <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
        <div>Loading recommendations…</div>
      </div>
    </div>`;
}
function needLoginHtml() {
  return `
    <div class="alert alert-light border">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-person-badge"></i>
        <div><strong>Sign in</strong> to see guidance and recommendations for your pets.</div>
      </div>
      <div class="mt-2">
        <a class="btn btn-primary btn-sm" href="/account/login">Sign in</a>
        <a class="btn btn-outline-secondary btn-sm ms-2" href="/for-my-pets.html">Manage pets</a>
      </div>
    </div>`;
}
function noPetsHtml() {
  return `
    <div class="alert alert-light border">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-heart"></i>
        <div><strong>No pets yet.</strong> Add a pet to get tailored guidance and subscription picks.</div>
      </div>
      <div class="mt-2">
        <a class="btn btn-primary btn-sm" href="/for-my-pets.html">Add a pet</a>
      </div>
    </div>`;
}
function loadErrorHtml() {
  return `<div class="alert alert-warning">We couldn’t load your pets. Please try again shortly.</div>`;
}

async function fetchPetRecs(petId) {
  const r = await fetch(`/api/pets/${encodeURIComponent(petId)}/recs?limit=16`, { credentials: 'include' });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j?.items) ? j.items.map(enrichNode) : [];
}
function petsPaneHtml(pets) {
  const items = pets.map(p => `
    <section class="pp-my-section" data-pet="${escapeHtml(p.name || '')}">
      <header class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h2 class="h5 m-0">${escapeHtml(p.name || 'Pet')}</h2>
        <a class="btn btn-outline-secondary btn-sm" href="/for-my-pets.html">Manage</a>
      </header>
      <div class="pp-my-recs" role="list" aria-label="Recommendations for ${escapeHtml(p.name || 'pet')}">
        <!-- You can populate with fetchPetRecs(p.id) if desired -->
      </div>
    </section>`).join('');
  return `<div class="pp-my-wrap">${items}</div>`;
}

/* --------------------------------
   Filter/sort pipeline
-------------------------------- */
function applyFiltersAndRender() {
  const per = getPageSize();
  const q = normalizeKey(SEARCH?.value || '');
  const selectedCat = getSelectedCategory();

  // Filter
  let list = state.all.slice();
  if (state.subscribeOnly) list = list.filter(isSubscribable);
  if (selectedCat) list = list.filter(p => (p._category || '') === selectedCat);
  if (q) list = list.filter(p => relevanceScore(p, q) > 0);

  // Sort
  const mode = SEL_SORT?.value || 'relevance';
  list.sort((a, b) => compareBy(mode, a, b, q));

  // Page size limit (0 = unlimited)
  const visible = per > 0 ? list.slice(0, per) : list;

  state.filtered = visible;
  renderGrid(visible);

  const baseMsg = `${list.length} product${list.length === 1 ? '' : 's'} shown${per>0?` (${visible.length} visible)`:''}.`;
  setStatus(state.myPetsMode ? `${baseMsg} For My Pets is on.` : `${baseMsg}`);
}

/* Sorting helpers */
function compareBy(mode, a, b, q) {
  const [minA] = readPrices(a), [minB] = readPrices(b);
  if (mode === 'price-asc')  return (minA ?? Infinity) - (minB ?? Infinity);
  if (mode === 'price-desc') return (minB ?? -Infinity) - (minA ?? -Infinity);
  if (mode === 'title-asc')  return (a.title || '').localeCompare(b.title || '');
  if (mode === 'title-desc') return (b.title || '').localeCompare(a.title || '');
  const sa = relevanceScore(a, q), sb = relevanceScore(b, q);
  if (sb !== sa) return sb - sa;
  return (minA ?? Infinity) - (minB ?? Infinity);
}
function textScore(p, q) {
  const t = (p?.title || '').toLowerCase();
  const h = (p?.handle || '').toLowerCase();
  return (t.includes(q) ? 2 : 0) + (h.includes(q) ? 1 : 0);
}
function relevanceScore(p, q) {
  let s = textScore(p, q);
  if ((p._category || '') && getSelectedCategory() === (p._category || '')) s += 1;
  return s;
}
function readPriceUSD(p) {
  const min = Number(p?.priceRange?.minVariantPrice?.amount ?? p?.price?.amount ?? p?.price ?? NaN);
  return [isFinite(min) ? min : null];
}
const BUDGET_WINDOWS = {
  value:   { min: 0,   max: 25 },
  mid:     { min: 10,  max: 80 },
  premium: { min: 40,  max: 250 },
  luxury:  { min: 100, max: Infinity }
};
function inBudget([min], band='mid'){ const w=BUDGET_WINDOWS[band]||BUDGET_WINDOWS.mid; if(min==null)return true; return (min>=w.min && min<=w.max); }
function readPrices(p) {
  const min = Number(p?.priceRange?.minVariantPrice?.amount ?? NaN);
  const max = Number(p?.priceRange?.maxVariantPrice?.amount ?? NaN);
  const cc  = p?.priceRange?.minVariantPrice?.currencyCode || p?.priceRange?.maxVariantPrice?.currencyCode || 'USD';
  return [Number.isFinite(min) ? min : null, Number.isFinite(max) ? max : null, cc];
}
function isSubscribable(p) {
  const tags = (p?.tags || []).map(t => String(t).toLowerCase());
  return !tags.includes('no-subscribe');
}
function getSubConfig(p) {
  const handle = String(p?.handle || '').trim().toLowerCase();
  return SUBSCRIBE_OVERRIDES[handle] || SUBSCRIBE_DEFAULT;
}
function getDefaultDiscount(p) { return getSubConfig(p).discountPct ?? SUBSCRIBE_DEFAULT.discountPct; }
function formatInterval(v) {
  const m = /^(\d+)([dwmy])$/i.exec(String(v));
  if (!m) return v;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const map = { d:'day', w:'week', m:'month', y:'year' };
  return `Every ${n} ${map[unit]}${n > 1 ? 's' : ''}`;
}

/* --------------------------------
   URL + helpers
-------------------------------- */
function hasQuery(key) { return new URL(location.href).searchParams.has(key); }
function readQuery(key, def = '') { const u = new URL(location.href); return u.searchParams.get(key) ?? def; }
function updateQueryParam(key, val) {
  const u = new URL(location.href);
  if (!val && val !== 0) u.searchParams.delete(key);
  else u.searchParams.set(key, String(val));
  history.replaceState(null, '', u);
}
function hydrateFromURL() {
  const q         = readQuery('q','');
  const pet       = readQuery('pet','');
  const sort      = readQuery('sort','');
  const per       = readQuery('per','');
  const subscribe = readQuery('subscribe','');
  const my        = readQuery('mypets','');

  if (q && SEARCH) SEARCH.value = q;
  if (SEL_SORT && sort) SEL_SORT.value = sort;
  setCategory(pet || '');
  if (SEL_PAGE && per !== '') SEL_PAGE.value = String(Number(per) || 0);

  state.subscribeOnly = (subscribe === '1' || subscribe === 'true');
  state.myPetsMode    = (my === '1' || my === 'true');
}
function getPageSize() {
  const raw = (SEL_PAGE && SEL_PAGE.value !== undefined) ? Number(SEL_PAGE.value) : NaN;
  return Number.isFinite(raw) ? raw : 0;
}
function normalizeKey(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, '-'); }
function debounce(fn, ms) { let t = null; return (...args) => { if (t) clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function inferCategory(p) {
  const hay = `${p.title||''} ${p.description||''} ${(p.tags||[]).join(' ')}`;
  for (const r of CATEGORY_RULES) if (r.tests.some(rx => rx.test(hay))) return r.key;
  return '';
}
function setCategory(k) {
  const val = CATEGORY_KEYS.includes(k) ? k : '';
  if (SEL_CATEGORY) SEL_CATEGORY.value = val;
  updateQueryParam('pet', val || null);
  syncChips(val);
}
function getSelectedCategory() {
  return (SEL_CATEGORY?.value && CATEGORY_KEYS.includes(SEL_CATEGORY.value)) ? SEL_CATEGORY.value : '';
}
function syncChips(activeKey='') {
  CHIPS_WRAP?.querySelectorAll('.chip').forEach(btn => {
    const key = btn.getAttribute('data-chip') || '';
    const pressed = key === activeKey;
    btn.setAttribute('aria-pressed', String(pressed));
    btn.classList.toggle('active', pressed);
  });
}
function syncToggles() {
  if (SUB_TOGGLE) SUB_TOGGLE.checked = !!state.subscribeOnly;
  if (MY_TOGGLE)  MY_TOGGLE.checked  = !!state.myPetsMode;
}

/* --------------------------------
   Tiny toast fallback (no dependency)
-------------------------------- */
function gentleToast(message = '') {
  try {
    // If you already have a site-wide toast, this will be ignored.
    const id = 'pp-gentle-toast';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.position = 'fixed';
      el.style.bottom = '1rem';
      el.style.right = '1rem';
      el.style.zIndex = '2000';
      document.body.appendChild(el);
    }
    const box = document.createElement('div');
    box.textContent = message;
    box.style.background = 'rgba(33, 37, 41, 0.9)';
    box.style.color = '#fff';
    box.style.padding = '0.5rem 0.75rem';
    box.style.borderRadius = '0.5rem';
    box.style.marginTop = '0.5rem';
    box.style.fontSize = '0.9rem';
    el.appendChild(box);
    setTimeout(() => box.remove(), 2000);
  } catch {}
}

/* --------------------------------
   Boot
-------------------------------- */
(async function boot() {
  try {
    hydrateFromURL();
    syncToggles();

    // show placeholders while loading
    const pageSize = Number(getPageSize?.() ?? 24) || 24;
    renderSkeleton(Math.max(8, Math.ceil(pageSize / 3)));

    const limit = (typeof INITIAL_LIMIT === 'number' && isFinite(INITIAL_LIMIT)) ? INITIAL_LIMIT : 48;
    const list = (typeof ALLOW_OFFLINE !== 'undefined' && ALLOW_OFFLINE) ? (SAMPLE_PRODUCTS || []) : await loadProducts(limit);

    state.all = (list || []).map(enrichNode);
    indexProducts();

    applyFiltersAndRender();
  } catch (err) {
    console.error('[shop] failed to load', err);
    setStatus?.('Sorry — having trouble loading products right now. Please retry.');
    if (typeof GRID !== 'undefined' && GRID) GRID.innerHTML = '';
  }
})();
