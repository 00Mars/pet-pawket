/* /public/components/productCard.js
   Compact card: clickable card via stretched-link; wishlist-only CTA; responsive images.
*/
export function productCardHTML(p) {
  const title  = escapeHtml(p.title || 'Untitled');
  const handle = encodeURIComponent(p.handle || '');
  const id     = escapeHtml(p.id || '');
  const img    = p?.featuredImage?.url || '';
  const min    = Number(p?.priceRange?.minVariantPrice?.amount ?? NaN);
  const max    = Number(p?.priceRange?.maxVariantPrice?.amount ?? NaN);
  const cc     = p?.priceRange?.minVariantPrice?.currencyCode
              || p?.priceRange?.maxVariantPrice?.currencyCode || 'USD';
  const price  = formatPriceRange(min, max, cc);

  const href = `/product.html?handle=${handle}`;

  return `
<li class="pp-card" data-id="${id}" data-handle="${handle}">
  <a class="stretched-link view-link" href="${href}" aria-label="View ${title}"></a>

  <div class="media" aria-hidden="true">
    ${img ? `<img
      src="${withWidth(img, 640)}"
      srcset="${withWidth(img,320)} 320w, ${withWidth(img,640)} 640w, ${withWidth(img,960)} 960w"
      sizes="(min-width:1200px) 25vw, (min-width:768px) 33vw, 50vw"
      alt=""
      loading="lazy"
      decoding="async"
    />` : ''}
  </div>

  <div class="body">
    <h3 class="title" title="${title}">${title}</h3>
    <div class="price">${escapeHtml(price)}</div>
    <div class="cta-row" role="group" aria-label="Actions">
      <button type="button"
              class="btn btn-sm btn-outline-secondary wish"
              data-handle="${handle}"
              aria-pressed="false"
              aria-label="Add ${title} to wishlist">
        <i class="bi bi-heart" aria-hidden="true"></i>
        <span class="visually-hidden">Wishlist</span>
      </button>
    </div>
  </div>
</li>`;
}

export function productSkeletonHTML() {
  return `
<li class="pp-skel" aria-hidden="true">
  <div class="block"></div>
  <div class="stack">
    <div class="bar"></div>
    <div class="bar w60"></div>
    <div class="bar w40"></div>
  </div>
</li>`;
}

/* Utilities */
export function formatPriceRange(min, max, currency = 'USD') {
  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  const a = Number.isFinite(min) ? min : NaN;
  const b = Number.isFinite(max) ? max : NaN;
  if (Number.isFinite(a) && Number.isFinite(b)) return a === b ? fmt.format(a) : `${fmt.format(a)} – ${fmt.format(b)}`;
  if (Number.isFinite(a)) return fmt.format(a);
  if (Number.isFinite(b)) return fmt.format(b);
  return '';
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/** Heuristic helper to request width variants if CDN supports ?width= */
function withWidth(url, w) {
  if (!url) return url;
  if (url.includes('width=')) return url.replace(/width=\d+/, `width=${w}`);
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${w}`;
}