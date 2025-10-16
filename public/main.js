// public/main.js
// Resilient bootstrap: optional module loading, navbar/footer injection,
// clear tracing, Clerk-free (cookie-based) auth, and minimal featured grid wiring.

import './hooksBoot.js';

// ====== MODULAR CSS INJECTION ======
const cssFiles = [
  '/css/hero.css',
  '/css/footer.css',
  '/css/pettypes.css',
  '/css/news.css',
  '/css/shapes.css',
  '/css/mission.css',
  '/css/core.css',
];

function toCanonicalPath(p) {
  const s = String(p || '').replace(/^[./]+/, '').replace(/^\/+/, '');
  return '/' + s;
}
function addCssIfMissing(file) {
  const want = toCanonicalPath(file);
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  for (const lnk of links) {
    try {
      const existing = new URL(lnk.href, location.href).pathname;
      if (toCanonicalPath(existing) === want) return;
    } catch { /* ignore */ }
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = want;
  link.onload = () => console.debug('[CSS] loaded', want);
  link.onerror = () => console.warn('[CSS] failed to load', want);
  document.head.appendChild(link);
}
cssFiles.forEach(addCssIfMissing);

// ====== OPTIONAL MODULE LOADER ======
async function tryImport(path) {
  try {
    const mod = await import(path);
    console.debug('[import] ok:', path);
    return mod;
  } catch {
    console.debug('[import] not found:', path);
    return null;
  }
}

// ====== UTILITIES ======
const hasEl = (sel) => document.querySelector(sel);

function highlightActiveNav() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll('[data-nav], nav a[href]').forEach((a) => {
    const target = a.getAttribute('href') || a.getAttribute('data-nav') || '/';
    const norm = (target || '/').replace(/\/+$/, '') || '/';
    if (norm === path) a.classList.add('active');
    else a.classList.remove('active');
  });
}

// Compatible search overlay opener (works with navbar.js overlay wiring)
function wiresearchOverlay() {
  const overlay = document.getElementById('searchOverlay') || document.querySelector('[data-searchOverlay]');
  if (!overlay) return;

  const open = () => {
    // prefer navbar.js helpers if present
    if (window.__petpawketSearch?.open) return window.__petpawketSearch.open();
    overlay.classList.remove('hidden', 'd-none');
    overlay.querySelector('input')?.focus();
    document.documentElement.style.overflow = 'hidden';
  };
  const toggleButtons = document.querySelectorAll('[data-action="open-search"], [data-toggle="searchOverlay"], [aria-controls="searchOverlay"]');
  toggleButtons.forEach((btn) => {
    if (btn.dataset.wiredSearch) return;
    btn.dataset.wiredSearch = '1';
    btn.addEventListener('click', (e) => { e.preventDefault(); open(); });
  });
}

// ====== BOOT ======
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[BOOT] main.js starting…');

  // Load required/primary modules. Use dynamic imports to avoid hard failures.
  const [
    productsMod,
    navbarMod,
    footerMod,
    searchMod,
    heroMod,
    pettypesMod,
    missionMod,
    navOverlayMod,
    navAnimMod,
    authMod,
  ] = await Promise.all([
    tryImport('./products.js'),
    tryImport('./navbar.js'),
    tryImport('./footer.js'),
    tryImport('./searchLogic.js'),
    tryImport('./hero.js'),
    tryImport('./pettypes.js'),
    tryImport('./mission.js'),
    tryImport('./navbarOverlay.js'),
    tryImport('./navbarAnimation.js'),
    tryImport('./auth.js'),
  ]);

  // News can be either newsModule.js or legacy news.js
  const newsMod = (await tryImport('./newsModule.js')) || (await tryImport('./news.js'));

  const fetchFeaturedProducts = productsMod?.fetchFeaturedProducts;
  const setupEventListeners   = productsMod?.setupEventListeners;
  const updateCartBadge       = productsMod?.updateCartBadge;
  const allProducts           = productsMod?.allProducts || [];

  const injectNavbar                = navbarMod?.injectNavbar;
  const injectFooter                = footerMod?.injectFooter;
  const setupSearchFunctionality    = searchMod?.setupSearchFunctionality;
  const injectHero                  = heroMod?.injectHero;
  const injectShopBy                = pettypesMod?.injectPetTypes || pettypesMod?.injectShopBy;
  const injectMission               = missionMod?.injectMission;
  const injectNews                  = newsMod?.injectNews || newsMod?.initNews;

  const setupNavbarOverlayHandlers  = navOverlayMod?.setupNavbarOverlayHandlers;
  const setupHueyAnimation          = navAnimMod?.setupHueyAnimation;

  const wireAuthUI                  = authMod?.wireAuthUI;
  const updateAuthDisplay           = authMod?.updateAuthDisplay;

  // === NAVBAR ===
  try {
    if (typeof injectNavbar === 'function') {
      console.log('[Navbar] Injecting…');
      const afterNavbar = async () => {
        console.log('[Navbar] Ready. Initializing features…');
        try {
          setupNavbarOverlayHandlers?.();
          setupHueyAnimation?.();
          if (setupSearchFunctionality && document.getElementById('searchOverlay')) {
            setupSearchFunctionality(allProducts);
          }
          updateCartBadge?.();
          highlightActiveNav();
          wiresearchOverlay();
          wireAuthUI?.();
          await updateAuthDisplay?.();
        } catch (e) {
          console.warn('[Navbar] post-inject setup warning:', e);
        }
      };
      const maybe = injectNavbar(afterNavbar);
      if (maybe && typeof maybe.then === 'function') await maybe;
      else await afterNavbar();
    } else {
      console.warn('[Navbar] injector missing — navbar will not render.');
    }
  } catch (e) {
    console.error('[Navbar] Injection error:', e);
  }

  // === HERO ===
  try {
    if (hasEl('#hero-container') && typeof injectHero === 'function') {
      console.log('[Hero] Injecting…');
      await injectHero();
    }
  } catch (e) {
    console.warn('[Hero] warning:', e);
  }

  // === MISSION ===
  try {
    if (hasEl('#mission-container') && typeof injectMission === 'function') {
      console.log('[Mission] Injecting…');
      await injectMission();
    }
  } catch (e) {
    console.warn('[Mission] warning:', e);
  }

  // === SHOP BY ===
  try {
    if (hasEl('#pettypes-container') && typeof injectShopBy === 'function') {
      console.log('[ShopBy] Injecting…');
      await injectShopBy();
    }
  } catch (e) {
    console.warn('[ShopBy] warning:', e);
  }

  // === PRODUCTS ===
  try {
    if (hasEl('#featured-products') || hasEl('#featuredProducts')) {
      console.log('[Products] Fetching & rendering featured…');
      await fetchFeaturedProducts?.();
      setupEventListeners?.();
    } else {
      console.debug('[Products] No featured container on this page — skipping.');
    }
  } catch (e) {
    console.warn('[Products] warning:', e);
  }

  // === NEWS ===
  try {
    if (hasEl('#news-container')) {
      console.log('[News] Injecting…');
      if (typeof injectNews === 'function') {
        await injectNews();
      } else {
        console.debug('[News] injector not found (no news module present).');
      }
    } else {
      console.debug('[News] No #news-container on this page — skipping.');
    }
  } catch (e) {
    console.warn('[News] warning:', e);
  }

  // === FOOTER ===
  try {
    if (hasEl('#footer-container') && typeof injectFooter === 'function') {
      console.log('[Footer] Injecting…');
      await injectFooter();
    } else if (hasEl('#footer-container')) {
      console.warn('[Footer] injector missing — footer will not render.');
    }
  } catch (e) {
    console.warn('[Footer] warning:', e);
  }

  // === OPTIONAL FX ===
  try {
    const fx = await tryImport('./floatingShapes.js');
    fx?.initializeFloatingShapes?.();
  } catch { /* no-op */ }

  console.log('[BOOT] main.js complete.');
});

// Global last-chance logger
window.addEventListener('error', (e) => {
  console.error('[GlobalError]', e.message || e);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UnhandledRejection]', e.reason || e);
});

// ========= Featured Products (minimal, layout-safe) =========
(function setupFeaturedProducts(){
  // Only run this tiny fallback on the HOME page (prevents duplicate grids elsewhere)
  const path = (location.pathname || '/').replace(/\/+$/,'') || '/';
  if (path !== '/' && path !== '/index.html') return;

  const root = document.getElementById('featuredProducts') 
            || document.getElementById('featured-products');

  async function loadFeaturedProducts(limit = 8) {
    try {
      const r = await fetch(`/api/products/featured?limit=${limit}`, { credentials: 'include' });
      if (!r.ok) throw new Error('featured load failed');
      const data = await r.json();
      const items = data?.items ?? data?.products ?? data?.products?.nodes ?? [];
      render(items);
    } catch (e) {
      console.warn('[featured] failed:', e);
    }
  }

  const money = (v, c) => {
    const n = Number(v);
    return (Number.isFinite(n) ? n.toFixed(2) : '0.00') + (c ? ` ${c}` : '');
  };

  function card(p) {
    const img = p.featuredImage?.url || '/assets/images/placeholder.png';
    const title = p.title || '';
    const handle = p.handle || '';
    const id = p.id || '';
    const minp = p.priceRange?.minVariantPrice, maxp = p.priceRange?.maxVariantPrice;
    const price = minp
      ? (minp.amount === maxp?.amount
          ? money(minp.amount, minp.currencyCode)
          : `${money(minp.amount, minp.currencyCode)} – ${money(maxp.amount, maxp.currencyCode)}`)
      : '';

    // Attributes only for navigation/wishlist; no layout or style changes.
    return `
      <div class="col-6 col-md-3">
        <div class="card h-100" data-product-id="${id}" data-product-handle="${handle}">
          <a href="/products/${encodeURIComponent(handle)}"
             class="text-decoration-none text-reset product-link d-block"
             data-handle="${handle}" aria-label="${title}">
            <div class="ratio ratio-1x1 mb-2">
              <img src="${img}" class="card-img-top" alt="${title}" loading="lazy" style="object-fit:cover;height:190px;">
            </div>
          </a>
          <div class="card-body d-flex flex-column">
            <a href="/products/${encodeURIComponent(handle)}"
               class="stretched-link text-decoration-none text-reset product-link"
               data-handle="${handle}">
              <div class="fw-semibold text-truncate" title="${title}">${title}</div>
            </a>
            <div class="text-muted small mt-1">${price}</div>
            <div class="mt-auto">
              <button class="btn btn-sm btn-outline-primary mt-2"
                      data-action="wishlist-add"
                      data-product-id="${id}"
                      data-product-handle="${handle}">
                <i class="bi bi-heart"></i> Wishlist
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function render(items) {
    const grid = document.getElementById('featuredGrid') || container.querySelector('#featuredGrid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `<div class="text-muted">No featured products.</div>`;
      return;
    }
    grid.innerHTML = items.map(card).join('');
  }

  // Delegated wishlist click (cookie auth; no localStorage)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action="wishlist-add"]');
    if (!btn) return;
    const productId = btn.getAttribute('data-product-id') || '';
    const handle = btn.getAttribute('data-product-handle') || '';
    try {
      const r = await fetch('/api/wishlist', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, handle }),
      });
      if (!r.ok) throw new Error(await r.text());
      btn.innerHTML = `<i class="bi bi-heart-fill"></i> Wishlisted`;
      btn.classList.remove('btn-outline-primary');
      btn.classList.add('btn-primary');
    } catch (err) {
      console.error('[wishlist] add error:', err);
      alert('Could not add to wishlist. Are you signed in?');
    }
  });

  // kick it
  loadFeaturedProducts(8);
})();