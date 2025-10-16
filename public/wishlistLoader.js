import {
  getWishlist,
  fetchAllProducts,
  renderProductList
} from './shopifyProducts.js';

(async function loadWishlist() {
  const handles = getWishlist();
  const all = await fetchAllProducts();
  const filtered = all.filter(p => handles.includes(p.handle));
  renderProductList(filtered, "wishlist-items");
})();
