/**
 * Account • My Pets (profile + journal + shop bridge)
 * - Reads pets from /api/pets
 * - Profile edit: POST /api/pets (new), PATCH /api/pets/:id (update)
 * - Journal: GET /api/pets/:id/journal, POST /api/pets/:id/journal
 * - Subscriptions snapshot: GET /api/subscriptions?petId=...
 * - "Shop for this pet" → navigates to /shop.html?mypets=1&pet={speciesCat}&q={likes...}
 *
 * All calls are defensive: if an endpoint is missing, we show a friendly message.
 */

const elList   = document.getElementById('pp-pet-list');
const elDetail = document.getElementById('pp-pet-detail');
const btnAdd   = document.getElementById('pp-add-pet');

let pets = [];
let activeId = null;

function onReady(fn){ document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn(); }

onReady(() => {
  if (!elList || !elDetail) return;
  refreshPets();
  wireAddPet();
  // Support hash deep-link: /account.html#pets
  const hash = location.hash.replace('#','');
  if (hash === 'pets') {
    const tabBtn = document.getElementById('tab-pets');
    if (tabBtn) tabBtn.click();
  }
});

/* -----------------------------
   Data
------------------------------ */
async function refreshPets() {
  setListSkeleton();
  try {
    const r = await fetch('/api/pets', { credentials: 'include' });
    if (r.status === 401) {
      renderSignInCallout();
      return;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    pets = Array.isArray(j?.pets) ? j.pets : (Array.isArray(j) ? j : []);
    renderPetList();
    if (pets.length) selectPet(pets[0].id);
  } catch (e) {
    console.warn('[acct-pets] load pets failed:', e);
    renderError('We couldn’t load your pets. Please try again.');
  }
}

function parseCSV(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

/* -----------------------------
   List
------------------------------ */
function setListSkeleton() {
  elList.innerHTML = `
    <div class="list-group">
      ${[1,2,3].map(() => `
        <div class="list-group-item d-flex align-items-center">
          <div class="placeholder-glow flex-grow-1">
            <span class="placeholder col-6"></span>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderPetList() {
  if (!pets || !pets.length) {
    elList.innerHTML = `
      <div class="alert alert-light border d-flex align-items-center gap-2">
        <i class="bi bi-heart"></i>
        <div><strong>No pets yet.</strong> Add a pet to get tailored guidance and subscription picks.</div>
      </div>`;
    elDetail.innerHTML = '';
    return;
  }

  elList.innerHTML = pets.map(p => {
    const active = String(p.id) === String(activeId) ? ' active' : '';
    return `
      <button type="button" class="list-group-item list-group-item-action d-flex align-items-center${active}" data-id="${escapeHtml(p.id)}" role="option">
        <i class="bi bi-heart me-2"></i>
        <span class="flex-grow-1">${escapeHtml(p.name || 'Pet')}</span>
        ${p.species ? `<span class="badge text-bg-light">${escapeHtml(p.species)}</span>` : ''}
      </button>`;
  }).join('');

  elList.querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', () => selectPet(btn.getAttribute('data-id')));
  });
}

/* -----------------------------
   Detail (Profile + Journal + Subscriptions)
------------------------------ */
async function selectPet(id) {
  activeId = id;
  renderPetList();
  const pet = pets.find(p => String(p.id) === String(id));
  if (!pet) return;

  elDetail.innerHTML = petDetailSkeleton();

  // Load journal + subscriptions in parallel (best-effort)
  let journal = [], subs = [];
  try { journal = await loadJournal(id); } catch { /* ignore */ }
  try { subs    = await loadSubscriptions(id); } catch { /* ignore */ }

  elDetail.innerHTML = petDetailHTML(pet, journal, subs);
  wireProfileForm(pet);
  wireJournalForm(pet);
  wireShopBridge(pet);
}

function petDetailSkeleton() {
  return `
    <div class="card">
      <div class="card-body">
        <div class="placeholder-wave">
          <div class="placeholder col-7"></div>
          <div class="placeholder col-4"></div>
          <div class="placeholder col-4"></div>
          <div class="placeholder col-6"></div>
          <div class="placeholder col-8"></div>
        </div>
      </div>
    </div>`;
}

function petDetailHTML(pet, journal, subs) {
  const name    = escapeHtml(pet.name || '');
  const species = escapeHtml(pet.species || '');
  const breed   = escapeHtml(pet.breed || '');
  const dob     = escapeHtml(pet.dob || '');
  const traits = pet.traits || {};
  const weight  = escapeHtml((traits.weightLb != null ? String(traits.weightLb) : (pet.weight || '')));
  const likes   = Array.isArray(traits.flavors) ? traits.flavors.join(', ') : (Array.isArray(pet.likes) ? pet.likes.join(', ') : escapeHtml(pet.likes || ''));
  const allergies = Array.isArray(traits.allergies) ? traits.allergies.join(', ') : (Array.isArray(pet.allergies) ? pet.allergies.join(', ') : escapeHtml(pet.allergies || ''));

  return `
    <!-- Profile -->
    <section class="pp-section" aria-labelledby="pp-prof-title">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h2 id="pp-prof-title" class="h5 mb-0">Profile: ${name || 'Pet'}</h2>
        <div class="pp-actions">
          <button class="btn btn-sm btn-outline-secondary" id="pp-edit-traits"><i class="bi bi-sliders"></i> Traits</button>
          <button class="btn btn-sm btn-outline-primary" id="pp-shop"><i class="bi bi-bag-heart"></i> Shop for ${name || 'this pet'}</button>
        </div>
      </div>

      <form id="pp-prof-form" class="row g-3">
        <div class="col-md-6">
          <label class="form-label">Name</label>
          <input class="form-control" name="name" value="${name}" required>
        </div>
        <div class="col-md-6">
          <label class="form-label">Species</label>
          <input class="form-control" name="species" value="${species}" placeholder="Dog, Cat, ...">
        </div>
        <div class="col-md-6">
          <label class="form-label">Breed</label>
          <input class="form-control" name="breed" value="${breed}">
        </div>
        <div class="col-md-3">
          <label class="form-label">DOB</label>
          <input class="form-control" name="dob" type="date" value="${dob}">
        </div>
        <div class="col-md-3">
          <label class="form-label">Weight (lb)</label>
          <input class="form-control" name="weight" value="${weight}" placeholder="e.g., 22">
        </div>

        <div class="col-12">
          <label class="form-label">Likes / Prefers</label>
          <input class="form-control" name="likes" value="${likes}" placeholder="salmon, chicken, tuna">
          <div class="form-text">Comma-separated.</div>
        </div>
        <div class="col-12">
          <label class="form-label">Allergies / Avoid</label>
          <input class="form-control" name="allergies" value="${allergies}" placeholder="chicken, grain, dairy">
          <div class="form-text">Comma-separated.</div>
        </div>
        <div class="col-12 d-flex gap-2">
          <button class="btn btn-primary" type="submit">Save Profile</button>
          <button class="btn btn-outline-danger" type="button" id="pp-delete-pet">Delete</button>
        </div>
      </form>
    </section>

    <!-- Journal -->
    <section class="pp-section" aria-labelledby="pp-journal-title">
      <h2 id="pp-journal-title" class="h5 mb-2">Journal</h2>
      <div class="pp-journal-list" id="pp-journal-list">
        ${journalListHTML(journal)}
      </div>
      <form id="pp-journal-form" class="mt-2">
        <div class="mb-2">
          <label class="form-label">New entry</label>
          <textarea class="form-control" name="text" rows="3" placeholder="Notes, behavior, food reactions, goals..."></textarea>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-secondary" type="submit">Add Entry</button>
          <small class="pp-mini">Entries are timestamped automatically.</small>
        </div>
      </form>
    </section>

    <!-- Subscriptions -->
    <section class="pp-section" aria-labelledby="pp-subs-title">
      <h2 id="pp-subs-title" class="h5 mb-2">Recommended subscriptions</h2>
      <div id="pp-subs-list">${subsListHTML(subs)}</div>
    </section>
  `;
}

/* -----------------------------
   Profile form (save)
------------------------------ */
function wireProfileForm(pet) {
  const form = document.getElementById('pp-prof-form');
  const btnDel = document.getElementById('pp-delete-pet');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      name: fd.get('name') || '',
      species: fd.get('species') || '',
      breed: fd.get('breed') || '',
      birthday: fd.get('dob') || null,
    };
    // Merge traits from hidden JSON if present (modal), then overlay simple fields
    let traits = {};
    const traitsInput = document.getElementById('petTraitsJson');
    if (traitsInput && traitsInput.value) {
      try { traits = JSON.parse(traitsInput.value) || {}; } catch { traits = {}; }
    }
    const weightStr = fd.get('weight') || '';
    const weightNum = weightStr === '' ? null : Number(weightStr);
    if (weightNum !== null && Number.isFinite(weightNum)) traits.weightLb = weightNum;

    const likesArr = parseCSV(fd.get('likes'));
    if (likesArr.length) traits.flavors = likesArr;

    const allergiesArr = parseCSV(fd.get('allergies'));
    if (allergiesArr.length) traits.allergies = allergiesArr;

    if (Object.keys(traits).length) payload.traits = traits;

    try {
      const r = await fetch(`/api/pets/${encodeURIComponent(pet.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json().catch(() => ({}));
      const updated = data.pet || null;
      toast('Saved.');
      // Update local cache & UI from authoritative row
      const idx = pets.findIndex(p => String(p.id) === String(pet.id));
      if (updated && idx >= 0) pets[idx] = updated;
      renderPetList();
      if (updated) selectPet(updated.id);
    } catch (err) {
      console.warn('[acct-pets] save failed:', err);
      alert('Could not save profile. Please try again.');
    }
  });

  btnDel.addEventListener('click', async () => {
    if (!confirm('Delete this pet?')) return;
    try {
      const r = await fetch(`/api/pets/${encodeURIComponent(pet.id)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      pets = pets.filter(p => String(p.id) !== String(pet.id));
      if (pets.length) {
        selectPet(pets[0].id);
      } else {
        renderPetList();
        elDetail.innerHTML = '';
      }
    } catch (err) {
      console.warn('[acct-pets] delete failed:', err);
      alert('Could not delete pet. Please try again.');
    }
  });
}

/* -----------------------------
   Journal
------------------------------ */
function journalListHTML(items) {
  if (!Array.isArray(items) || !items.length) {
    return `<div class="text-muted">No entries yet.</div>`;
  }
  return items.map(e => `
    <div class="pp-journal-entry">
      <div class="small text-muted">${new Date(e.createdAt).toLocaleString()}</div>
      <div>${escapeHtml(e.text || '')}</div>
    </div>`).join('');
}

function wireJournalForm(pet) {
  const form = document.getElementById('pp-journal-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = { text: String(fd.get('text') || '').trim() };
    if (!payload.text) return;
    try {
      const r = await fetch(`/api/pets/${encodeURIComponent(pet.id)}/journal`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json().catch(() => ({}));
      const entry = data?.entry;
      const list = document.getElementById('pp-journal-list');
      if (entry && list) {
        list.insertAdjacentHTML('afterbegin', `
          <div class="pp-journal-entry">
            <div class="small text-muted">${new Date(entry.createdAt).toLocaleString()}</div>
            <div>${escapeHtml(entry.text || '')}</div>
          </div>`);
      }
      form.reset();
    } catch (err) {
      console.warn('[acct-pets] journal add failed:', err);
      alert('Could not add journal entry. Please try again.');
    }
  });
}

/* -----------------------------
   Subscriptions (read-only)
------------------------------ */
async function loadSubscriptions(id) {
  const r = await fetch(`/api/pets/${encodeURIComponent(id)}/recs`, { credentials: 'include' });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return Array.isArray(j) ? j : (Array.isArray(j?.items) ? j.items : []);
}

function subsListHTML(items) {
  if (!Array.isArray(items) || !items.length) {
    return `<div class="text-muted">No recommendations yet.</div>`;
  }
  return items.map(i => `
    <div class="card mb-2">
      <div class="card-body d-flex align-items-center justify-content-between">
        <div class="me-2">
          <div class="fw-semibold">${escapeHtml(i.title || '')}</div>
          <div class="small text-muted">${escapeHtml(i.reason || '')}</div>
        </div>
        <a class="btn btn-sm btn-outline-primary" href="${escapeHtml(i.url || '#')}">View</a>
      </div>
    </div>`).join('');
}

/* -----------------------------
   Shop bridge
------------------------------ */
function wireShopBridge(pet) {
  const btn = document.getElementById('pp-shop');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const species = String(pet.species || '').toLowerCase();
    const flavors = Array.isArray(pet.traits?.flavors) ? pet.traits.flavors : [];
    const q = encodeURIComponent(flavors.join(', '));
    const speciesCat = species || 'pet';
    location.href = `/shop.html?mypets=1&pet=${speciesCat}&q=${q}`;
  });
}

/* -----------------------------
   Helpers
------------------------------ */
function renderSignInCallout() {
  elList.innerHTML = `
    <div class="alert alert-light border">
      <strong>Sign in to manage your pets.</strong>
    </div>`;
  elDetail.innerHTML = '';
}

function renderError(msg) {
  elList.innerHTML = `<div class="alert alert-warning">${escapeHtml(msg || 'Something went wrong.')}</div>`;
  elDetail.innerHTML = '';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function toast(msg) {
  // Minimal inline toast
  const n = document.createElement('div');
  n.className = 'toast align-items-center text-bg-dark border-0 show position-fixed bottom-0 end-0 m-3';
  n.style.zIndex = 1080;
  n.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${escapeHtml(msg || '')}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>`;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 1500);
}

function wireAddPet() {
  if (!btnAdd) return;
  btnAdd.addEventListener('click', async () => {
    const name = prompt('Pet name?');
    if (!name) return;
    try {
      const r = await fetch('/api/pets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const newPet = j?.pet || null;
      if (newPet) {
        pets.unshift(newPet);
        renderPetList();
        selectPet(newPet.id);
      } else {
        await refreshPets();
      }
    } catch (e) {
      alert('Could not add pet. Please try again.');
    }
  });
}
