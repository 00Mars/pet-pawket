import { initBaseUI } from './baseInit.js';
import { setupSearchFunctionality } from './searchLogic.js';
import { allProducts } from './products.js';

document.addEventListener("DOMContentLoaded", () => {
  initBaseUI(() => {
    setupSearchFunctionality(allProducts);  // ✅ Same logic, same behavior
  });

  // Your contact form logic below...
});
