<<<<<<< HEAD
// public/searchLogic.js — overlay search wiring (products + pets + journal)
export function setupSearchFunctionality(allProducts = []) {
  const input   = document.getElementById('searchInput')      || document.querySelector('[data-search-input]');
  const results = document.getElementById('search-results')   || document.querySelector('[data-search-results]');
  const filter  = document.getElementById('categoryFilter')   || document.querySelector('[data-search-category]');
  const button  = document.getElementById('manualSearchBtn')  || document.querySelector('[data-search-button]');
  if (!input || !results) return;

  // Debounced runner
  const run = debounce(async () => {
    const term = String(input.value || '').trim();
    const cat  = (filter ? String(filter.value || 'all') : 'all').toLowerCase();
    if (!term) { results.innerHTML = ''; return; }

    // --- Local product match (fast) ---
    const local = (Array.isArray(allProducts) ? allProducts : []).map(normProduct).filter(p => {
      const inText = p.title.includes(term.toLowerCase()) || p.type.includes(term.toLowerCase());
      const inCat  = (cat === 'all') || (p.type === cat);
      return inText && inCat;
    });

    // --- Server search (pets + journal + products) ---
    let pets = [], journal = [], remoteProducts = [];
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { credentials: 'include' });
      if (r.ok) {
        const j = await r.json();
        pets = Array.isArray(j.pets) ? j.pets : [];
        journal = Array.isArray(j.journal) ? j.journal : [];
        remoteProducts = Array.isArray(j.products) ? j.products.map(mapRemoteProduct) : [];
      }
    } catch { /* non-fatal */ }

    // Merge remote products with local (unique by handle)
    const mergedProducts = mergeProducts(local, remoteProducts).slice(0, 12);

    // Render
    results.innerHTML = '';
    const frag = document.createDocumentFragment();
    if (pets.length) frag.appendChild(renderSection('Pets', pets.slice(0, 5).map(renderPet)));
    if (journal.length) frag.appendChild(renderSection('Journal', journal.slice(0, 5).map(renderJournal)));
    if (mergedProducts.length) frag.appendChild(renderSection('Products', mergedProducts.slice(0, 8).map(renderProductCard)));

    // CTA: view all results
    const cta = document.createElement('button');
    cta.className = 'btn btn-outline-primary mt-2';
    cta.textContent = 'View All Results';
    cta.addEventListener('click', () => {
      window.location.href = `/shop?q=${encodeURIComponent(term)}`;
    });
    const ctaWrap = document.createElement('div');
    ctaWrap.className = 'mt-2';
    ctaWrap.appendChild(cta);
    results.appendChild(frag);
    results.appendChild(ctaWrap);
  }, 180);

  input.addEventListener('input', run);
  button && button.addEventListener('click', (e) => { e.preventDefault(); run(); });

  // hydrate category filter (optional)
  if (filter && !filter.dataset._hydrated && Array.isArray(allProducts) && allProducts.length) {
    const types = Array.from(new Set(allProducts.map(p => (p.type || 'Other')).filter(Boolean)));
    for (const t of types) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      filter.appendChild(opt);
    }
    filter.dataset._hydrated = '1';
    filter.addEventListener('change', run);
  }
}

/* ---------- helpers ---------- */
function debounce(fn, wait = 150) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function normProduct(p = {}) {
  return {
    id: p.id || p.productId || '',
    title: String(p.title || '').toLowerCase(),
    titleRaw: p.title || '',
    handle: p.handle || '',
    type: String(p.type || 'Other').toLowerCase(),
    price: p.price || p.priceRange || null,
    image: p.image || p.images?.[0]?.src || p.featuredImage?.url || '',
  };
}

function mapRemoteProduct(n = {}) {
  return {
    id: n.id || '',
    title: (n.title || ''),
    titleRaw: (n.title || ''),
    handle: n.handle || '',
    type: String(n.productType || n.type || 'Other'),
    price: n.priceRange?.minVariantPrice?.amount || n.price || null,
    image: n.featuredImage?.url || n.images?.edges?.[0]?.node?.src || '',
  };
}

function mergeProducts(local = [], remote = []) {
  const byHandle = new Map();
  const push = (p) => {
    const h = p.handle || '';
    if (!h) return;
    if (!byHandle.has(h)) byHandle.set(h, p);
  };
  local.forEach(push);
  remote.forEach(push);
  return Array.from(byHandle.values());
}

function renderSection(title, nodes = []) {
  const wrap = document.createElement('div');
  const h = document.createElement('h6');
  h.textContent = title;
  h.className = 'mt-2 mb-2 text-muted';
  wrap.appendChild(h);
  nodes.forEach(n => wrap.appendChild(n));
  return wrap;
}

function renderPet(p) {
  const li = document.createElement('div');
  li.className = 'search-result-card';
  const img = document.createElement('img');
  img.src = p.avatar || '/assets/images/default-pet.png';
  const a = document.createElement('a');
  a.href = '/account.html#pets';
  a.textContent = p.name || 'Pet';
  a.className = 'search-result-title';
  const meta = document.createElement('div');
  meta.textContent = [p.species, p.breed].filter(Boolean).join(' • ');
  const right = document.createElement('div');
  right.innerHTML = '<i class="bi bi-arrow-right-short"></i>';
  li.append(img, (function(){ const d=document.createElement('div'); d.appendChild(a); d.appendChild(meta); return d; })(), right);
  return li;
}

function renderJournal(j) {
  const div = document.createElement('div');
  div.className = 'search-result-card';
  const img = document.createElement('img');
  img.src = '/assets/images/journal.png';
  const title = document.createElement('div');
  title.className = 'search-result-title';
  title.textContent = (j.text || '').slice(0, 80) + ((j.text || '').length > 80 ? '…' : '');
  const meta = document.createElement('div');
  const date = j.createdAt ? new Date(j.createdAt).toLocaleDateString() : '';
  meta.textContent = [j.mood, Array.isArray(j.tags) ? j.tags.join(', ') : '', date].filter(Boolean).join(' • ');
  const right = document.createElement('div');
  right.innerHTML = '<i class="bi bi-journal-text"></i>';
  const mid = document.createElement('div'); mid.appendChild(title); mid.appendChild(meta);
  div.append(img, mid, right);
  return div;
}

function renderProductCard(p) {
  const card = document.createElement('div');
  card.className = 'search-result-card';
  const img = document.createElement('img');
  img.src = p.image || '/assets/images/placeholder.png';
  const a = document.createElement('a');
  a.href = '/products/' + encodeURIComponent(p.handle || '');
  a.className = 'search-result-title';
  a.textContent = p.titleRaw || p.title || 'Product';
  const meta = document.createElement('div');
  meta.className = 'search-result-price';
  if (p.price) meta.textContent = formatPrice(p.price);
  const right = document.createElement('div');
  right.innerHTML = '<i class="bi bi-box-seam"></i>';
  const mid = document.createElement('div'); mid.appendChild(a); mid.appendChild(meta);
  card.append(img, mid, right);
  return card;
}

function formatPrice(v) {
  const n = parseFloat(v);
  if (Number.isFinite(n)) return `$${n.toFixed(2)}`;
  return String(v || '');
=======
export function setupSearchFunctionality(allProducts) {
  console.log("[Search] Initializing search functionality...");

  const searchInput = document.getElementById('searchInput');
  const filterDropdown = document.getElementById('categoryFilter');
  const resultsContainer = document.getElementById('searchResults');
  const searchBtn = document.getElementById('manualSearchBtn');

  if (!searchInput || !filterDropdown || !resultsContainer || !searchBtn) {
    console.warn("[Search] One or more required elements not found. Aborting setup.");
    return;
  }

  console.log("[Search] Elements found. Wiring up events...");

  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'input-group mb-3';

  const parent = searchInput.parentElement;
  if (parent) {
    console.log("[Search] Wrapping search input and button...");
    parent.insertBefore(inputWrapper, searchInput);
    inputWrapper.appendChild(searchInput);
    inputWrapper.appendChild(searchBtn);
  }

  function updateSearchResults() {
    const term = searchInput.value.trim().toLowerCase();
    const category = filterDropdown.value.toLowerCase();
    resultsContainer.innerHTML = '';

    console.log(`[Search] Query: '${term}', Category: '${category}'`);

    if (term.length < 2) {
      console.log("[Search] Query too short, skipping search.");
      return;
    }

    const matched = allProducts.filter(p =>
      (p.title.toLowerCase().includes(term) || p.type.toLowerCase().includes(term)) &&
      (category === 'all' || p.type.toLowerCase() === category)
    );

    console.log(`[Search] ${matched.length} matching product(s) found.`);

    if (matched.length === 0) {
      const noResult = document.createElement('p');
      noResult.textContent = 'No matching products found.';
      resultsContainer.appendChild(noResult);
      return;
    }

    matched.slice(0, 5).forEach(product => {
      const wrapper = document.createElement('div');
      wrapper.className = 'mb-3 d-flex align-items-center gap-3';

      const img = document.createElement('img');
      img.src = product.image;
      img.alt = product.title;
      img.width = 60;
      img.height = 60;
      img.style.borderRadius = '6px';

      const info = document.createElement('div');
      info.innerHTML = `<div><strong>${product.title}</strong></div><div>$${product.price.toFixed(2)}</div>`;

      wrapper.appendChild(img);
      wrapper.appendChild(info);
      resultsContainer.appendChild(wrapper);
    });

    if (matched.length > 5) {
      const viewAllBtn = document.createElement('button');
      viewAllBtn.className = 'btn btn-outline-primary mt-2';
      viewAllBtn.textContent = `View All Results (${matched.length})`;
      viewAllBtn.addEventListener('click', () => {
        console.log("[Search] View All clicked. Redirecting...");
        window.location.href = `/search.html?q=${encodeURIComponent(searchInput.value.trim())}`;
      });
      resultsContainer.appendChild(viewAllBtn);
    }
  }

  filterDropdown.addEventListener('change', () => {
    console.log("[Search] Filter changed.");
    updateSearchResults();
  });

  searchInput.addEventListener('input', () => {
    console.log("[Search] Input updated.");
    updateSearchResults();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      console.log("[Search] Enter key pressed. Triggering manual search.");
      searchBtn.click();
    }
  });

  searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query.length > 0) {
      console.log(`[Search] Manual search submitted for query: '${query}'`);
      window.location.href = `/search.html?q=${encodeURIComponent(query)}`;
    } else {
      console.log("[Search] Manual search submitted with empty query. Ignored.");
    }
  });
>>>>>>> c2470ba (Initial real commit)
}
