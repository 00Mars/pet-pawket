export function setupNavbarOverlayHandlers() {
  const navbar = document.querySelector("#navbar-container nav");
  const container = document.getElementById('navbar-container');
  if (!container) return;

  window.addEventListener("scroll", () => {
    navbar?.classList.toggle("navbar-scrolled", window.scrollY > 10);
  });

  container.addEventListener('click', (e) => {
    const searchIconWrapper = e.target.closest('#search-icon');
    const closeBtn = e.target.closest('.close-btn');
    const overlay = document.getElementById('searchOverlay');

    if (searchIconWrapper && overlay) {
      e.preventDefault();
      const isVisible = getComputedStyle(overlay).display !== 'none';
      overlay.style.setProperty("display", isVisible ? "none" : "block", "important");
    }

    if (closeBtn && overlay) {
      e.preventDefault();
      overlay.style.setProperty("display", "none", "important");
    }
  });
}
