// /public/product.js
// PDP logic (scoped to this page)

/* -------------------------- URL / Money helpers -------------------------- */
function getHandleFromUrl() {
  const path = (location.pathname || '/').replace(/\/+$/,'') || '/';
  const m = path.match(/^\/products\/([^/]+)$/);
  if (m) return decodeURIComponent(m[1]);
  const u = new URL(location.href);
  return u.searchParams.get('handle') || '';
}

const moneyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
const money = (n) => moneyFmt.format(Number(n || 0));

async function j(url, init){ const r = await fetch(url, init); if(!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); }

/* ------------------------------- Data load ------------------------------- */
async function loadProduct(handle){
  // local first
  for (const url of [
    `/api/products/by-handle?handle=${encodeURIComponent(handle)}`,
    `/api/products/${encodeURIComponent(handle)}`,
    `/api/product?handle=${encodeURIComponent(handle)}`
  ]) { try { return await j(url, { credentials:'include' }); } catch {} }

  // Shopify fallback (.js exposes cents)
  const shop = document.querySelector('meta[name="shop-origin"]')?.content?.replace(/\/+$/,'') || '';
  if (!shop) throw new Error('Shop origin missing.');
  const data = await j(`${shop}/products/${encodeURIComponent(handle)}.js`);

  const variants = (data.variants || []).map(v => ({
    id: v.id,
    title: v.title,
    price: Number(v.price || 0) / 100,
    available: v.available !== false && v.available !== 'false',
  }));

  const min = variants.reduce((m,v)=>Math.min(m,v.price), Number.POSITIVE_INFINITY);
  const max = variants.reduce((m,v)=>Math.max(m,v.price), 0);

  return {
    id: data.id,
    title: data.title,
    handle: data.handle,
    descriptionHtml: data.description || '',
    images: (data.images || []).map(url => ({ url, altText: data.title })),
    variants,
    priceRange: {
      minVariantPrice: { amount: min, currencyCode: 'USD' },
      maxVariantPrice: { amount: max, currencyCode: 'USD' },
    }
  };
}

/* ----------------------------- Sticky offsets ---------------------------- */
/** Measure fixed header/announcement heights and feed CSS custom props. */
function updateStickyOffsets() {
  let h = 0;

  // Candidates that might be fixed at the top.
  const candidates = [
    document.querySelector('#navbar-container'),
    document.querySelector('.site-header'),
    document.querySelector('header'),
    document.querySelector('nav'),
    document.querySelector('.announcement-bar'),
    document.querySelector('#announcement'),
    document.querySelector('[data-announcement]')
  ];

  for (const el of candidates) {
    if (!el) continue;
    const cs = getComputedStyle(el);
    const fixedLike = cs.position === 'fixed' || cs.position === 'sticky';
    const topIsZeroish = (parseInt(cs.top, 10) || 0) <= 4; // guard against bottom-fixed bars
    if (fixedLike && topIsZeroish) {
      h = Math.max(h, el.getBoundingClientRect().height);
    }
  }

  if (!h) h = 80; // sane default
  const px = `${Math.round(h)}px`;
  document.documentElement.style.setProperty('--nav-fixed-h', px);
  document.documentElement.style.setProperty('--pdp-sticky-top', `calc(${px} + 8px)`);
}

// Light throttle for resize
function throttle(fn, ms=150){
  let t = 0, pending = null;
  return (...args) => {
    const now = Date.now();
    const run = () => { t = now; pending = null; fn(...args); };
    if (now - t >= ms) run();
    else if (!pending) pending = setTimeout(run, ms - (now - t));
  };
}

/* --------------------------------- Render -------------------------------- */
function render(root, p){
  const hero = p.images?.[0]?.url || '/assets/images/placeholder.png';
  const thumbs = (p.images || []).slice(0, 8);

  const variantOptions = (p.variants || []).map(v =>
    `<option value="${String(v.id)}" ${v.available ? '' : 'disabled'}>${v.title} — ${money(v.price)}</option>`
  ).join('');

  const minp = p.priceRange?.minVariantPrice?.amount ?? null;
  const maxp = p.priceRange?.maxVariantPrice?.amount ?? null;
  const priceRangeStr = (minp != null && maxp != null)
    ? (minp === maxp ? money(minp) : `${money(minp)} – ${money(maxp)}`)
    : '';

  root.innerHTML = `
    <div class="pdp-grid">
      <!-- LEFT: gallery, then sticky buy box -->
      <div class="pdp-col-left">
        <div class="pdp-card pdp-gallery">
          <img class="pdp-media-hero" src="${hero}" alt="${p.title || ''}">
          ${thumbs.length ? `
            <div class="pdp-thumbs">
              ${thumbs.map((t,i)=>`<img src="${t.url}" alt="${p.title || ''}" data-role="thumb" ${i===0?'aria-current="true"':''}>`).join('')}
            </div>` : ``}
        </div>

        <div class="pdp-card pdp-buy pdp-buy--left">
          <div id="pdp-price" class="pdp-price">${priceRangeStr}</div>

          ${(p.variants && p.variants.length) ? `
            <div class="mb-2">
              <label class="form-label">Options</label>
              <select class="form-select pdp-variant" id="pdp-variant">${variantOptions}</select>
            </div>` : ``}

          <div class="d-flex align-items-center gap-2">
            <label for="pdp-qty" class="form-label m-0">Qty</label>
            <input id="pdp-qty" class="form-control pdp-qty" type="number" min="1" step="1" value="1">
          </div>

          <div class="pdp-cta-row">
            <button class="btn btn-primary" id="pdp-add">Add to cart</button>
            <button class="btn btn-outline-secondary" id="pdp-wish"><i class="bi bi-heart"></i> Wishlist</button>
          </div>

          <div class="pdp-trust">
            <span><i class="bi bi-shield-lock"></i> Secure payments</span>
            <span><i class="bi bi-box-seam"></i> Ships in 24–48h</span>
            <span><i class="bi bi-recycle"></i> Easy returns</span>
          </div>
        </div>
      </div>

      <!-- RIGHT: description starts at the top -->
      <div class="pdp-col-right">
        <div class="pdp-card pdp-desc-top">
          <h2 class="pdp-section-title">Details</h2>
          <article id="pdp-desc-html">${p.descriptionHtml || ''}</article>
        </div>
      </div>
    </div>
  `;

  // Title + doc title
  document.getElementById('pdp-title').textContent = p.title || 'Product';
  document.title = `${p.title || 'Product'} • Pet Pawket`;

  // Thumbs interaction
  root.querySelectorAll('[data-role="thumb"]').forEach(imgEl => {
    imgEl.addEventListener('click', () => {
      root.querySelectorAll('[data-role="thumb"]').forEach(t => t.removeAttribute('aria-current'));
      imgEl.setAttribute('aria-current','true');
      const big = root.querySelector('.pdp-media-hero');
      if (big) big.src = imgEl.src;
    });
  });

  // Variant price change
  const priceEl = document.getElementById('pdp-price');
  const variantSel = document.getElementById('pdp-variant');
  function updatePriceFromVariant(){
    if(!variantSel || !priceEl) return;
    const v = (p.variants || []).find(x => String(x.id) === String(variantSel.value));
    if (v) priceEl.textContent = money(v.price);
  }
  variantSel?.addEventListener('change', updatePriceFromVariant);

  // Add to cart
  document.getElementById('pdp-add')?.addEventListener('click', async () => {
    const qty = Math.max(1, Number(document.getElementById('pdp-qty')?.value || 1));
    const variantId = variantSel ? variantSel.value : (p.variants?.[0]?.id || '');
    if (!variantId) return alert('No variant available.');
    try{
      const r = await fetch('/api/cart', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ lines:[{ variantId, quantity: qty }] })
      });
      if(!r.ok) throw new Error(await r.text());
      const btn = document.getElementById('pdp-add');
      if (btn) { btn.innerHTML = '<i class="bi bi-check-lg"></i> Added'; btn.classList.replace('btn-primary','btn-success'); }
    }catch{
      const shop = document.querySelector('meta[name="shop-origin"]')?.content?.replace(/\/+$/,'');
      if (shop) location.href = `${shop}/cart/add?id=${encodeURIComponent(variantId)}&quantity=${encodeURIComponent(qty)}`;
    }
  });

  // Wishlist
  document.getElementById('pdp-wish')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try{
      await fetch('/api/wishlist', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ productId: p.id, handle: p.handle })
      });
      const btn = e.currentTarget;
      btn.innerHTML = '<i class="bi bi-heart-fill"></i> Wishlisted';
      btn.classList.replace('btn-outline-secondary','btn-secondary');
    }catch{ alert('Could not add to wishlist. Are you signed in?'); }
  });
}

/* --------------------------------- Boot ---------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  // Initial + reactive sticky offsets
  updateStickyOffsets();
  window.addEventListener('resize', throttle(updateStickyOffsets, 150));

  // Observe navbar injection/size changes
  const nav = document.querySelector('#navbar-container') || document.querySelector('header, nav');
  if (nav) {
    try {
      new ResizeObserver(throttle(updateStickyOffsets, 50)).observe(nav);
    } catch {}
  }
  const mo = new MutationObserver(throttle(updateStickyOffsets, 50));
  mo.observe(document.documentElement, { childList: true, subtree: true });

  const handle = getHandleFromUrl();
  const statusEl = document.getElementById('pdp-status');
  const root = document.getElementById('pdp-root');

  try{
    if(!handle) throw new Error('Missing product handle in URL.');
    statusEl.textContent = 'Loading…';
    const product = await loadProduct(handle);
    render(root, product);
    statusEl.textContent = '';

    // One more pass in case layout shifted after render
    updateStickyOffsets();
  }catch(e){
    console.error('[PDP] load error:', e);
    statusEl.textContent = 'Sorry — we couldn’t load this product.';
    root.innerHTML = `<div class="alert alert-danger">${e?.message || 'Unknown error'}</div>`;
  }
});
