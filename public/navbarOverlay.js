export function setupNavbarOverlayHandlers() {
  const container = document.getElementById('navbar-container');
  if (!container) return;

  // Inject styles once (works even if /css/overlay.css isn't linked)
  if (!document.getElementById('pp-search-overlay-styles')) {
    const style = document.createElement('style');
    style.id = 'pp-search-overlay-styles';
    style.textContent = `
#searchOverlay, #search-overlay, .searchOverlay, .search-overlay {
  position: fixed; inset: 0; z-index: 2000; display: none;
  background-color: rgba(255,255,255,0.35);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
}
#searchOverlay .search-card, #search-overlay .search-card,
.searchOverlay .search-card, .search-overlay .search-card {
  position: relative; width: min(920px, 96vw); margin: 10vh auto 0;
  background:#fff; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.15);
  border:1px solid rgba(0,0,0,.08); overflow:hidden;
}
#searchOverlay .search-head, #search-overlay .search-head,
.searchOverlay .search-head, .search-overlay .search-head {
  display:flex; align-items:center; gap:.5rem; padding:.75rem 1rem;
  border-bottom:1px solid rgba(0,0,0,.06);
}
#searchOverlay #searchInput, #search-overlay #searchInput,
.searchOverlay #searchInput, .search-overlay #searchInput {
  flex:1; border:1px solid rgba(0,0,0,.15); border-radius:10px;
  padding:.55rem .75rem; outline:none;
}
#searchOverlay .search-close, #search-overlay .search-close,
.searchOverlay .search-close, .search-overlay .search-close {
  margin-left:auto; font-size:20px; line-height:1; border:0; background:transparent;
  color:#666; cursor:pointer;
}
#searchOverlay .search-results, #search-overlay .search-results,
.searchOverlay .search-results, .search-overlay .search-results {
  max-height:60vh; overflow:auto; padding:.75rem 1rem 1rem;
}
.search-result-card {
  display:grid; grid-template-columns:64px 1fr auto; gap:12px; align-items:center;
  padding:10px; border-radius:12px; border:1px solid rgba(0,0,0,.06); margin-bottom:10px;
}
.search-result-card img{ width:64px; height:64px; object-fit:cover; border-radius:8px; }
.search-result-title{ font-weight:600; }
.search-result-price{ font-weight:600; opacity:.85; }
.hidden{ display:none !important; }
`;
    document.head.appendChild(style);
  }

  const getOverlay = () =>
    document.getElementById('searchOverlay') ||
    document.getElementById('search-overlay');

  const open = () => {
    const overlay = getOverlay();
    if (!overlay) return;
    overlay.style.setProperty("display", "block", "important");
    overlay.classList.remove('hidden');
    const input = overlay.querySelector('#searchInput,[data-search-input]');
    if (input) { try { input.focus(); input.select?.(); } catch {} }
  };

  const close = () => {
    const overlay = getOverlay();
    if (!overlay) return;
    overlay.style.setProperty("display", "none", "important");
    overlay.classList.add('hidden');
  };

  container.addEventListener('click', (e) => {
    const openTrigger  = e.target.closest('#search-icon, [data-action="open-search"], .nav-search-btn, [aria-controls="searchOverlay"], [aria-controls="search-overlay"]');
    const closeTrigger = e.target.closest('#searchCloseBtn, .search-close, .close-btn');
    if (openTrigger)  { e.preventDefault(); open(); }
    if (closeTrigger) { e.preventDefault(); close(); }
  });

  // Also close if clicking outside the card
  const backdropClose = (e) => {
    const overlay = getOverlay();
    if (!overlay) return;
    const card = overlay.querySelector('.search-card');
    if (overlay && e.target === overlay) close();
    if (overlay && card && !card.contains(e.target) && overlay.contains(e.target)) {
      if (!e.target.closest('.search-card')) close();
    }
  };
  document.addEventListener('click', backdropClose);

  // Hotkeys
  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';
    const isMac = navigator.platform?.toUpperCase?.().includes('MAC');
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    if (e.key === '/' && !typing) { e.preventDefault(); open(); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
}