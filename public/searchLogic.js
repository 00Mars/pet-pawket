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
}
