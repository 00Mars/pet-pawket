<<<<<<< HEAD
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
=======
export function injectPetTypes() {
    fetch('pettypes.html')
      .then(res => res.text())
      .then(html => {
        const container = document.getElementById('pettypes-container');
        if (container) {
          container.innerHTML = html;
          console.log("[ShopBy] Injected shop-by HTML into #pettypes-container");
  
          // Initialize after DOM injection
          initializeShopBySection();
        } else {
          console.warn("[ShopBy] #pettypes-container not found");
        }
      })
      .catch(err => console.error("[ShopBy] Failed to load shop-by section:", err));
  }
  
  // === Tile Data Sets ===
  const shopByData = {
    pet: [
      { href: "/collections/dogs", img: "assets/images/pet-dog.png", label: "Dog Essentials" },
      { href: "/collections/cats", img: "assets/images/pet-cat.png", label: "Cat Favorites" },
      { href: "/collections/small-animals", img: "assets/images/pet-small.png", label: "Small Animal Picks" },
      { href: "/collections/birds", img: "assets/images/pet-bird.png", label: "Bird Supplies" },
      { href: "/collections/reptiles", img: "assets/images/pet-reptile.png", label: "Reptile Gear" },
      { href: "/collections/aquatics", img: "assets/images/pet-fish.png", label: "Aquatic Care" },
      { href: "/collections/farm-exotic", img: "assets/images/pet-exotic.png", label: "Other Animal Friends" }
    ],
    collection: [
      { href: "/collections/best-sellers", img: "assets/images/coll-best.png", label: "Best Sellers" },
      { href: "/collections/new-arrivals", img: "assets/images/coll-new.png", label: "New Arrivals" },
      { href: "/collections/eco", img: "assets/images/coll-eco.png", label: "Eco-Friendly" },
      { href: "/collections/memorial", img: "assets/images/coll-memory.png", label: "Pet Memorial" },
      { href: "/collections/giftable", img: "assets/images/coll-gift.png", label: "Giftable Picks" },
      { href: "/collections/seasonal", img: "assets/images/coll-seasonal.png", label: "Seasonal Specials" }
    ],
    need: [
      { href: "/collections/nutrition", img: "assets/images/need-nutrition.png", label: "Nutrition" },
      { href: "/collections/grooming", img: "assets/images/need-grooming.png", label: "Grooming" },
      { href: "/collections/training", img: "assets/images/need-training.png", label: "Training & Behavior" },
      { href: "/collections/health", img: "assets/images/need-health.png", label: "Health & Wellness" },
      { href: "/collections/toys", img: "assets/images/need-toys.png", label: "Toys & Enrichment" },
      { href: "/collections/habitat", img: "assets/images/need-habitat.png", label: "Bedding & Habitat" }
    ],
    lifestyle: [
      { href: "/collections/urban", img: "assets/images/life-urban.png", label: "Urban Pets" },
      { href: "/collections/adventure", img: "assets/images/life-adventure.png", label: "Adventure Pets" },
      { href: "/collections/seniors", img: "assets/images/life-senior.png", label: "Senior Companions" },
      { href: "/collections/new-parents", img: "assets/images/life-newpet.png", label: "New Pet Parents" },
      { href: "/collections/rescue-ready", img: "assets/images/life-rescue.png", label: "Rescue-Ready Picks" }
    ],
    brand: [
      { href: "/collections/brand-1", img: "assets/images/brand1.png", label: "Brand One" },
      { href: "/collections/brand-2", img: "assets/images/brand2.png", label: "Brand Two" },
      { href: "/collections/brand-3", img: "assets/images/brand3.png", label: "Brand Three" }
    ]
  };
  
  // === Initialization ===
  function initializeShopBySection() {
    window.switchShopBy = switchShopBy;
    window.openShopBySection = openShopBySection;
    window.closeShopBySection = closeShopBySection;
  
    switchShopBy("pet"); // Default view
    initializeArrowState();
  }
  
  function initializeArrowState() {
    const section = document.querySelector('.collapsible-content');
    const arrow = document.getElementById('shopByArrow');
    if (section && arrow) {
      arrow.classList.toggle('rotated', !section.classList.contains('hidden'));
    }
  }
  
  // === Content Logic ===
  function switchShopBy(type) {
    const title = document.getElementById("shopByTitle");
    const tileContainer = document.getElementById("shopByTiles");
  
    if (!shopByData[type]) return;
  
    title.textContent = `Shop by ${capitalize(type)}`;
    tileContainer.innerHTML = shopByData[type]
      .map(item => `
        <a href="${item.href}" class="pet-tile">
          <img src="${item.img}" alt="${item.label}" />
          <span>${item.label}</span>
        </a>
      `)
      .join("");
  }
  
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  // === Toggle Open/Close ===
  function openShopBySection() {
    const section = document.querySelector('.collapsible-content');
    const arrow = document.getElementById('shopByArrow');
    if (section && section.classList.contains('hidden')) {
      section.classList.remove('hidden');
      arrow.classList.add('rotated');
    }
  }
  
  function closeShopBySection() {
    const content = document.querySelector('#shopByContent');
    const arrow = document.getElementById('shopByArrow');
    if (content) content.classList.add('hidden');
    if (arrow) arrow.classList.remove('rotated');
  }
  window.closeShopBySection = closeShopBySection;
>>>>>>> c2470ba (Initial real commit)
