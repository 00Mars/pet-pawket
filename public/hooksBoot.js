/* /public/hooksBoot.js — robust lazy loader for feature modules
   (Your original content kept, with additive navbar enhancer loader.)
   - Tries relative + absolute (/ and /public) for wishlist & pets (as before)
   - Adds: navbar enhancer (navMini.js) auto-load when #navbar-container/custom-navbar exists
*/

const WL_REL   = new URL('./wishlist.js', import.meta.url).href;
const PETS_REL = new URL('./accountPetsBridge.js', import.meta.url).href;
// [pp:add] navbar mini (cart + wishlist dropdowns)
const NAV_REL  = new URL('./navMini.js', import.meta.url).href;

// Absolute fallbacks (covers servers that mount /public → / or keep it under /public)
const WL_ABS_1   = '/wishlist.js';
const WL_ABS_2   = '/public/wishlist.js';
const PETS_ABS_1 = '/accountPetsBridge.js';
const PETS_ABS_2 = '/public/accountPetsBridge.js';
// [pp:add] navbar mini fallbacks
const NAV_ABS_1  = '/navMini.js';
const NAV_ABS_2  = '/public/navMini.js';

const loaded = { wishlist: false, pets: false, navbar: false };
const SEL_WISHLIST = ['#wishlistPane', '[data-wishlist-list]', '.js-wishlist-list'];

function hasAny(arr) { return arr.some(sel => document.querySelector(sel)); }
function hasPetsPane() {
  return document.getElementById('myPetsPane')
      && document.getElementById('toggleMyPetsPane')
      && document.getElementById('myPetsContent');
}
// [pp:add] consider both injected container and static custom navs
function hasNavbar() {
  return !!(document.getElementById('navbar-container')
         || document.querySelector('.custom-navbar'));
}

async function importFirst(urls, tag) {
  let lastErr;
  for (const u of urls) {
    try {
      // eslint-disable-next-line no-console
      console.info(`[pp:boot] trying ${tag}: ${u}`);
      const mod = await import(/* @vite-ignore */ u);
      // eslint-disable-next-line no-console
      console.info(`[pp:boot] loaded ${tag}: ${u}`);
      return mod;
    } catch (e) {
      lastErr = e;
      // eslint-disable-next-line no-console
      console.warn(`[pp:boot] ${tag} import failed: ${u}`, e);
    }
  }
  throw lastErr;
}

async function tryLoad() {
  if (!loaded.wishlist && hasAny(SEL_WISHLIST)) {
    loaded.wishlist = true;
    try { await importFirst([WL_REL, WL_ABS_1, WL_ABS_2], 'wishlist'); }
    catch (e) { loaded.wishlist = false; console.error('[pp:boot] wishlist load failed completely', e); }
  }

  if (!loaded.pets && hasPetsPane()) {
    loaded.pets = true;
    try { await importFirst([PETS_REL, PETS_ABS_1, PETS_ABS_2], 'pets'); }
    catch (e) { loaded.pets = false; console.error('[pp:boot] pets load failed completely', e); }
  }

  // [pp:add] navbar enhancer
  if (!loaded.navbar && hasNavbar()) {
    loaded.navbar = true;
    try { await importFirst([NAV_REL, NAV_ABS_1, NAV_ABS_2], 'navbar'); }
    catch (e) { loaded.navbar = false; console.error('[pp:boot] navbar load failed completely', e); }
  }
}

function boot() {
  tryLoad();
  if ('MutationObserver' in window) {
    const mo = new MutationObserver(() => tryLoad());
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    setInterval(tryLoad, 1000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
