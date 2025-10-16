// product.page.js
// Standalone boot for Product page — injects navbar/footer and sets layout vars.
// Does NOT import main.js, so no cross-page CSS is injected.

async function tryImport(path) {
  try { return await import(path); }
  catch { return null; }
}

function setNavHeightVar() {
  // After navbar inject, calculate its height and set --nav-fixed-h for padding
  const nav = document.querySelector('#navbar-container .site-navbar, #navbar-container nav, header nav');
  const h = Math.round((nav?.getBoundingClientRect().height || 96));
  document.documentElement.style.setProperty('--nav-fixed-h', `${h}px`);
}

function highlightActiveNav() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll('#navbar-container [data-nav], #navbar-container nav a[href]').forEach((a) => {
    const target = a.getAttribute('href') || a.getAttribute('data-nav') || '/';
    const norm = (target || '/').replace(/\/+$/, '') || '/';
    if (norm === path) a.classList.add('active');
    else a.classList.remove('active');
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Inject Navbar
  try {
    const navbarMod = await tryImport('/navbar.js');
    if (navbarMod?.injectNavbar) {
      await navbarMod.injectNavbar(() => {});
      highlightActiveNav();
      setNavHeightVar();
      // Recompute on resize since some navs change height responsively
      window.addEventListener('resize', setNavHeightVar, { passive: true });
    }
  } catch (e) {
    console.warn('[PDP] navbar inject warning:', e);
  }

  // Inject Footer
  try {
    const footerMod = await tryImport('/footer.js');
    if (footerMod?.injectFooter) await footerMod.injectFooter();
  } catch (e) {
    console.warn('[PDP] footer inject warning:', e);
  }
});

// Last-chance loggers (kept small)
window.addEventListener('error', (e) => console.error('[PDP Error]', e.message || e));
window.addEventListener('unhandledrejection', (e) => console.error('[PDP Unhandled]', e.reason || e));