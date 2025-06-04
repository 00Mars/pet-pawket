// ====== MODULAR CSS INJECTION ======
const cssFiles = [
  'hero.css',
  'footer.css',
  'pettypes.css',
  'news.css',
  'shapes.css',
  'mission.css'
  // 'globals.css',
  // 'layout.css',
  // 'navbar.css',
  // 'overlay.css',
  // 'mobile.css',
  // 'responsive.css',
];

cssFiles.forEach(file => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = file;
  document.head.appendChild(link);
});

// ====== MODULE IMPORTS ======
import {
  fetchFeaturedProducts,
  setupEventListeners,
  updateCartBadge,
  allProducts
} from './products.js';

import { injectNavbar } from './navbar.js';
import { setupHueyAnimation } from './navbarAnimation.js';
import { setupNavbarOverlayHandlers } from './navbarOverlay.js';

import { injectFooter } from './footer.js';
import { setupSearchFunctionality } from './searchLogic.js';
import { injectHero } from './hero.js';
import { injectPetTypes as injectShopBy } from './pettypes.js';
import { injectMission } from './mission.js';
import { injectNews } from './newsModule.js';

// ====== DOM READY LOGIC ======
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Init] DOM loaded. Starting module injection...");

  // === NAVBAR ===
  console.log("[Navbar] Injecting...");
  injectNavbar(() => {
    console.log("[Navbar] Ready. Initializing features...");
    setupNavbarOverlayHandlers();
    setupHueyAnimation();
    setupSearchFunctionality(allProducts);
    updateCartBadge();
  });

  // === HERO ===
  console.log("[Hero] Injecting...");
  injectHero();

  // === MISSION ===
  console.log("[Mission] Injecting...");
  injectMission();

  // === SHOP BY (PetTypes Section) ===
  console.log("[ShopBy] Injecting...");
  injectShopBy();

  // === PRODUCTS ===
  console.log("[Products] Fetching & rendering featured...");
  await fetchFeaturedProducts();
  setupEventListeners();

  // === NEWS ===
  injectNews();

  // === FOOTER ===
  console.log("[Footer] Injecting...");
  injectFooter();

  console.log("[Init] All modules injected.");
});
