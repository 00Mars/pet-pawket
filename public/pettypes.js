// /public/pettypes.js
// Chip-based "Shop by" that NAVIGATES to the shop page (e.g., /products?pet=dog).
// Optional: set a custom destination via data attribute on the mount:
//   <div id="pettypes-container" data-shop-path="/shop"></div>

export async function injectPetTypes() {
  const mount = document.getElementById('pettypes-container');
  if (!mount) return;

  // Where to send users when they pick a chip
  const SHOP_PATH = mount.dataset.shopPath || window.__SHOP_PAGE_PATH || '/products';

  const TYPES = [
    { key: 'all',   label: 'All',        icon: 'bi-stars' },
    { key: 'dog',   label: 'Dogs',       icon: 'bi-bone' },
    { key: 'cat',   label: 'Cats',       icon: 'bi-emoji-smile' },
    { key: 'bird',  label: 'Birds',      icon: 'bi-feather' },
    { key: 'fish',  label: 'Fish',       icon: 'bi-droplet' },
    { key: 'rept',  label: 'Reptiles',   icon: 'bi-eye' },
    { key: 'small', label: 'Small Pets', icon: 'bi-heart' },
    { key: 'acc',   label: 'Accessories',icon: 'bi-bag' },
    { key: 'treat', label: 'Treats',     icon: 'bi-cookie' },
    { key: 'toy',   label: 'Toys',       icon: 'bi-emoji-laughing' },
  ];

  // Preselect from ?pet= if present
  const urlPet = (new URL(location.href)).searchParams.get('pet') || 'all';
  let activeKey = TYPES.find(t => t.key === urlPet)?.key || 'all';

  mount.classList.add('pp-shopby');
  mount.innerHTML = `
    <div class="container">
      <div class="pp-shopby-head">
        <div class="pp-shopby-title">Shop by</div>
        <div class="pp-shopby-sub">Pick a pet or category</div>
      </div>
      <div class="pp-chip-rail">
        <div class="pp-chip-scroll" role="tablist" aria-label="Shop by pet type" id="pp-chip-scroll"></div>
      </div>
    </div>
  `;

  const rail = mount.querySelector('#pp-chip-scroll');

  // Render chips (use an inner radio for a11y but we'll visually hide it)
  rail.innerHTML = TYPES.map(t => `
    <label class="pp-chip" role="tab" aria-selected="${t.key === activeKey ? 'true' : 'false'}" data-key="${t.key}" data-active="${t.key === activeKey}">
      <input type="radio" name="pp-shopby" value="${t.key}" ${t.key === activeKey ? 'checked' : ''} />
      <i class="bi ${t.icon}" aria-hidden="true"></i>
      <span>${t.label}</span>
    </label>
  `).join('');

  function setActive(nextKey) {
    activeKey = nextKey;
    rail.querySelectorAll('.pp-chip').forEach(chip => {
      const on = chip.getAttribute('data-key') === activeKey;
      chip.dataset.active = on ? 'true' : 'false';
      chip.setAttribute('aria-selected', on ? 'true' : 'false');
      const input = chip.querySelector('input[type="radio"]');
      if (input) input.checked = on;
    });
  }

  function goToShop(nextKey) {
    const u = new URL(SHOP_PATH, location.origin);
    if (nextKey && nextKey !== 'all') u.searchParams.set('pet', nextKey);
    // Optional hint for analytics/UX
    u.searchParams.set('via', 'shopby');
    location.assign(u.toString());
  }

  // Click → set active (for visual) then navigate
  rail.addEventListener('click', (e) => {
    const chip = e.target.closest('.pp-chip');
    if (!chip) return;
    const key = chip.getAttribute('data-key');
    if (!key) return;
    setActive(key);
    goToShop(key);
  });

  // Keyboard support: Enter/Space navigate; arrows move focus
  rail.addEventListener('keydown', (e) => {
    const chips = Array.from(rail.querySelectorAll('.pp-chip'));
    const i = chips.findIndex(c => c.dataset.active === 'true');
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const key = chips[Math.max(0, i)].getAttribute('data-key');
      goToShop(key);
      return;
    }
    if (['ArrowRight','ArrowLeft','Home','End'].includes(e.key)) {
      e.preventDefault();
      let next = i;
      if (e.key === 'ArrowRight') next = Math.min(chips.length - 1, i + 1);
      if (e.key === 'ArrowLeft')  next = Math.max(0, i - 1);
      if (e.key === 'Home')       next = 0;
      if (e.key === 'End')        next = chips.length - 1;
      chips[next].focus();
      setActive(chips[next].getAttribute('data-key'));
    }
  });

  // Initial state (visual only)
  setActive(activeKey);
}

// Back-compat alias
export const injectShopBy = injectPetTypes;

// Auto-inject if present
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('pettypes-container')) injectPetTypes();
  });
} else {
  if (document.getElementById('pettypes-container')) injectPetTypes();
}
