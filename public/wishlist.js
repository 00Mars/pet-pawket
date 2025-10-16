/* /public/wishlist.js — multi-page renderer (robust mounts + auth/empty + IO-safe swaps)
   Change: render exactly handles.length skeletons (no extra placeholders). */

import { PetsBus } from '/petsEvents.js';
import { api as maybeApi } from '/api.js';

// [pp:log]
try { console.info('[pp:wishlist] module loaded, scanning for roots…'); } catch {}

const SELECTORS = ['#wishlistPane', '[data-wishlist-list]', '.js-wishlist-list'];
const ROOTS = new Set();
SELECTORS.forEach(sel => document.querySelectorAll(sel).forEach(n => ROOTS.add(n)));

if (ROOTS.size === 0) {
  const mo = new MutationObserver(() => {
    let changed = false;
    SELECTORS.forEach(sel => document.querySelectorAll(sel).forEach(n => {
      if (!ROOTS.has(n)) { ROOTS.add(n); changed = true; }
    }));
    if (changed) { init(); }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

/* Prefer rendering into an inner [data-wishlist-list] if present */
function getMount(root) {
  return root.matches('[data-wishlist-list]') ? root : (root.querySelector('[data-wishlist-list]') || root);
}
function isDescendantOfAny(node, set) {
  for (const r of set) { if (r !== node && r.contains && r.contains(node)) return true; }
  return false;
}

const api = {
  async wishlistList() {
    if (maybeApi?.wishlistList) return maybeApi.wishlistList();
    const r = await fetch('/api/wishlist', { credentials: 'include' });
    return r.ok ? r.json() : { ok: false, items: [], status: r.status };
  },
  async wishlistAdd(handle) {
    if (maybeApi?.wishlistAdd) return maybeApi.wishlistAdd(handle);
    const r = await fetch('/api/wishlist', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle })
    });
    return { ok: r.ok, status: r.status };
  },
  async wishlistRemove(handle) {
    if (maybeApi?.wishlistRemove) return maybeApi.wishlistRemove(handle);
    const r = await fetch(`/api/wishlist/${encodeURIComponent(handle)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    return { ok: r.ok, status: r.status };
  },
  async productByHandle(handle) {
    const r = await fetch(`/api/products/handle/${encodeURIComponent(handle)}`, { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return j?.product || j; // unwrap { product }
  }
};

const cache = new Map();
const TTL_MS = 5 * 60 * 1000;
function getCached(h) { const hit = cache.get(h); if (!hit) return null; if (Date.now() - hit.t > TTL_MS) { cache.delete(h); return null; } return hit.product; }
function setCached(h, p) { cache.set(h, { t: Date.now(), product: p }); }

function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function priceUSD(p){const n=Number(p?.variants?.[0]?.price ?? p?.priceRange?.minVariantPrice?.amount ?? p?.price ?? NaN);return Number.isFinite(n)?`$${n.toFixed(2)}`:'';}
function imgUrl(p){return p?.image?.src || p?.featuredImage?.url || p?.images?.[0]?.src || p?.images?.[0]?.url || ''; }

function productCard(p){
  const handle=esc(p.handle||p.slug||''); const title=esc(p.title||p.name||'Product'); const price=priceUSD(p); const img=esc(imgUrl(p));
  return `
  <div class="col-6 col-md-4 col-lg-3 mb-3" data-wish-card="${handle}">
    <div class="card h-100">
      ${img?`<img class="card-img-top" src="${img}" alt="${title}" loading="lazy">`:`<div class="ratio ratio-1x1 bg-light"></div>`}
      <div class="card-body d-flex flex-column">
        <a class="stretched-link text-decoration-none mb-1" href="/products/${encodeURIComponent(handle)}?handle=${encodeURIComponent(handle)}">${title}</a>
        ${price?`<div class="text-muted mb-2">${price}</div>`:''}
        <div class="mt-auto d-flex gap-2">
          <button class="btn btn-outline-danger btn-sm js-wish-remove" data-handle="${handle}" aria-label="Remove ${title} from wishlist">Remove</button>
          <a class="btn btn-primary btn-sm" href="/products/${encodeURIComponent(handle)}?handle=${encodeURIComponent(handle)}" aria-label="View ${title}">View</a>
        </div>
      </div>
    </div>
  </div>`;}

function emptyState(){return `<p class="text-muted m-0">Your wishlist is empty.</p>`;}
function errorState(){return `<p class="text-danger m-0">Failed to load wishlist.</p>`;}
function authState(){return `<p class="text-muted m-0">Please sign in to view your wishlist.</p>`;}
function gridWrap(inner=''){return `<div class="row row-cols-2 row-cols-md-4 g-3" data-wishlist-grid>${inner}</div>`;}

/* IO-safe skeleton slot (stable marker to re-select later) */
function skeletonSlot(i){return `
  <div class="col-6 col-md-4 col-lg-3 mb-3" data-wish-slot="${i}">
    <div class="card h-100 placeholder-wave">
      <div class="ratio ratio-1x1 placeholder bg-light"></div>
      <div class="card-body">
        <div class="placeholder col-8 mb-2" style="height:1rem;"></div>
        <div class="placeholder col-4" style="height:1rem;"></div>
      </div>
    </div>
  </div>`;}

function wireCardActions(root){
  root.querySelectorAll('.js-wish-remove').forEach(btn=>{
    if (btn.dataset.wired==='1') return;
    btn.dataset.wired='1';
    btn.addEventListener('click', async (e)=>{
      const b=e.currentTarget; const handle=b.getAttribute('data-handle')||''; if(!handle) return;
      b.disabled=true;
      try{
        const r=await api.wishlistRemove(handle);
        if(r.ok){
          root.querySelector(`[data-wish-card="${CSS.escape(handle)}"]`)?.remove();
          const grid=root.querySelector('[data-wishlist-grid]');
          if (grid && grid.children.length===0) grid.innerHTML=emptyState();
          PetsBus.emit?.('wishlist:remove',{handle});
        }
      } finally { b.disabled=false; }
    });
  });
}

async function hydrateHandles(handles, gridEl){
  // [pp:change] render exactly as many skeletons as there are handles (no extras)
  const count = handles.length;
  gridEl.innerHTML = Array.from({length: count}).map((_,i)=>skeletonSlot(i)).join('');

  const loadOne = async (idx) => {
    const handle = handles[idx];
    if (!handle) return;
    const sel = `[data-wish-slot="${idx}"]`;
    let slot = gridEl.querySelector(sel);
    if (!slot) return; // already swapped or removed

    try {
      const cached = getCached(handle);
      const p = cached || await api.productByHandle(handle);
      if (!cached) setCached(handle, p);

      slot = gridEl.querySelector(sel);
      if (!slot || !slot.isConnected || !slot.parentNode) return;

      slot.outerHTML = productCard(p);
    } catch {
      slot = gridEl.querySelector(sel);
      if (!slot || !slot.isConnected || !slot.parentNode) return;
      slot.outerHTML = `
        <div class="col-6 col-md-4 col-lg-3 mb-3">
          <div class="card h-100 border-danger-subtle">
            <div class="card-body text-danger small">Failed to load product.</div>
          </div>
        </div>`;
    }
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(ent => {
        if (!ent.isIntersecting) return;
        const slot = ent.target;
        const idx = Number(slot.getAttribute('data-wish-slot'));
        io.unobserve(slot); // unobserve before any await
        Promise.resolve().then(() => { try { loadOne(idx); } catch {} });
      });
    }, { root: null, rootMargin: '120px 0px', threshold: 0.01 });

    gridEl.querySelectorAll('[data-wish-slot]').forEach(slot => io.observe(slot));

    // Eagerly load up to 4 or the full count, whichever is smaller
    const eager = Math.min(4, count);
    for (let i=0; i<eager; i++) { try { loadOne(i); } catch {} }
  } else {
    for (let i=0; i<count; i++) await loadOne(i);
  }
}

async function renderInto(root){
  const mount=getMount(root);
  if(!mount) return;
  try { console.info('[pp:wishlist] mount ->', mount); } catch {}

  mount.innerHTML=gridWrap();
  const grid=mount.querySelector('[data-wishlist-grid]');
  try{
    const res=await api.wishlistList();
    if (res && res.status===401){ grid.innerHTML=authState(); return; }

    const handles = Array.isArray(res) ? res
                  : Array.isArray(res?.items) ? res.items
                  : Array.isArray(res?.wishlist) ? res.wishlist
                  : [];
    if (handles.length===0){ grid.innerHTML=emptyState(); return; }

    await hydrateHandles(handles, grid);
    wireCardActions(mount);
    PetsBus.emit?.('wishlist:rendered',{count: handles.length});
  }catch(e){
    try{ console.error('[pp:wishlist] renderInto error', e); }catch{}
    grid.innerHTML=errorState();
  }
}

function init(){
  try { console.info('[pp:wishlist] init…'); } catch {}
  const roots = Array.from(ROOTS).filter(n => !isDescendantOfAny(n, ROOTS));
  roots.forEach(root => { try { renderInto(root); } catch(e) { try { console.error('[pp:wishlist] render error', e);}catch{} }});
}

// Kick if roots exist now
if (ROOTS.size) init();

// Manual kicker for DevTools
try { window.ppWishlistForceInit = init; } catch {}
// Bus listeners
PetsBus.on?.('wishlist:add',     () => init());
PetsBus.on?.('wishlist:remove',  () => init());
PetsBus.on?.('wishlist:refresh', () => init());
PetsBus.on?.('auth:login',       () => init());
PetsBus.on?.('auth:logout',      () => init());
