// cartUtils.js

export function getCart() {
  return JSON.parse(localStorage.getItem("cart")) || [];
}

export function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

export function updateCartBadge() {
  const cart = getCart();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.querySelector("#cart-count");
  if (badge) badge.textContent = totalItems;
}
