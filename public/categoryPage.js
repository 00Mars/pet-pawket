// categoryPage.js
import {
  fetchAllProducts,
  renderProductList
} from './shopifyProducts.js';

// Session cache
let cachedProducts = null;

function getParams() {
  const params = new URLSearchParams(location.search);
  return {
    type: params.get('type')?.toLowerCase() || null,
    tag: params.get('tag')?.toLowerCase() || null,
    search: params.get('search')?.toLowerCase() || "",
    sort: params.get('sort') || "price-asc"
  };
}

function renderBreadcrumb(type, tag) {
  const crumb = document.getElementById('breadcrumb');
  crumb.innerHTML = `
    <a href="/">Home</a> / 
    <a href="/category.html">Shop</a> / 
    ${type ? `<span>${type}</span>` : "All"} ${tag ? ` / <span>${tag}</span>` : ""}
  `;
}

function renderTitle(type) {
  const el = document.getElementById('category-title');
  el.textContent = type ? `Shop: ${type}` : "All Products";
}

function renderBanner(type) {
  const banner = document.getElementById("category-banner");
  if (!type || !banner) return;
  const banners = {
    treats: "🐶 Treat time! Reward your furry friend.",
    toys: "🎾 Playful picks for every pet mood.",
    grooming: "🛁 Keep them fresh and fluffy!"
  };
  const key = type.toLowerCase();
  if (banners[key]) banner.innerHTML = `<div class="alert alert-info">${banners[key]}</div>`;
}

function getFilterState() {
  const selectedTags = Array.from(document.querySelectorAll("#tag-filters input:checked")).map(i => i.value.toLowerCase());
  const inStockOnly = document.querySelector("input[name='availability']")?.checked;
  const min = parseFloat(document.getElementById("price-min")?.value) || 0;
const max = parseFloat(document.getElementById("price-max")?.value) || Infinity;
const searchValue = document.getElementById("search-input")?.value.trim().toLowerCase() || "";

  return {
  selectedTags,
  inStockOnly,
  priceMin: min,
  priceMax: max,
  searchValue
};

}

function populateTagFilters(products) {
  const tagFilters = document.getElementById("tag-filters");
  const tags = [...new Set(products.flatMap(p => p.tags || []))].sort();

  tags.forEach(tag => {
    const checkbox = document.createElement("label");
    checkbox.innerHTML = `
      <input type="checkbox" value="${tag}" checked />
      ${tag}
    `;
    tagFilters.appendChild(checkbox);
  });
}

function applyFilters(products, params, filters) {
  return products.filter(p => {
    const matchesType = !params.type || p.category?.toLowerCase() === params.type;
    const matchesTag = !params.tag || p.tags.map(t => t.toLowerCase()).includes(params.tag);
    const s = filters.searchValue;
    const matchesSearch = !s || (
    p.title.toLowerCase().includes(s) ||
    p.description?.toLowerCase().includes(s) ||
    p.tags.some(tag => tag.toLowerCase().includes(s))
    );

    const matchesUserTags = filters.selectedTags.length === 0 || p.tags.some(t => filters.selectedTags.includes(t.toLowerCase()));
    const matchesStock = !filters.inStockOnly || p.variants.some(v => v.available);
    const price = p.variants[0].price;
    const matchesPrice = price >= filters.priceMin && price <= filters.priceMax;


    return matchesType && matchesTag && matchesSearch && matchesUserTags && matchesStock && matchesPrice;
  });
}

function sortProducts(products, sort) {
  const sorted = [...products];
  if (sort === "price-asc") sorted.sort((a, b) => a.variants[0].price - b.variants[0].price);
  if (sort === "price-desc") sorted.sort((a, b) => b.variants[0].price - a.variants[0].price);
  if (sort === "newest") sorted.reverse(); // assume newer listed last
  return sorted;
}

function updateProductDisplay(filtered) {
  const grid = document.getElementById("category-products");
  const empty = document.getElementById("empty-state");
  if (filtered.length === 0) {
    grid.innerHTML = "";
    empty.style.display = "block";
  } else {
    empty.style.display = "none";
    renderProductList(filtered, "category-products");
  }
}

function setupListeners(products, params) {
  const sortSelect = document.getElementById("sort-options");
  const searchInput = document.getElementById("search-input");
  const tagCheckboxes = document.querySelectorAll("#tag-filters input");
  const priceRange = document.getElementById("price-range");
  const priceValue = document.getElementById("price-value");

  const priceMinInput = document.getElementById("price-min");
  const priceMaxInput = document.getElementById("price-max");

  const update = () => {
    const filters = getFilterState();
    const sorted = sortProducts(
      applyFilters(products, params, filters),
      sortSelect?.value || "price-asc"
    );
    updateProductDisplay(sorted);
  };

  sortSelect?.addEventListener("change", update);
  searchInput?.addEventListener("input", update);
  tagCheckboxes?.forEach(cb => cb.addEventListener("change", update));
  priceMinInput?.addEventListener("input", update);
  priceMaxInput?.addEventListener("input", update);
}


(async function init() {
  const params = getParams();
  renderBreadcrumb(params.type, params.tag);
  renderTitle(params.type);
  renderBanner(params.type);

  // Load from cache if available
  cachedProducts = sessionStorage.getItem("cachedProducts")
    ? JSON.parse(sessionStorage.getItem("cachedProducts"))
    : await fetchAllProducts();

  sessionStorage.setItem("cachedProducts", JSON.stringify(cachedProducts));
  populateTagFilters(cachedProducts);
  setupListeners(cachedProducts, params);

  const initialFilters = getFilterState();
  const sorted = sortProducts(
    applyFilters(cachedProducts, params, initialFilters),
    params.sort
  );

  updateProductDisplay(sorted);
})();
