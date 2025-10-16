// petpawket/public/baseInit.js
// baseInit.js
import { injectNavbar } from './navbar.js';
// Import overlay handlers and Huey animation from their dedicated modules.
import { setupNavbarOverlayHandlers } from './navbarOverlay.js';
import { setupHueyAnimation } from './navbarAnimation.js';

import { injectFooter } from './footer.js';
import { updateCartBadge } from './cartUtils.js';
import { setupSearchFunctionality } from './searchLogic.js';
import { allProducts } from './products.js';

// 🔧 Toggle this to enable/disable console logs globally
const DEBUG_MODE = true;

function log(...args) {
  if (DEBUG_MODE) console.log('[BaseInit]', ...args);
}

export function initBaseUI(callback = () => {}) {
  log('Starting base UI injection...');

  injectNavbar(() => {
    log('Navbar injected.');

    setupNavbarOverlayHandlers();
    log('Navbar overlay handlers set up.');

    setupHueyAnimation();
    log('Huey animation initialized.');

    updateCartBadge();
    log('Cart badge updated.');

    const overlay = document.getElementById('searchOverlay');
    if (overlay) {
      log('Search overlay found in DOM.');

      // Log the overlay dimensions and structure
      const overlayStyles = getComputedStyle(overlay);
      log('Overlay computed display:', overlayStyles.display);
      log('Overlay dimensions:', {
        width: overlay.offsetWidth,
        height: overlay.offsetHeight
      });
      log('Overlay innerHTML length:', overlay.innerHTML.length);

      setupSearchFunctionality(allProducts);
      log('Search functionality initialized.');
    } else {
      log('Search overlay NOT found. Skipping search setup.');
    }

    callback();
  });

  injectFooter();
  log('Footer injection called.');
}