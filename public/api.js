/* /public/api.js — tiny adapter for Pets, Search, Products, Wishlist, Prefs, Subs
   All requests use credentials:'include'. Shapes normalized for stable UI. */

export const api = (() => {
  const j = async (res) => {
    let body = null;
    try { body = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, body };
  };
  const get  = (url) => fetch(url, { credentials: 'include' }).then(j);
  const send = (url, method, data) =>
    fetch(url, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    }).then(j);

  /* ---------- Pets CRUD ---------- */
  async function petsList() {
    const r = await get('/api/pets');
    const arr = Array.isArray(r.body) ? r.body : (r.body?.pets || []);
    return { ok: r.ok, pets: arr };
  }
  async function petsCreate({ name, species, birthday }) {
    return send('/api/pets', 'POST', { name, species, birthday });
  }
  async function petsUpdate(id, patch) {
    return send(`/api/pets/${encodeURIComponent(id)}`, 'PATCH', patch);
  }
  async function petsDelete(id) {
    return send(`/api/pets/${encodeURIComponent(id)}`, 'DELETE');
  }

  /* ---------- Products (search/list/detail) ---------- */
  async function searchProducts(q, limit = 24) {
    const r = await get(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`);
    const products = Array.isArray(r.body?.items) ? r.body.items : [];
    return { ok: r.ok, products };
  }
  async function featuredProducts(limit = 8) {
    const r = await get(`/api/products/featured?limit=${limit}`);
    const products = Array.isArray(r.body?.items) ? r.body.items : [];
    return { ok: r.ok, products };
  }
  // *** Missing before: used by /public/wishlist.js ***
  async function productByHandle(handle) {
    const raw = String(handle || '').trim();
    if (!raw || raw.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9/_-]{0,199}$/.test(raw)) {
      return { ok: false, product: null, status: 400 };
    }
    const h = raw;
    const r = await get(`/api/products/handle/${encodeURIComponent(h)}`);
    return { ok: r.ok, product: r.body?.product || null, status: r.status };
  }

  /* ---------- Wishlist ---------- */
  async function wishlistAdd(handle) {
    const r = await send('/api/wishlist', 'POST', { handle });
    return { ok: r.ok, wishlist: r.body?.wishlist || [] };
  }
  async function wishlistRemove(handle) {
    const r = await send(`/api/wishlist/${encodeURIComponent(handle)}`, 'DELETE');
    return { ok: r.ok, wishlist: r.body?.wishlist || [] };
  }

  /* ---------- Pane Prefs (server if present; else localStorage) ---------- */
  const LS_PANE = 'pp.myPetsPane.on';
  async function prefsGetForMyPets() {
    try {
      const raw = localStorage.getItem(LS_PANE);
      return { ok: true, on: raw === '1' };
    } catch {
      return { ok: true, on: false };
    }
  }
  async function prefsSetForMyPets(on) {
    try { localStorage.setItem(LS_PANE, on ? '1' : '0'); } catch {}
    return { ok: true };
  }

/* ---------- Subscriptions (optional) ---------- */
  async function subsSuggest(petId) {
    const urls = [
      `/api/subscriptions/suggest?pet=${encodeURIComponent(petId || '')}`,
      `/api/subs/suggest?pet=${encodeURIComponent(petId || '')}` // compat
    ];
    for (const u of urls) {
      const r = await get(u);
      if (r.ok) return { ok: true, suggestions: r.body?.suggestions || r.body?.items || [] };
    }
    return { ok: false, suggestions: [] };
  }

  return {
    petsList, petsCreate, petsUpdate, petsDelete,
    searchProducts, featuredProducts, productByHandle,
    wishlistAdd, wishlistRemove,
    prefsGetForMyPets, prefsSetForMyPets,
    subsSuggest
  };
})();
