// public/productsUX.js
// Delegated navigation to product page + wishlist add/remove (cookie auth).
// Zero layout changes. Works with anchors OR data attributes.

console.info('[productsUX] v1');

function getHandleFromNode(node){
  // Prefer explicit data attribute
  const h = node?.dataset?.productHandle || node?.dataset?.handle;
  if (h) return h;
  // Fallbacks: look for href with /products/handle or /product.html?handle=
  const a = node.closest('a[href*="/products/"], a[href*="product.html"]');
  if (a) {
    try {
      const href = new URL(a.href, location.origin);
      if (href.pathname.startsWith('/products/')) return decodeURIComponent(href.pathname.split('/').pop());
      if (href.pathname.endsWith('/product.html')) return href.searchParams.get('handle') || '';
    } catch {}
  }
  return '';
}

function getProductIdFromNode(node){
  return node?.dataset?.productId || node?.closest('[data-product-id]')?.dataset?.productId || '';
}

async function wishlist(method, body){
  const res = await fetch('/api/wishlist', {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body || {})
  });
  if (!res.ok) {
    const t = await res.text().catch(()=>'');
    throw new Error(`Wishlist ${method} failed: ${res.status} ${t.slice(0,120)}`);
  }
  return res.json().catch(()=>({ ok: true }));
}

// Delegated clicks
document.addEventListener('click', async (e) => {
  const linkEl = e.target.closest('[data-action="open-product"], .product-link, .product-card-link');
  if (linkEl) {
    // Navigate to product page
    const handle = getHandleFromNode(linkEl) || linkEl.getAttribute('data-handle') || linkEl.getAttribute('data-product-handle');
    if (handle) {
      e.preventDefault();
      // Prefer pretty route if you have it; fallback to product.html?handle=
      const pretty = `/products/${encodeURIComponent(handle)}`;
      const fallback = `/product.html?handle=${encodeURIComponent(handle)}`;
      // If your router handles /products/:handle, go pretty; otherwise fallback.
      location.href = pretty; // change to fallback if your site uses product.html
    }
  }

  const addBtn = e.target.closest('[data-action="wishlist-add"]');
  if (addBtn) {
    e.preventDefault();
    addBtn.disabled = true;
    const productId = getProductIdFromNode(addBtn);
    const handle = getHandleFromNode(addBtn);
    try {
      await wishlist('POST', { productId, handle });
      addBtn.textContent = 'Saved ♥';
      addBtn.classList.add('active');
    } catch (err) {
      console.error('[wishlist] add error:', err);
      addBtn.textContent = 'Save ♥';
      alert('Could not save to wishlist. Are you signed in?');
    } finally {
      addBtn.disabled = false;
    }
  }

  const rmBtn = e.target.closest('[data-action="wishlist-remove"]');
  if (rmBtn) {
    e.preventDefault();
    rmBtn.disabled = true;
    const productId = getProductIdFromNode(rmBtn);
    const handle = getHandleFromNode(rmBtn);
    try {
      await wishlist('DELETE', { productId, handle });
      rmBtn.textContent = 'Removed';
      rmBtn.classList.remove('active');
      // Optional: remove card from DOM if on wishlist page
      const card = rmBtn.closest('.product-card, [data-product-id]');
      if (card && card.parentElement?.id === 'wishlistGrid') card.remove();
    } catch (err) {
      console.error('[wishlist] remove error:', err);
      alert('Could not remove from wishlist.');
    } finally {
      rmBtn.disabled = false;
    }
  }
});