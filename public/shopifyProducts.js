// Shopify Product System — Single Provider Checkout (Live)

const endpoint = "https://yx0ksi-xv.myshopify.com/api/2024-04/graphql.json";
const token = "409b760bb918367d377eb3a598c1298d";

let productCache = [];
const PROVIDER = 'shopify'; // Placeholder for future expansion

export async function fetchAllProducts(limit = 100) {
  if (productCache.length > 0) return productCache;

  const query = `{
    products(first: ${limit}) {
      edges {
        node {
          id
          title
          handle
          productType
          description
          tags
          images(first: 5) { edges { node { url altText } } }
          variants(first: 5) {
            edges {
              node {
                id
                title
                price { amount currencyCode }
                availableForSale
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token
    },
    body: JSON.stringify({ query })
  });

  const json = await res.json();
  const nodes = json.data.products.edges.map(e => e.node);

  productCache = nodes.map(p => ({
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description,
    tags: p.tags,
    category: p.productType || "Uncategorized",
    images: p.images.edges.map(img => img.node),
    variants: p.variants.edges.map(v => ({
      id: v.node.id,
      title: v.node.title,
      price: parseFloat(v.node.price.amount),
      currency: v.node.price.currencyCode,
      available: v.node.availableForSale
    })),
    featured: p.tags.includes("featured"),
    top: p.tags.includes("top")
  }));

  return productCache;
}

export function redirectToCheckout() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  if (cart.length === 0) {
    alert("Your cart is empty.");
    return;
  }
  localStorage.removeItem("cart");
  updateCartBadge();
  const base = "https://yx0ksi-xv.myshopify.com/cart/";
  const query = cart.map(item => `${item.variantId}:${item.quantity}`).join(",");
  window.location.href = base + query;
}

export function addToCart(item) {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const existing = cart.find(p => p.variantId === item.variantId);

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ ...item, quantity: 1 });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartBadge();
}

export function updateCartBadge() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const total = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.querySelector("#cart-count");

  if (badge) {
    badge.textContent = total;
  }
}

document.addEventListener("click", e => {
  if (e.target.matches(".btn-success[data-variant-id]")) {
    const btn = e.target;
    const item = {
      id: btn.dataset.id,
      variantId: btn.dataset.variantId,
      title: btn.dataset.title,
      price: parseFloat(btn.dataset.price),
      image: btn.dataset.image
    };
    addToCart(item);
  }
});

export async function getProductByHandle(handle) {
  const products = await fetchAllProducts();
  return products.find(p => p.handle === handle);
}

export async function getFeaturedProducts() {
  const products = await fetchAllProducts();
  return products.filter(p => p.featured);
}

export async function getTopProducts() {
  const products = await fetchAllProducts();
  return products.filter(p => p.top);
}

export async function getProductsByCategory(category) {
  const products = await fetchAllProducts();
  return products.filter(p => p.category.toLowerCase() === category.toLowerCase());
}

export async function searchProducts(query) {
  const q = query.toLowerCase();
  const products = await fetchAllProducts();
  return products.filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.tags.some(tag => tag.toLowerCase().includes(q))
  );
}

export function renderProductList(products, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[renderProductList] Container #${containerId} not found.`);
    return;
  }

  container.innerHTML = '';

  products.forEach(product => {
    const firstImage = product.images[0]?.url || 'assets/fallback.jpg';
    const secondImage = product.images[1]?.url || firstImage;

    const variant = product.variants[0] || {};
    const available = variant.available;
    const tagChips = (product.tags || []).map(tag =>
      `<span class="product-tag-chip">${tag}</span>`).join(' ');

    const availability = available
      ? `<span class="product-availability">In Stock</span>`
      : `<span class="text-danger fw-bold small">Sold Out</span>`;

    const div = document.createElement("div");
    div.className = "col-md-6 col-lg-4";

    div.innerHTML = `
  <div class="product-card" data-primary="${firstImage}" data-alt="${secondImage}">
    <img src="${firstImage}" alt="${product.title}">
    <div class="product-card-content">
      <div class="product-card-title">${product.title}</div>
      <div class="product-card-price">$${variant.price?.toFixed(2) || '0.00'}</div>
      <div class="product-card-tags">${tagChips}</div>
      <a href="/product.html?handle=${product.handle}" class="btn">View Product</a>
      <button class="wishlist-btn" data-handle="${product.handle}" title="Add to Wishlist">❤️</button>
    </div>
  </div>
`;

document.querySelectorAll(".wishlist-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const handle = btn.dataset.handle;
    addToWishlist(handle);
    btn.textContent = "💖"; // Visual feedback
  });
});


    container.appendChild(div);
  });

  setupHoverImageSwitching();
}


export function renderProductDetail(product, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[renderProductDetail] Container #${containerId} not found.`);
    return;
  }

  const variant = product.variants[0];
  container.innerHTML = `
    <div class="product-detail">
      <img src="${product.images[0]?.url}" alt="${product.title}" class="img-fluid mb-3">
      <h2>${product.title}</h2>
      <p class="text-muted">${product.category}</p>
      <p>$${variant.price.toFixed(2)}</p>
      <p>${product.description}</p>
      <button class="btn btn-success" data-id="${product.id}" data-variant-id="${variant.id}" data-title="${product.title}" data-price="${variant.price}" data-image="${product.images[0]?.url}">
        Add to Cart
      </button>
    </div>
  `;
}

export function setupSearchInput(inputId, containerId) {
  const input = document.getElementById(inputId);
  if (!input) {
    console.warn(`[setupSearchInput] Search input #${inputId} not found.`);
    return;
  }

  input.addEventListener("input", async () => {
    const query = input.value.trim();
    if (query.length === 0) return;
    const results = await searchProducts(query);
    renderProductList(results, containerId);
  });
}

export function setupFilterDropdown(filterId, containerId) {
  const dropdown = document.getElementById(filterId);
  if (!dropdown) {
    console.warn(`[setupFilterDropdown] Dropdown #${filterId} not found.`);
    return;
  }

  dropdown.addEventListener("change", async () => {
    const selected = dropdown.value;
    const products = await fetchAllProducts();
    const filtered = selected === "all" ? products : products.filter(p => p.category.toLowerCase() === selected.toLowerCase());
    renderProductList(filtered, containerId);
  });
}

export function setupSortDropdown(sortId, containerId) {
  const dropdown = document.getElementById(sortId);
  if (!dropdown) {
    console.warn(`[setupSortDropdown] Dropdown #${sortId} not found.`);
    return;
  }

  dropdown.addEventListener("change", async () => {
    const sortType = dropdown.value;
    const products = await fetchAllProducts();
    const sorted = [...products].sort((a, b) => {
      if (sortType === "price-asc") return a.variants[0].price - b.variants[0].price;
      if (sortType === "price-desc") return b.variants[0].price - a.variants[0].price;
      return 0;
    });
    renderProductList(sorted, containerId);
  });
}

export async function loadAndRenderProductFromURL(containerId) {
  const params = new URLSearchParams(window.location.search);
  const handle = params.get("handle");
  if (!handle) {
    console.warn("[loadAndRenderProductFromURL] No product handle in URL.");
    return;
  }

  const product = await getProductByHandle(handle);
  if (!product) {
    console.error(`[loadAndRenderProductFromURL] Product not found for handle: ${handle}`);
    return;
  }

  renderProductDetail(product, containerId);
}

// ... (rest of Shopify Product System above remains unchanged)

export function renderCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const tbody = document.getElementById("cart-items");
  const totalDisplay = document.getElementById("cart-total");

  if (!tbody || !totalDisplay) {
    console.warn("[renderCart] Required DOM elements not found.");
    return;
  }

  tbody.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><img src="${item.image}" alt="${item.title}" class="img-fluid" style="max-width: 80px;"></td>
      <td>${item.title}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td>
        <div class="input-group input-group-sm">
          <button class="btn btn-outline-secondary decrease-qty" data-index="${index}">−</button>
          <input type="text" class="form-control text-center" value="${item.quantity}" readonly>
          <button class="btn btn-outline-secondary increase-qty" data-index="${index}">+</button>
        </div>
      </td>
      <td>$${subtotal.toFixed(2)}</td>
      <td><button class="btn btn-sm btn-danger remove-item" data-index="${index}"><i class="bi bi-trash"></i></button></td>
    `;
    tbody.appendChild(row);
  });

  totalDisplay.textContent = `$${total.toFixed(2)}`;

  document.querySelectorAll(".remove-item").forEach(btn => {
    btn.addEventListener("click", e => {
      const i = parseInt(e.currentTarget.dataset.index);
      cart.splice(i, 1);
      localStorage.setItem("cart", JSON.stringify(cart));
      renderCart();
      updateCartBadge();
    });
  });

  document.querySelectorAll(".increase-qty").forEach(btn => {
    btn.addEventListener("click", e => {
      const i = parseInt(e.currentTarget.dataset.index);
      cart[i].quantity++;
      localStorage.setItem("cart", JSON.stringify(cart));
      renderCart();
      updateCartBadge();
    });
  });

  document.querySelectorAll(".decrease-qty").forEach(btn => {
    btn.addEventListener("click", e => {
      const i = parseInt(e.currentTarget.dataset.index);
      if (cart[i].quantity > 1) {
        cart[i].quantity--;
      } else {
        cart.splice(i, 1);
      }
      localStorage.setItem("cart", JSON.stringify(cart));
      renderCart();
      updateCartBadge();
    });
  });

  const checkoutBtn = document.getElementById("checkout-button");
  if (checkoutBtn) {
    checkoutBtn.onclick = () => redirectToCheckout();
  }
}

export function getWishlist() {
  return JSON.parse(localStorage.getItem("wishlist")) || [];
}

export function addToWishlist(handle) {
  const list = getWishlist();
  if (!list.includes(handle)) {
    list.push(handle);
    localStorage.setItem("wishlist", JSON.stringify(list));
  }
}

export function removeFromWishlist(handle) {
  const list = getWishlist().filter(h => h !== handle);
  localStorage.setItem("wishlist", JSON.stringify(list));
}
<<<<<<< HEAD

function setupHoverImageSwitching() {
  document.querySelectorAll('.product-card').forEach(card => {
    const img = card.querySelector('.product-img');
    const primary = card.dataset.primary;
    const alt = card.dataset.alt;

    if (primary !== alt) {
      card.addEventListener('mouseenter', () => {
        img.src = alt;
      });
      card.addEventListener('mouseleave', () => {
        img.src = primary;
      });
    }
  });
}
=======
>>>>>>> c2470ba (Initial real commit)
