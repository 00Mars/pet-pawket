/* /public/accountPetsBridge.js — “For My Pets” pane (integrated, credentials-safe, typo fixes)
 * - Zero HTML changes; Bootstrap-safe; no inline CSS/JS.
 * - Lazy render per-pet with IntersectionObserver; cancel stale fetches.
 * - Caching (5m TTL) for product search, featured, subs; dedupe products.
 * - Deterministic per-pet order; “Load more” pagination in-memory.
 * - CTAs: Wishlist, Add to Box, optional Start a plan → emit bus events.
 * - Pane toggle persists via /api/prefs/forMyPets or localStorage fallback.
 */

import { api } from '/api.js';
import { PetsBus } from '/petsEvents.js';

const PANE    = document.getElementById('myPetsPane');
const TOGGLE  = document.getElementById('toggleMyPetsPane');
const CONTENT = document.getElementById('myPetsContent');
const SPECIES_GUARDS = ['dog','cat','bird','rabbit','hamster','guinea pig','reptile','fish','horse','ferret'];

if (PANE && TOGGLE && CONTENT) {
  // ensure the shell itself is visible (HTML has `hidden` on first render)
  PANE.hidden = false;
  PANE.classList.remove('hidden','d-none');

  /* -------------------- utils -------------------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const debounce = (fn, ms=200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const hash = (s) => { let h=2166136261>>>0; for (let i=0;i<s.length;i++){h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; };
  const clamp = (n,min,max) => Math.max(min, Math.min(max, n));

  // in-memory TTL cache
  const TTL_MS = 5 * 60 * 1000;
  const cache = new Map(); // key -> { t, v }
  const getCached = (k) => {
    const r = cache.get(k);
    if (!r) return null;
    if ((Date.now() - r.t) > TTL_MS) { cache.delete(k); return null; }
    return r.v;
  };
  const setCached = (k, v) => cache.set(k, { t: Date.now(), v });

  // Abort controllers per pet fetch
  const inflight = new Map(); // petId -> AbortController
  const abortFor = (petId) => { inflight.get(petId)?.abort(); inflight.delete(petId); };
  const controllerFor = (petId) => { abortFor(petId); const c = new AbortController(); inflight.set(petId, c); return c; };

  // ---- Price helpers (Shopify priceRange aware) ----
  function readPriceUSD(p) {
    const min = Number(p?.priceRange?.minVariantPrice?.amount ?? p?.price?.amount ?? p?.price ?? NaN);
    const max = Number(p?.priceRange?.maxVariantPrice?.amount ?? min);
    return [isFinite(min) ? min : null, isFinite(max) ? max : (isFinite(min) ? min : null)];
  }

  // Budget bands in USD
  const BUDGET_WINDOWS = {
    value:   { min: 0,   max: 25 },
    mid:     { min: 10,  max: 80 },
    premium: { min: 40,  max: 250 },
    luxury:  { min: 100, max: Infinity }
  };

  function inBudgetWindow([min], band='mid') {
    const { min: lo, max: hi } = BUDGET_WINDOWS[band] || BUDGET_WINDOWS.mid;
    if (min == null) return true;
    return (min >= lo && min <= hi);
  }
  function budgetDistance([min], band='mid') {
    const { min: lo, max: hi } = BUDGET_WINDOWS[band] || BUDGET_WINDOWS.mid;
    if (min == null) return 0;
    if (min < lo) return lo - min;
    if (min > hi) return min - hi;
    return 0;
  }

  // ---- Affinity / Exclusion helpers ----
  function toKeywords(arr) { return (Array.isArray(arr) ? arr : []).map(s => String(s).toLowerCase()).filter(Boolean); }

  function productKeywords(p) {
    const tokenize = (s) => String(s||'')
      .toLowerCase()
      .replace(/[^a-z0-9\s\-\/]/g,' ')
      .split(/\s+/)
      .filter(Boolean);

    const title   = tokenize(p.title || p.name);
    const vendor  = tokenize(p.vendor || p.brand);
    const type    = tokenize(p.productType || p.type);
    const tags    = (p.tags || p.tagList || []).flatMap(tokenize);
    const options = (p.options || p.variants?.[0]?.selectedOptions || [])
                      .flatMap(o => tokenize((o?.name||'') + ' ' + (o?.value||'')));
    return { title, vendor, type, tags, options };
  }

  function penaltyForExclusions(p, exclusions=[]) {
    if (!exclusions.length) return 0;
    const { title, type, tags, options, vendor } = productKeywords(p);
    const hay = new Set([...title, ...type, ...tags, ...options, ...vendor]);
    let penalty = 0;
    for (const x of exclusions) if (hay.has(x)) penalty -= 8;
    return penalty;
  }
  function boostForAffinities(p, affinities=[]) {
    if (!affinities.length) return 0;
    const { title, type, tags, options, vendor } = productKeywords(p);
    const hay = new Set([...title, ...type, ...tags, ...options, ...vendor]);
    let boost = 0;
    for (const a of affinities) if (hay.has(a)) boost += 4;
    return boost;
  }

  // Lightweight per-pet local “thumbs-down” memory (no backend)
  function getLocalDislikes(petId) {
    try { return new Set(JSON.parse(localStorage.getItem(`pp_dislikes_${petId}`) || '[]')); } catch { return new Set(); }
  }
  function addLocalDislike(petId, handle='') {
    try {
      const k = `pp_dislikes_${petId}`;
      const s = new Set(JSON.parse(localStorage.getItem(k) || '[]'));
      if (handle) s.add(handle);
      localStorage.setItem(k, JSON.stringify([...s]));
    } catch {}
  }

  /* -------------------- pane toggle -------------------- */
  function readToggleOn() {
    if (TOGGLE.matches('input[type="checkbox"]')) return !!TOGGLE.checked;
    const ap = TOGGLE.getAttribute('aria-pressed');
    if (ap != null) return ap === 'true';
    return false;
  }
  function writeToggleOn(on) {
    if (TOGGLE.matches('input[type="checkbox"]')) TOGGLE.checked = !!on;
    TOGGLE.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function setPane(on) {
    writeToggleOn(on);
    CONTENT.classList.toggle('d-none', !on);
    if (on) CONTENT.removeAttribute('aria-hidden'); else CONTENT.setAttribute('aria-hidden', 'true');
  }
  async function applyPersistedToggle() {
    try {
      const pref = await api.prefsGetForMyPets();
      const on = pref?.on === true;
      setPane(on);
      localStorage.setItem('pp_forMyPets_on', on ? '1' : '0');
    } catch {
      const ls = localStorage.getItem('pp_forMyPets_on');
      setPane(ls === '1');
    }
  }
  const toggleHandler = async () => {
    const on = readToggleOn();
    setPane(on);
    try {
      await api.prefsSetForMyPets(on);
      localStorage.setItem('pp_forMyPets_on', on ? '1' : '0');
    } catch {
      localStorage.setItem('pp_forMyPets_on', on ? '1' : '0');
    }
    if (on) scheduleRefresh();
  };
  TOGGLE.addEventListener(TOGGLE.matches('input[type="checkbox"]') ? 'change' : 'click', toggleHandler);

  /* -------------------- relevance + query -------------------- */
  function tokensFromTraitsQuery(q) {
    const base = String(q||'').toLowerCase().replace(/[^a-z0-9\s\-\/]/g,' ').split(/\s+/).filter(Boolean);
    const weights = new Map();
    const boost = (tok, w=1) => weights.set(tok, (weights.get(tok)||0)+w);

    base.forEach(t => boost(t, 1));
    ['power','chewer','catnip','litter','harness','terrarium','uvb','freshwater','saltwater','blanket'].forEach(t => {
      if (base.includes(t)) boost(t, 2);
    });
    if (base.includes('guinea') && base.includes('pig')) boost('guinea pig', 2);
    return weights;
  }
  function isLikelyMismatchSpecies(p, speciesToken) {
    if (!speciesToken) return false;
    const { title, type, tags } = productKeywords(p);
    const all = [...title, ...type, ...tags];
    const hasOtherSpecies = SPECIES_GUARDS.some(s => s !== speciesToken && all.includes(s));
    return hasOtherSpecies;
  }
  function scoreProduct(weights, p, speciesToken, petCtx = {}) {
    const { title, vendor, type, tags, options } = productKeywords(p);
    let score = 0;
    for (const [tok, w] of weights.entries()) {
      if (title.includes(tok))  score += 6*w;
      if (type.includes(tok))   score += 4*w;
      if (tags.includes(tok))   score += 3*w;
      if (vendor.includes(tok)) score += 1*w;
      if (options.includes(tok))score += 1*w;
    }
    const tagset = new Set(tags);
    if (tagset.has('bestseller') || tagset.has('best-seller')) score += 3;
    const available = (p.available ?? p.inStock ?? (p.inventoryQuantity > 0) ?? true);
    if (available) score += 1.25; else score -= 3;

    if (isLikelyMismatchSpecies(p, speciesToken)) score -= 6;

    const band = petCtx.budgetBand || 'mid';
    const [min] = readPriceUSD(p);
    if (!inBudgetWindow([min], band)) {
      const d = budgetDistance([min], band);
      score += (d > 100 ? -8 : -3);
    } else {
      score += 2;
    }

    score += boostForAffinities(p, toKeywords(petCtx.affinities));
    score += penaltyForExclusions(p, toKeywords(petCtx.exclusions));
    if (petCtx.dislikes && petCtx.dislikes.has(p.handle || p.slug)) score -= 10;

    return score;
  }
  function rerankProductsByTraits(q, products, petCtx={}) {
    const weights = tokensFromTraitsQuery(q);
    const speciesToken = SPECIES_GUARDS.find(s => q.includes(s)) || null;
    const ranked = (products || []).map(p => ({ p, _score: scoreProduct(weights, p, speciesToken, petCtx) }));
    ranked.sort((a,b) => b._score - a._score);
    return ranked.map(r => r.p);
  }
  function traitsToQuery(pet) {
    const spRaw = (pet.type || pet.species || '').toString().trim().toLowerCase();
    const sp = spRaw || '';
    const t  = pet.traits || {};
    const bag = new Set();
    const add = (v) => { if (v == null) return; const s = String(v).trim().toLowerCase(); if (s) bag.add(s); };
    const addMany = (arr) => { if (!Array.isArray(arr)) return; for (const v of arr) add(v); };

    if (sp) add(sp);
    addMany(t.diets);
    addMany(t.flavors);
    if (Array.isArray(t.allergies) && t.allergies.length) add('allergy friendly');
    if (Array.isArray(t.affinities)) addMany(t.affinities);

    switch (sp) {
      case 'dog': {
        if (t.size) add(String(t.size));
        const chew = String(t.chewStrength || '').toLowerCase();
        if (chew) { add(chew); if (chew.includes('power')) add('power chewer'); }
        const play = String(t.playStyle || '').toLowerCase();
        if (play) {
          add(play);
          if (play.includes('fetch')) { add('ball'); add('fetch toy'); }
          if (play.includes('tug'))   { add('tug toy'); add('rope'); }
          if (play.includes('chew'))  { add('chew'); add('chewer'); }
          if (play.includes('puzzle')) add('puzzle');
        }
        const energy = String(t.energyLevel || '').toLowerCase(); if (energy) add(`${energy} energy`);
        if (t.fetchDrive === true) { add('fetch'); add('ball'); }
        if (t.neckIn || t.chestIn) add('harness');
        const coat = String(t.coatLength || '').toLowerCase(); if (coat) add(`${coat} hair`);
        break;
      }
      case 'cat': {
        if (t.litterTrained === true) add('litter');
        if (t.catnip === true)        add('catnip');
        const play = String(t.playStyle || '').toLowerCase();
        if (play) {
          add(play);
          if (play.includes('chase'))  { add('teaser'); add('wand'); }
          if (play.includes('puzzle')) add('puzzle');
          if (play.includes('cuddle')) add('plush');
        }
        const coat = String(t.coatLength || '').toLowerCase(); if (coat) add(`${coat} hair`);
        break;
      }
      case 'rabbit': { add('rabbit supplies'); if (t.litterTrained === true) add('litter'); break; }
      case 'guinea pig': { add('guinea pig supplies'); if (t.litterTrained === true) add('litter'); break; }
      case 'hamster': { add('hamster supplies'); add('cage'); add('wheel'); add('bedding'); add('hideout'); break; }
      case 'ferret': { add('ferret supplies'); if (t.litterTrained === true) add('litter'); if (t.neckIn || t.chestIn) add('harness'); break; }
      case 'bird': { add('bird cage'); add('perch'); add('toys'); if (t.cageSizeClass) add(String(t.cageSizeClass)); break; }
      case 'reptile': { add('terrarium'); add('reptile supplies'); if (t.uvb) add('uvb'); if (t.habitat) add(String(t.habitat)); if (t.humidity !== undefined) add('humidity'); break; }
      case 'fish': {
        if (t.waterType) add(String(t.waterType));
        if (t.tankGal)   add(`${Math.round(Number(t.tankGal) || 0)} gallon`);
        if (t.temperamentFish) add(String(t.temperamentFish));
        if (t.schooling) add('schooling');
        break;
      }
      case 'horse': { add('horse'); add('blanket'); if (t.blanketSize) add(String(t.blanketSize)); break; }
      default: { add('pet supplies'); }
    }

    if (bag.size < 2) { add('food'); add('treats'); }
    return Array.from(bag).slice(0, 12).join(' ');
  }

  /* -------------------- product helpers -------------------- */
  const PAGE_SIZE = 8;

  function dedupeProducts(arr) {
    const seen = new Set();
    const out = [];
    for (const p of (arr || [])) {
      const key = p.id || p.gid || p.handle || p.slug || p.title;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  }

  function pickDeterministic(pool, petId, offset=0, k=PAGE_SIZE) {
    if (!Array.isArray(pool) || pool.length === 0) return [];
    const seed = hash(String(petId || 'seed'));
    const start = (seed % pool.length + offset) % pool.length;
    const out = [];
    for (let i=0; i<pool.length && out.length<k; i++){
      out.push(pool[(start + i) % pool.length]);
    }
    return out;
  }

  function productCard(p) {
    const handle = p.handle || p.slug || '';
    const title  = esc(p.title || p.name || 'Product');
    const priceN = Number(p?.variants?.[0]?.price ?? p?.priceRange?.minVariantPrice?.amount ?? p?.price ?? NaN);
    const price  = Number.isFinite(priceN) ? `$${priceN.toFixed(2)}` : '';
    const img    = esc(p.image?.src || p.featuredImage?.url || p.images?.[0]?.src || p.images?.[0]?.url || '/img/placeholder.png');
    return `
      <div class="col-6 col-md-4 col-lg-3 mb-3">
        <div class="card h-100">
          ${img ? `<img class="card-img-top" src="${img}" alt="${title}" loading="lazy">` : `<div class="ratio ratio-1x1 bg-light"></div>`}
          <div class="card-body d-flex flex-column">
            <div class="fw-semibold mb-1">${title}</div>
            ${price ? `<div class="text-muted mb-2">${price}</div>` : ''}
            <div class="mt-auto d-grid gap-2">
              <button class="btn btn-outline-primary btn-sm js-wishlist" data-handle="${esc(handle)}">Wishlist</button>
              <button class="btn btn-primary btn-sm js-addbox" data-handle="${esc(handle)}">Add to Box</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function subsRow(pet, suggestions) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) return '';
    return `
      <div class="alert alert-info d-flex align-items-center justify-content-between" role="alert">
        <div><strong>Start a plan for ${esc(pet.name)}</strong> — suggested items ready.</div>
        <button class="btn btn-sm btn-info js-start-plan" data-pet="${esc(pet.id)}">Start a plan</button>
      </div>`;
  }

  function skeletonBlock(pet) {
    return `
      <div class="card mb-4" data-pet="${esc(pet.id)}">
        <div class="card-header">
          <div class="d-flex align-items-center justify-content-between">
            <div><span class="me-2">For</span><strong>${esc(pet.name)}</strong> <span class="text-muted">(${esc(pet.type || pet.species || '')})</span></div>
          </div>
        </div>
        <div class="card-body">
          <div class="placeholder-glow mb-3">
            <span class="placeholder col-6"></span>
          </div>
          <div class="row">
            ${Array.from({length: 4}).map(() => `
              <div class="col-6 col-md-4 col-lg-3 mb-3">
                <div class="card h-100">
                  <div class="ratio ratio-1x1 placeholder bg-light"></div>
                  <div class="card-body">
                    <div class="placeholder-glow">
                      <span class="placeholder col-8"></span>
                      <span class="placeholder col-4"></span>
                    </div>
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  function renderPetBlock(pet, products, subs, state) {
    const items = (products || []).map(productCard).join('');
    const moreBtn = (state?.hasMore)
      ? `<div class="d-grid"><button class="btn btn-outline-secondary btn-sm js-load-more" data-pet="${esc(pet.id)}">Load more</button></div>`
      : '';
    return `
      <div class="card mb-4" data-pet="${esc(pet.id)}">
        <div class="card-header">
          <div class="d-flex align-items-center justify-content-between">
            <div><span class="me-2">For</span><strong>${esc(pet.name)}</strong> <span class="text-muted">(${esc(pet.type || pet.species || '')})</span></div>
          </div>
        </div>
        <div class="card-body">
          ${subsRow(pet, subs)}
          <div class="row">${items || `<div class="text-muted">No matches yet—adjust traits or try again later.</div>`}</div>
          ${moreBtn}
        </div>
      </div>`;
  }

  /* -------------------- data loaders (cached) -------------------- */
  async function getFeatured(limit=30) {
    const k = `featured|${limit}`;
    const c = getCached(k);
    if (c) return c;
    const res = await api.featuredProducts(limit);
    const v = res.ok ? (res.products || []) : [];
    const deduped = dedupeProducts(v);
    setCached(k, deduped);
    return deduped;
  }

  async function searchProductsCached(q, limit=30) {
    const key = `search|${q}|${limit}`;
    const c = getCached(key);
    if (c) return c;
    const res = await api.searchProducts(q, limit);
    const v = res.ok ? (res.products || []) : [];
    const deduped = dedupeProducts(v);
    setCached(key, deduped);
    return deduped;
  }

  async function subsSuggestCached(petId) {
    const key = `subs|${petId}`;
    const c = getCached(key);
    if (c) return c;
    const res = await api.subsSuggest(petId);
    const v = res.ok ? (res.suggestions || []) : [];
    setCached(key, v);
    return v;
  }

  /* -------------------- per-pet state + pagination -------------------- */
  // petId -> { pool:[], offset:number, shown:number, hasMore:boolean }
  const petStates = new Map();

  function setPetState(petId, patch) {
    const prev = petStates.get(petId) || {};
    const next = { ...prev, ...patch };
    petStates.set(petId, next);
    return next;
  }

  function nextSliceForPet(petId) {
    const st = petStates.get(petId) || {};
    const pool = st.pool || [];
    let offset = st.offset || 0;
    let shown  = st.shown  || 0;

    if (!pool.length) return [];

    const slice = pickDeterministic(pool, petId, offset, PAGE_SIZE);
    offset += PAGE_SIZE;
    shown  = clamp(shown + slice.length, 0, pool.length);
    const hasMore = shown < pool.length;

    setPetState(petId, { offset, shown, hasMore });
    return slice;
  }

  async function loadProductsForPet(pet, signal) {
    const q = traitsToQuery(pet);
    let pool = await searchProductsCached(q, 40);
    if (!pool.length) pool = await getFeatured(40);

    const petCtx = {
      budgetBand: pet?.traits?.budgetBand || 'mid',
      affinities: pet?.traits?.affinities || [],
      exclusions: pet?.traits?.exclusions || [],
      dislikes:   getLocalDislikes(pet.id)
    };

    pool = rerankProductsByTraits(q, pool, petCtx);
    setPetState(pet.id, { pool, offset: 0, shown: 0, hasMore: pool.length > 0 });
    return { products: nextSliceForPet(pet.id), subs: await subsSuggestCached(pet.id) };
  }

  /* -------------------- lazy render pipeline -------------------- */
  async function paintInitialSkeletons() {
    const petsRes = await api.petsList();
    const pets = petsRes.ok ? (petsRes.pets || []) : [];
    if (!pets.length) {
      CONTENT.innerHTML = `<div class="text-muted">No pets yet. Add a pet to see personalized ideas.</div>`;
      return [];
    }
    CONTENT.innerHTML = pets.map(p => skeletonBlock(p)).join('');
    return pets;
  }

  function attachBlockHandlers(cardEl) {
    const wire = (btn, fn) => {
      if (!btn || btn.dataset.wired === '1') return;
      btn.dataset.wired = '1';
      btn.addEventListener('click', fn);
    };

    cardEl.querySelectorAll('.js-wishlist').forEach(btn => {
      wire(btn, async (e) => {
        const b = e.currentTarget;
        const handle = b.getAttribute('data-handle') || '';
        if (!handle) return;
        b.disabled = true;
        try {
          const r = await api.wishlistAdd(handle);         // server expects {handle}
          PetsBus.emit?.('wishlist:add', { handle, ok: r.ok });
          PetsBus.emit?.('analytics', { type: 'wishlist_add', handle });
        } finally { b.disabled = false; }
      });
    });

    cardEl.querySelectorAll('.js-addbox').forEach(btn => {
      wire(btn, (e) => {
        const handle = e.currentTarget.getAttribute('data-handle') || '';
        if (!handle) return;
        PetsBus.emit?.('subscriptions:addItem', { handle });
        PetsBus.emit?.('analytics', { type: 'sub_add_item', handle });
      });
    });

    cardEl.querySelectorAll('.js-start-plan').forEach(btn => {
      wire(btn, (e) => {
        const petId = e.currentTarget.getAttribute('data-pet') || '';
        PetsBus.emit?.('subscriptions:start', { petId });
        PetsBus.emit?.('analytics', { type: 'sub_start', petId });
      });
    });

    cardEl.querySelectorAll('.js-load-more').forEach(btn => {
      wire(btn, (e) => {
        const petId = e.currentTarget.getAttribute('data-pet');
        if (!petId) return;
        const next = nextSliceForPet(petId);
        const row = cardEl.querySelector('.row');
        if (row && next.length) {
          row.insertAdjacentHTML('beforeend', next.map(productCard).join(''));
          attachBlockHandlers(cardEl);
        }
        const st = petStates.get(petId);
        if (st && !st.hasMore) e.currentTarget.classList.add('d-none');
      });
    });
  }

  function observeAndRender(pets) {
    const io = ('IntersectionObserver' in window)
      ? new IntersectionObserver((entries) => {
          entries.forEach(async (ent) => {
            if (!ent.isIntersecting) return;
            const wrap = ent.target;
            const petId = wrap.getAttribute('data-pet');
            const pet = pets.find(p => String(p.id) === String(petId));
            if (!pet) return;

            io.unobserve(wrap);
            const ctrl = controllerFor(pet.id);
            try {
              const res = await loadProductsForPet(pet, ctrl.signal);
              if (ctrl.signal.aborted) return;

              const html = renderPetBlock(pet, res.products, res.subs, petStates.get(pet.id));
              wrap.outerHTML = html;

              const newCard = CONTENT.querySelector(`[data-pet="${CSS.escape(String(pet.id))}"]`);
              if (newCard) attachBlockHandlers(newCard);

              PetsBus.emit?.('analytics', { type: 'pet_block_render', petId: pet.id });
            } catch (err) {
              if (ctrl.signal.aborted) return;
              wrap.querySelector('.card-body')?.insertAdjacentHTML('beforeend',
                `<div class="text-danger small mt-2">Failed to load suggestions.</div>`);
            } finally {
              inflight.delete(pet.id);
            }
          });
        }, { root: null, rootMargin: '120px 0px', threshold: 0.01 })
      : null;

    pets.forEach(p => {
      const el = CONTENT.querySelector(`.card[data-pet="${CSS.escape(String(p.id))}"]`);
      if (!el) return;
      if (io) io.observe(el);
      else {
        (async () => {
          const res = await loadProductsForPet(p);
          const html = renderPetBlock(p, res.products, res.subs, petStates.get(p.id));
          el.outerHTML = html;
          const newCard = CONTENT.querySelector(`[data-pet="${CSS.escape(String(p.id))}"]`);
          if (newCard) attachBlockHandlers(newCard);
        })();
      }
    });
  }

  async function loadAndRender() {
    const pets = await paintInitialSkeletons();
    if (pets.length) observeAndRender(pets);
  }

  const scheduleRefresh = debounce(loadAndRender, 200);

  /* -------------------- Bus + DOM triggers -------------------- */
  PetsBus.on?.('pets:list:loaded', scheduleRefresh);
  PetsBus.on?.('pets:changed',     scheduleRefresh);
  PetsBus.on?.('pet:created',      scheduleRefresh);
  PetsBus.on?.('pet:updated',      scheduleRefresh);
  PetsBus.on?.('pet:deleted',      scheduleRefresh);
  PetsBus.on?.('pets:refresh:request', scheduleRefresh);

  // As a last-resort signal if the list changes without bus (SSR/templated)
  const petList = document.getElementById('petList');
  if (petList && window.MutationObserver) {
    const mo = new MutationObserver(debounce(() => scheduleRefresh(), 100));
    mo.observe(petList, { childList: true, subtree: true });
  }

  /* -------------------- init -------------------- */
  (async () => {
    await applyPersistedToggle();
    if (CONTENT.classList.contains('d-none')) return;
    scheduleRefresh();
  })();
}