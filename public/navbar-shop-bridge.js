/**
 * Navbar → Shop bridge
 * - If on the shop page, dispatches `pp:shop:set`; otherwise navigates to /shop.html?...
 * - Supports a "For My Pets" toggle via data-my="1".
 *
 * data attributes:
 *   data-shop-cat="dog|cat|small-pet|bird|fish|accessories|"
 *   data-shop-sort="relevance|price-asc|price-desc|title-asc|title-desc"
 *   data-shop-per="24|48|96|192|0"
 *   data-subscribe="1"
 *   data-my="1"
 *   data-shop-q="text"
 */

function onReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
  else fn();
}
function collectDetailFromEl(el) {
  const d = {};
  if (!el) return d;
  const cat = el.getAttribute('data-shop-cat');
  const sort = el.getAttribute('data-shop-sort');
  const per  = el.getAttribute('data-shop-per');
  const sub  = el.getAttribute('data-subscribe');
  const my   = el.getAttribute('data-my');
  const q    = el.getAttribute('data-shop-q');

  if (cat != null) d.pet = cat;
  if (sort != null) d.sort = sort;
  if (per  != null && per  !== '') d.per  = Number(per);
  if (sub  != null) d.subscribe = sub === '1' || sub === 'true';
  if (my   != null) d.myPets = my === '1' || my === 'true';
  if (q    != null) d.q = q;
  return d;
}
function buildShopURL(detail) {
  const u = new URL('/shop.html', location.origin);
  if (detail.pet) u.searchParams.set('pet', detail.pet);
  if (detail.sort) u.searchParams.set('sort', detail.sort);
  if (Number.isFinite(Number(detail.per)) && Number(detail.per) > 0) u.searchParams.set('per', String(Number(detail.per)));
  if (detail.q) u.searchParams.set('q', detail.q);
  if (detail.subscribe) u.searchParams.set('subscribe', '1');
  if (detail.myPets) u.searchParams.set('mypets', '1');
  return u.toString();
}
function applyToLiveShop(detail) {
  const isShop = !!document.querySelector('.shop-page');
  if (!isShop) return false;
  document.dispatchEvent(new CustomEvent('pp:shop:set', { detail, bubbles: true }));
  const grid = document.getElementById('pp-grid');
  if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}
function bindSelect(select) {
  if (!select) return;
  select.addEventListener('change', () => {
    const val = String(select.value || '');
    const d = {};
    if (val === 'subscriptions' || val === 'subscribe') d.subscribe = true;
    else if (val === 'my-pets') d.myPets = true;
    else if (['dog','cat','small-pet','bird','fish','accessories',''].includes(val)) d.pet = val;
    else if (/^per-\d+|^per-0$/.test(val)) d.per = Number(val.split('-')[1] || '0');
    else if (['relevance','price-asc','price-desc','title-asc','title-desc'].includes(val)) d.sort = val;
    if (!applyToLiveShop(d)) location.href = buildShopURL(d);
  });
}
function bindMenu(root) {
  if (!root) return;
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-shop-cat],[data-shop-sort],[data-shop-per],[data-subscribe],[data-my],[data-shop-q]');
    if (!a) return;
    e.preventDefault();
    const detail = collectDetailFromEl(a);
    if (!applyToLiveShop(detail)) location.href = buildShopURL(detail);
  });
}
function findNavbarRoot() {
  return document.getElementById('navbar-container') || document.querySelector('nav,.navbar,[data-navbar]');
}
function observeNavbar(ready) {
  const container = document.getElementById('navbar-container');
  if (!container) { ready(); return; }
  const mo = new MutationObserver(() => {
    if (container.querySelector('nav')) { mo.disconnect(); ready(); }
  });
  mo.observe(container, { childList: true, subtree: true });
}
onReady(() => {
  const init = () => {
    const root = findNavbarRoot();
    bindMenu(root);
    const sel = root?.querySelector('#nav-shop, [data-nav-shop-select]');
    if (sel) bindSelect(sel);
  };
  observeNavbar(init);
  init();
});