// cart.js (now a module)
import { getCart, saveCart, updateCartBadge } from './cartUtils.js';

document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  setupCartListeners();
  updateCartBadge();

  const checkoutBtn = document.getElementById("checkout-button");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", redirectToCheckout);
  }
});

function renderCart() {
  const cartItems = getCart();
  const container = document.getElementById("cart-items");
  const totalContainer = document.getElementById("cart-total");

  container.innerHTML = "";
  let total = 0;

  if (cartItems.length === 0) {
    container.innerHTML = '<tr><td colspan="6" class="text-center">Your cart is empty.</td></tr>';
    totalContainer.textContent = "$0.00";
    updateCartBadge();
    return;
  }

  cartItems.forEach((item, index) => {
    total += item.price * item.quantity;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><img src="${item.image}" alt="${item.title}" class="img-thumbnail" style="max-width: 60px;"></td>
      <td>${item.title}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td><input type="number" class="form-control quantity-input" name="quantity-${index}" data-index="${index}" value="${item.quantity}" min="1"></td>
      <td>$${(item.price * item.quantity).toFixed(2)}</td>
      <td><button class="btn btn-danger btn-sm remove-item" data-index="${index}">&times;</button></td>
    `;
    container.appendChild(row);
  });

  totalContainer.textContent = `$${total.toFixed(2)}`;
  updateCartBadge();
}

function setupCartListeners() {
  const table = document.getElementById("cart-items");

  table.addEventListener("change", e => {
    if (e.target.classList.contains("quantity-input")) {
      const index = parseInt(e.target.dataset.index);
      const cart = getCart();
      cart[index].quantity = parseInt(e.target.value);
      saveCart(cart);
      renderCart();
    }
  });

  table.addEventListener("click", e => {
    if (e.target.classList.contains("remove-item")) {
      const index = parseInt(e.target.dataset.index);
      const cart = getCart();
      cart.splice(index, 1);
      saveCart(cart);
      renderCart();
    }
  });
}

window.addEventListener("storage", () => {
  updateCartBadge();
});

async function redirectToCheckout() {
  const cart = getCart();
  if (cart.length === 0) return;

  const validCart = cart.filter(item => item.variantId);
  if (validCart.length !== cart.length) {
    localStorage.setItem("cart", JSON.stringify(validCart));
  }

  if (validCart.length === 0) {
    alert("Your cart was empty or contained unsupported items. Please add new items to continue.");
    return;
  }

  const lineItems = validCart.map(item => ({
    variantId: item.variantId,
    quantity: item.quantity
  }));

  const response = await fetch("https://yx0ksi-xv.myshopify.com/api/2024-04/graphql.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": "409b760bb918367d377eb3a598c1298d"
    },
    body: JSON.stringify({
      query: `
        mutation checkoutCreate($input: CheckoutCreateInput!) {
          checkoutCreate(input: $input) {
            checkout { webUrl }
            checkoutUserErrors { message }
          }
        }
      `,
      variables: { input: { lineItems } }
    })
  });

  const json = await response.json();
  const errors = json?.data?.checkoutCreate?.checkoutUserErrors;
  const checkoutUrl = json?.data?.checkoutCreate?.checkout?.webUrl;

  if (checkoutUrl) {
    window.location.href = checkoutUrl;
  } else if (errors?.length) {
    alert("Checkout failed: " + errors.map(e => e.message).join(", "));
  } else if (json.errors) {
    console.error("GraphQL Errors:", json.errors);
    alert("Checkout failed due to a server error.");
  } else {
    alert("Checkout failed. Please try again.");
  }
}
