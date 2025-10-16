// /public/hooksBoot.js — Consolidated lazy loader (wishlist, pets, navbar) with no double-binding
// - Loads wishlist.js and accountPetsBridge.js only when their hooks are present.
// - Loads navbar mini (navMini.js) on pages that actually have a navbar.
// - IMPORTANT: Only loads legacy dropdownToggles.js when Bootstrap JS is NOT present
//   to avoid fighting Bootstrap’s own dropdown lifecycle (no more pop-then-disappear).

/* ---------------- Module URLs (relative first, absolute fallbacks) ---------------- */
const WL_REL   = new URL('./wishlist.js', import.meta.url).href;
const PETS_REL = new URL('./accountPetsBridge.js', import.meta.url).href;
const NAV_REL  = new URL('./navMini.js', import.meta.url).href;
const DT_REL   = new URL('./dropdownToggles.js', import.meta.url).href; // legacy helper (optional)

const WL_ABS   = ['/wishlist.js', '/public/wishlist.js'];
const PETS_ABS = ['/accountPetsBridge.js', '/public/accountPetsBridge.js'];
const NAV_ABS  = ['/navMini.js', '/public/navMini.js'];
const DT_ABS   = ['/dropdownToggles.js', '/public/dropdownToggles.js'];

/* ---------------- Feature detection ---------------- */
const SEL_WISHLIST = ['#wishlistPane', '[data-wishlist-list]', '.js-wishlist-list'];

function hasAny(selectors) { return selectors.some(sel => document.querySelector(sel)); }

function hasPetsPane() {
  return !!(
    document.getElementById('myPetsPane') &&
    document.getElementById('toggleMyPetsPane') &&
    document.getElementById('myPetsContent')
  );
}

function hasNavbar() {
  return !!(
    document.getElementById('navbar-container') ||
    document.querySelector('.custom-navbar') ||
    document.querySelector('nav.navbar')
  );
}

/* ---------------- Import helper ---------------- */
async function importFirst(urls, tag) {
  let lastErr;
  for (const u of urls) {
    try {
      // eslint-disable-next-line no-console
      console.info(`[pp:boot] trying ${tag || 'mod'}: ${u}`);
      const mod = await import(/* @vite-ignore */ u);
      // eslint-disable-next-line no-console
      console.info(`[pp:boot] loaded ${tag || 'mod'}: ${u}`);
      return mod;
    } catch (e) {
      lastErr = e;
      // eslint-disable-next-line no-console
      console.warn(`[pp:boot] ${tag || 'mod'} import failed: ${u}`, e);
    }
  }
  throw lastErr;
}

/* ---------------- Idempotent loaders ---------------- */
const loaded = {
  wishlist: false,
  pets: false
};

async function loadWishlistIfNeeded() {
  if (loaded.wishlist || !hasAny(SEL_WISHLIST)) return;
  loaded.wishlist = true;
  try {
    await importFirst([WL_REL, ...WL_ABS], 'wishlist');
  } catch (e) {
    loaded.wishlist = false; // allow retry on future DOM changes
    console.error('[pp:boot] wishlist load failed completely', e);
  }
}

async function loadPetsIfNeeded() {
  if (loaded.pets || !hasPetsPane()) return;
  loaded.pets = true;
  try {
    await importFirst([PETS_REL, ...PETS_ABS], 'pets');
  } catch (e) {
    loaded.pets = false; // allow retry
    console.error('[pp:boot] pets load failed completely', e);
  }
}

/* ===== Navbar loader (NO double-binding with Bootstrap) ===== */
let _navLoaded = false;

async function loadNavbarOnce() {
  if (_navLoaded || !hasNavbar()) return;
  _navLoaded = true;
  try { window.__ppDropdownDebug?.push('hooksBoot.loadNavbarOnce:start', { when: Date.now() }); } catch {}

  // Detect Bootstrap bundle presence (bootstrap.bundle provides Tooltip/Popover globals too)
  const HAS_BS = !!(window.bootstrap || window.Tooltip || window.Popover);

  // ✅ Only load the legacy dropdown helper when Bootstrap JS is NOT present.
  //    This avoids the legacy document-level closer stripping `.show` after Bootstrap opens.
  if (!HAS_BS) {
    try {
      const mod = await importFirst([DT_REL, ...DT_ABS], 'dropdowns');
      if (mod && typeof mod.setupDropdownToggles === 'function') {
        try { mod.setupDropdownToggles(); } catch {}
      }
    } catch (e) {
      // optional; keep running without it
      console.warn('[pp:boot] dropdown toggles not loaded (optional)', e);
    }
  }

  // Mini cart/wishlist loader — safe with or without Bootstrap
  try {
    await importFirst([NAV_REL, ...NAV_ABS], 'navbar');
    try { window.__ppDropdownDebug?.push('hooksBoot.loadNavbarOnce:navMiniLoaded', { when: Date.now() }); } catch {}
  } catch (e) {
    _navLoaded = false; // allow retry if injection happens later
    console.error('[pp:boot] navbar mini load failed completely', e);
  }
}

/* ---------------- Coordinator ---------------- */
async function tryLoad() {
  await loadWishlistIfNeeded();
  await loadPetsIfNeeded();
  await loadNavbarOnce();
}

function boot() {
  tryLoad();

  if ('MutationObserver' in window) {
    const mo = new MutationObserver(() => tryLoad());
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    // Very old browsers: light polling fallback
    setInterval(tryLoad, 1000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
