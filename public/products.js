export let featuredProducts = [];
export let allProducts = [];


export async function fetchFeaturedProducts() {
  console.log("[Products] Starting fetchFeaturedProducts...");

  try {
    const response = await fetch("https://yx0ksi-xv.myshopify.com/api/2024-04/graphql.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": "409b760bb918367d377eb3a598c1298d"
      },
      body: JSON.stringify({
        query: `{
          products(first: 6) {
            edges {
              node {
                id
                title
                productType
                images(first: 1) { edges { node { url } } }
                variants(first: 1) {
                  edges {
                    node {
                      id
                      price { amount currencyCode }
                    }
                  }
                }
              }
            }
          }
        }`
      })
    });

    const result = await response.json();
    console.log("[Products] Raw fetch result:", result);

    if (!result?.data?.products?.edges) throw new Error("Invalid Shopify response format");

    allProducts = result.data.products.edges.map(({ node }) => ({
      id: node.id,
      title: node.title,
      image: node.images.edges[0]?.node.url || "assets/fallback.jpg",
      price: parseFloat(node.variants.edges[0]?.node.price.amount || "0"),
      variantId: node.variants.edges[0]?.node.id || "",
      type: node.productType || "Uncategorized"
    }));

    console.log(`[Products] Mapped ${allProducts.length} products.`);

    renderProducts(allProducts);
    populateFilterOptions(allProducts.map(p => p.type));
    // ❌ Removed early badge update (was too soon before navbar injected)
    // updateCartBadge();
  } catch (err) {
    console.error("[Products] Error fetching products:", err);
  }
}

export function renderProducts(products) {
  const container = document.getElementById("featured-products");
  if (!container) {
    console.warn("[renderProducts] #featured-products container not found!");
    return;
  }

  console.log(`[renderProducts] Rendering ${products.length} products...`);
  container.innerHTML = '';

  products.forEach(product => {
    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-4 mb-4";
    col.innerHTML = `
      <div class="card h-100 shadow-sm">
        <img src="${product.image}" alt="${product.title}" class="card-img-top">
        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${product.title}</h5>
          <p class="card-text text-muted">$${product.price.toFixed(2)}</p>
          <a href="#" class="btn btn-primary mt-auto add-to-cart"
            aria-label="Add ${product.title} to cart"
            data-id="${product.id}"
            data-variant-id="${product.variantId}"
            data-title="${product.title}"
            data-price="${product.price}"
            data-image="${product.image}">
            Add to Cart
          </a>
        </div>
      </div>
    `;
    container.appendChild(col);
  });
  console.log("[renderProducts] Finished rendering.");
}

export function getCartItemCount() {
  try {
    // Support multiple legacy stores: 'cart', 'cartItems', or object with .items
    const raw =
      localStorage.getItem('cart') ||
      sessionStorage.getItem('cart') ||
      localStorage.getItem('cartItems') ||
      sessionStorage.getItem('cartItems');

    if (!raw) return 0;
    const data = JSON.parse(raw);

    if (Array.isArray(data)) {
      return data.reduce(
        (n, it) => n + (Number(it?.qty ?? it?.quantity ?? 1) || 0),
        0
      );
    }
    if (data && Array.isArray(data.items)) {
      return data.items.reduce(
        (n, it) => n + (Number(it?.qty ?? it?.quantity ?? 1) || 0),
        0
      );
    }
    return 0;
  } catch {
    return 0;
  }
}

export function updateCartBadge(countOverride = null) {
  const findBadge = () => document.querySelector('#cart-count, .cart-count');

  const apply = () => {
    const el = findBadge();
    if (!el) { console.warn('[Cart] badge element not found (will keep watching)'); return false; }
    const count = (countOverride != null) ? countOverride : getCartItemCount();
    el.textContent = String(count);
    return true;
  };

  // try now
  if (apply()) return;

  // wait for navbar/DOM injection
  const obs = new MutationObserver(() => {
    if (apply()) obs.disconnect();
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

// Optional: if you have an “add to cart” flow, call this after mutation
export function addToCart(item) {
  try {
    const raw =
      localStorage.getItem('cart') || localStorage.getItem('cartItems') || '[]';
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      arr.push(item);
      localStorage.setItem('cart', JSON.stringify(arr));
    }
  } catch { /* ignore */ }
  updateCartBadge();
}

export function populateFilterOptions(categories) {
  const dropdown = document.getElementById("filter-options");
  if (!dropdown) {
    console.warn("[Filters] #filter-options not found!");
    return;
  }

  const unique = [...new Set(categories)].filter(c => c && c.trim() !== "");
  console.log(`[Filters] Populating ${unique.length} filter options...`);

  unique.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    dropdown.appendChild(option);
  });
}

export function setupEventListeners() {
  const sort = document.getElementById("sort-options");
  const filter = document.getElementById("filter-options");

  if (sort) {
    sort.addEventListener("change", () => {
      const sorted = [...allProducts].sort((a, b) =>
        sort.value === "price-asc" ? a.price - b.price : b.price - a.price
      );
      console.log(`[Sort] Applied sort: ${sort.value}`);
      renderProducts(sorted);
    });
  } else {
    console.warn("[Sort] #sort-options not found!");
  }

  if (filter) {
    filter.addEventListener("change", () => {
      const f = filter.value;
      const filtered = f === "all" ? allProducts : allProducts.filter(p => p.type === f);
      console.log(`[Filter] Applied filter: ${f}, ${filtered.length} product(s) matched.`);
      renderProducts(filtered);
    });
  } else {
    console.warn("[Filter] #filter-options not found!");
  }
}

document.addEventListener("click", e => {
  if (e.target.classList.contains("add-to-cart")) {
    e.preventDefault();
    const i = e.target.dataset;

    const item = {
      id: i.id,
      variantId: i.variantId,
      title: i.title,
      price: parseFloat(i.price),
      image: i.image,
      quantity: 1
    };

    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const existing = cart.find(p => p.id === item.id);

    if (existing) {
      existing.quantity++;
      console.log(`[Cart] Increased quantity for ${item.title}.`);
    } else {
      cart.push(item);
      console.log(`[Cart] Added new item: ${item.title}.`);
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartBadge();
  }
});
