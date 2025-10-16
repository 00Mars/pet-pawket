// public/forMyPets.js
const petsList = document.getElementById('petsList');
const recs = document.getElementById('recs');

function card(p) {
  const img = p.featuredImage?.url || '/assets/images/placeholder.png';
  const price = p.priceRange?.minVariantPrice;
  const priceStr = price ? `${Number(price.amount).toFixed(2)} ${price.currencyCode}` : '';
  return `
    <div class="col-6 col-md-3">
      <div class="card h-100">
        <a href="/product/${encodeURIComponent(p.handle)}" class="text-decoration-none text-reset">
          <img src="${img}" class="card-img-top" alt="${p.title||''}" style="object-fit:cover;height:190px;">
        </a>
        <div class="card-body d-flex flex-column">
          <a href="/product/${encodeURIComponent(p.handle)}" class="stretched-link text-decoration-none text-reset">
            <div class="fw-semibold text-truncate">${p.title||''}</div>
          </a>
          <div class="text-muted small mt-1">${priceStr}</div>
        </div>
      </div>
    </div>`;
}

async function loadPets() {
  try {
    const r = await fetch('/api/pets', { credentials: 'include' });
    const j = await r.json();
    const pets = j.pets || [];
    petsList.innerHTML = pets.map(p => `
      <div class="col-12 col-md-6">
        <div class="p-3 bg-white rounded-3 border">
          <div class="d-flex align-items-center justify-content-between">
            <div>
              <div class="fw-bold fs-5">${p.name}</div>
              <div class="text-muted small">${p.species || ''} · size ${p.size || '–'} · chew ${p.chew_strength || '–'}</div>
              <div class="text-muted small">Allergies: ${(p.allergies||[]).join(', ') || 'none'}</div>
            </div>
            <button class="btn btn-primary" data-action="see-recs" data-pet-id="${p.id}">See picks</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    petsList.innerHTML = `<div class="text-danger">Could not load pets.</div>`;
  }
}

async function loadRecs(petId) {
  recs.innerHTML = `<div class="text-muted">Loading recommendations…</div>`;
  try {
    const r = await fetch(`/api/pets/${petId}/recs?limit=24`, { credentials:'include' });
    const j = await r.json();
    const items = j.items || [];

    const grid = items.length
      ? items.map(card).join('')
      : `<div class="text-muted">No picks yet.</div>`;

    // Add a Build Pack button above the grid (no HTML file changes needed)
    recs.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="fw-semibold">Personalized picks</div>
        <button class="btn btn-primary btn-sm"
                data-action="build-pack"
                data-pet-id="${petId}">
          Build Pawket Pack
        </button>
      </div>
      <div class="row g-3">${grid}</div>
    `;
  } catch {
    recs.innerHTML = `<div class="text-danger">Could not load recommendations.</div>`;
  }
}

// Example button handler (on for-my-pets page after you load pack preview)
async function buildPack(petId){
  const prev = await (await fetch(`/api/pets/${petId}/pawket/preview`, { credentials:'include' })).json();
  const lines = (prev.items||[])
    .map(p => p.variants?.edges?.[0]?.node?.id)
    .filter(Boolean)
    .map(merch => ({ merchandiseId: merch, quantity: 1 }));

  const r = await fetch('/api/cart/create', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'include',
    body: JSON.stringify({ lines })
  });
  const j = await r.json();
  if (j.checkoutUrl) location.href = j.checkoutUrl;
}


document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="see-recs"]');
  if (btn) {
    loadRecs(btn.dataset.petId);
    return;
  }
  const packBtn = e.target.closest('[data-action="build-pack"]');
  if (packBtn) {
    buildPack(packBtn.dataset.petId);
  }
});

loadPets();