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