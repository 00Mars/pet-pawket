<<<<<<< HEAD
/* /public/cartUtils.js */

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem("cart")) || [];
  } catch {
    return [];
  }
}

export function saveCart(cart) {
  try {
    localStorage.setItem("cart", JSON.stringify(cart));
  } catch {}
  // Keep badge in sync everywhere
  try { updateCartBadge(); } catch {}
  // [pp:add] also sync class-based badge hosts used by navbar-created badges
  try { updateCartBadgeCompat(); } catch {}
=======
// cartUtils.js

export function getCart() {
  return JSON.parse(localStorage.getItem("cart")) || [];
}

export function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
>>>>>>> c2470ba (Initial real commit)
}

export function updateCartBadge() {
  const cart = getCart();
<<<<<<< HEAD
  const totalItems = cart.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
  const badge = document.querySelector("#cart-count");
  if (badge) badge.textContent = String(totalItems);
}

/* Global listener so product pages refresh the badge immediately */
(function wireCartBadgeListener(){
  if (typeof document === 'undefined') return;
  try { updateCartBadge(); } catch {}
  try {
    document.addEventListener('pp:cart:changed', () => { try { updateCartBadge(); } catch {} });
    document.addEventListener('pp:cart:add', () => { try { updateCartBadge(); } catch {} });
  } catch {}
})();

// [pp:add] also update class-based badge hosts ('.cart-count', '.cart-badge') without touching existing logic
export function updateCartBadgeCompat() {
  try {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
    const nodes = document.querySelectorAll('.cart-count, .cart-badge');
    nodes.forEach(el => { el.textContent = String(totalItems); });
  } catch {}
}

// [pp:add] wire neutral events for compat updater (separate IIFE; additive only)
(function wireCartBadgeCompat(){
  if (typeof document === 'undefined') return;
  try { updateCartBadgeCompat(); } catch {}
  try {
    document.addEventListener('pp:cart:changed', () => { try { updateCartBadgeCompat(); } catch {} });
    document.addEventListener('pp:cart:add', () => { try { updateCartBadgeCompat(); } catch {} });
    document.addEventListener('DOMContentLoaded', () => { try { updateCartBadgeCompat(); } catch {} }, { once:true });
  } catch {}
})();
=======
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.querySelector("#cart-count");
  if (badge) badge.textContent = totalItems;
}
>>>>>>> c2470ba (Initial real commit)
