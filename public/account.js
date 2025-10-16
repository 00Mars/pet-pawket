// public/account.js — Account page wiring for Pets (list, add, edit, delete, journal)
// Node 20 / ESM client script; vanilla JS; Shopify cookie auth via credentials:'include'.

import { PetsBus } from '/petsEvents.js';

console.info('[account.js] pets v2+traits-save+avatar-fixes');
// Emit init so listeners (e.g., For My Pets pane) can boot deterministically
try { PetsBus.emit('pets:init', { when: Date.now() }); } catch { /* noop */ }

//
// -------------------------------
// Utilities
// -------------------------------
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function show(el) { el?.classList?.remove('d-none', 'hidden'); }
function hide(el) { el?.classList?.add('d-none'); }
/* Focus helpers + improved open/close */
let __activeModalId = null;
let __lastFocus = null;

function __getFocusable(root) {
  const sel = [
    'a[href]','button:not([disabled])','input:not([disabled])','select:not([disabled])',
    'textarea:not([disabled])','[tabindex]:not([tabindex="-1"])'
  ].join(',');
  return [...root.querySelectorAll(sel)].filter(el => {
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  });
}
function __trapKeydown(e) {
  const m = document.getElementById(__activeModalId);
  if (!m) return;
  if (e.key === 'Escape') { closeModal(__activeModalId); return; }
  if (e.key !== 'Tab') return;
  const f = __getFocusable(m);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
}

function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  __activeModalId = id;
  __lastFocus = document.activeElement;
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const content = m.querySelector('[data-modal-content]') || m.querySelector('.modal-content');
  if (content) content.setAttribute('tabindex', '-1');
  (content || m).focus();
  m.addEventListener('keydown', __trapKeydown, { passive: false });
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  m.removeEventListener('keydown', __trapKeydown);
  queueMicrotask(() => { try { __lastFocus?.focus(); } catch {} });
  __activeModalId = null;
}

// Close when clicking the dim overlay (outside .modal-content)
document.addEventListener('click', (e) => {
  const m = e.target.closest('.custom-modal');
  if (!m) return;
  const content = m.querySelector('.modal-content');
  if (content && !content.contains(e.target) && !e.target.closest('[data-action]')) {
    closeModal(m.id);
  }
});

//
// -------------------------------
// Session + gated content toggle
// -------------------------------
async function loadSession() {
  const res = await fetch('/api/session', { credentials: 'include' });
  if (!res.ok) {
    toggleAuthUI(false);
    return { signedIn: false };
  }
  const data = await res.json();
  toggleAuthUI(!!data?.signedIn, data?.email);
  return data;
}

function toggleAuthUI(signedIn, email = '') {
  const signedOut = document.querySelector('[data-auth="signed-out"]');
  const signedInEl = document.querySelector('[data-auth="signed-in"]');
  const gated = document.querySelector('[data-auth-visible="signed-in"]');
  if (signedIn) {
    hide(signedOut); show(signedInEl); show(gated);
    const ue = document.getElementById('userEmail'); if (ue) ue.textContent = email || '';
  } else {
    show(signedOut); hide(signedInEl); hide(gated);
  }
}

document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) {
    const id = closer.getAttribute('data-close');
    if (id) closeModal(id);
  }
});

//
// -------------------------------
// Pets — list, add, edit, delete
// -------------------------------
let PETS = [];                     // latest cache from GET /api/pets
let CURRENT_PET_ID = null;
let CURRENT_PET_SNAPSHOT = null;   // used to compute minimal diff
let CURRENT_AVATAR_DATAURL = null; // set when user picks an avatar file

// Ensure For-My-Pets pane shell is always visible (content visibility is controlled by bridge)
(function ensureMyPetsPaneShell() {
  const PANE = document.getElementById('myPetsPane');
  if (PANE) { PANE.classList.remove('d-none','hidden'); PANE.hidden = false; }
})();

async function loadPets() {
  const list = $('#petList');
  if (!list) return;
  list.innerHTML = `<div class="text-muted">Loading pets…</div>`;
  try {
    const res = await fetch('/api/pets', { credentials: 'include' });
    const data = await res.json().catch(() => ([]));
    if (!res.ok) throw new Error('Pets fetch failed');
    // API might return array or {pets:[...]}
    PETS = Array.isArray(data) ? data : (data.pets || []);
    renderPets(PETS);
    // Bus notifications for dependent panes (For My Pets, etc.)
    try {
      PetsBus.emit('pets:list:loaded', PETS);
      PetsBus.emit('pets:changed', PETS);
    } catch {}
  } catch (err) {
    list.innerHTML = `<div class="text-danger">Failed to load pets</div>`;
  }
}

function renderPets(pets) {
  const list = $('#petList');
  if (!list) return;
  if (!Array.isArray(pets) || pets.length === 0) {
    list.innerHTML = `<div class="text-muted">No pets yet. Add your first friend below.</div>`;
    return;
  }

  list.innerHTML = pets.map(p => {
    const name    = escapeHtml(p.name);
    const species = escapeHtml(p.species || '');
    const breed   = escapeHtml(p.breed || '');
    const bday    = p.birthday ? escapeHtml(String(p.birthday).slice(0,10)) : '';
    const avatar  = p.avatar || '/assets/images/default-pet.png';

    return `
      <div class="card shadow-sm mb-3" data-pet-id="${p.id}">
        <div class="card-body d-flex gap-3 align-items-center">
          <img class="pet-thumb rounded border"
               src="${avatar}" alt="${name}"
               style="width:72px;height:72px;object-fit:cover;" />
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5 class="card-title mb-1">${name} ${species ? `<small class="text-muted">(${species})</small>` : ''}</h5>
                <div class="text-muted small">
                  ${breed ? `Breed: ${breed} • ` : ''}${bday ? `Birthday: ${bday}` : ''}
                </div>
                <div class="small">
                  Sex: <span>${escapeHtml(p.sex ?? 'Unknown')}</span> • Fixed: <span>${p.spayedNeutered === true ? 'Yes' : p.spayedNeutered === false ? 'No' : 'Unknown'}</span>
                </div>
              </div>
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary" data-action="open-journal" data-pet-id="${p.id}">
                  <i class="bi bi-journals"></i> Journal
                </button>
                <button class="btn btn-outline-primary" data-action="open-edit" data-pet-id="${p.id}">
                  <i class="bi bi-pencil"></i> Edit
                </button>
                <button class="btn btn-outline-danger" data-action="delete-pet" data-pet-id="${p.id}">
                  <i class="bi bi-trash"></i> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// Reusable: file -> dataURL with 5MB guard
async function readFileAsDataURL(file) {
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) {
    alert('Please select a photo 5MB or smaller.');
    return null;
  }
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// Add Pet form
const addPetForm = document.getElementById('addPetForm');
if (addPetForm) {
  addPetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name    = document.getElementById('newPetName')?.value?.trim() || '';
    const species = document.getElementById('newPetType')?.value?.trim() || '';
    const birthday= document.getElementById('newPetBirthday')?.value || null;
    if (!name || !species) return;

    const res = await fetch('/api/pets', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, species, birthday }),
    });
    if (!res.ok) {
      console.error('Add pet failed');
      return;
    }
    addPetForm.reset();
    try {
      PetsBus.emit('pet:created', { temp: true, name, species, birthday });
      PetsBus.emit('pets:refresh:request');
    } catch {}
    await loadPets();
  });
}

// Delegated actions: open edit, delete, open journal
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  const petId  = btn.getAttribute('data-pet-id');

  if (action === 'open-edit')    openEditModal(petId);
  if (action === 'delete-pet')  await deletePet(petId);
  if (action === 'open-journal') openJournalModal(petId);
});

async function deletePet(petId) {
  if (!petId) return;
  if (!confirm('Delete this pet? This cannot be undone.')) return;
  const res = await fetch(`/api/pets/${petId}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    console.error('Delete failed');
    return;
  }
  try { PetsBus.emit('pet:deleted', { id: petId }); } catch {}
  await loadPets();
}

//
// --------- Traits helpers (always include + normalize to top-level) ---------
function getHiddenTraits() {
  const input = document.getElementById('petTraitsJson');
  if (!input) return {};
  const raw = input.value ?? '';
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

function normalizeTraitsToTopLevel(traits = {}) {
  const patch = {};
  // sex: "female" | "male" | "unknown" -> DB expects lower-case or null
  if (typeof traits.sex === 'string') {
    const s = traits.sex.trim().toLowerCase();
    if (s === 'female' || s === 'male') patch.sex = s;
    else if (s === 'unknown' || s === '') patch.sex = null;
  }
  // spayNeuter enum -> boolean/null
  if (traits.spayNeuter !== undefined && traits.spayNeuter !== null) {
    const v = String(traits.spayNeuter).trim().toLowerCase();
    if (['spayed','neutered','fixed','true','yes','y','1'].includes(v)) patch.spayedNeutered = true;
    else if (['intact','false','no','n','0'].includes(v)) patch.spayedNeutered = false;
    else if (v === 'unknown' || v === '') patch.spayedNeutered = null;
  }
  return patch;
}

// Build minimal patch from edit form fields compared to snapshot
function buildPetPatchFromForm() {
  const name   = (document.getElementById('editPetName')?.value ?? '').trim();
  const type   = (document.getElementById('editPetType')?.value ?? '').trim();
  const breed  = (document.getElementById('editPetBreed')?.value ?? '').trim();
  const bday   = (document.getElementById('editPetBirthday')?.value ?? '');

  const snap = CURRENT_PET_SNAPSHOT || {};
  const patch = {};
  if (name   && name   !== snap.name)          patch.name    = name;
  if (type) {
    const typeNorm = String(type).toLowerCase();
    const snapNorm = String(snap.species || '').toLowerCase();
    if (typeNorm !== snapNorm) patch.species = type; // send user’s selected value
  }
  if (breed  && breed  !== (snap.breed || '')) patch.breed   = breed;

  const normSnapBday = snap.birthday ? String(snap.birthday).slice(0,10) : '';
  if (bday && bday !== normSnapBday)           patch.birthday= bday;

  // Always include traits (even empty object), then normalize into top-level
  const traits = getHiddenTraits();
  patch.traits = traits;
  Object.assign(patch, normalizeTraitsToTopLevel(traits));

  return patch;
}

//
// -------------------------------
// Edit Pet Modal
// -------------------------------
const editForm = document.getElementById('editPetForm');

function setSelectValueCaseInsensitive(selectEl, raw) {
  if (!selectEl) return;
  const v = String(raw ?? '').trim();
  if (!v) { selectEl.value = ''; return; }
  const opts = Array.from(selectEl.options || []);
  const hit = opts.find(o =>
    String(o.value).toLowerCase() === v.toLowerCase() ||
    String(o.text).toLowerCase()  === v.toLowerCase()
  );
  selectEl.value = hit ? hit.value : '';
}

function hydrateTraitChipsFromPet(pet) {
  const traits = { ...(pet?.traits || {}) };

  // Fill from top-level fields when traits don’t include them
  if (!traits.sex && pet?.sex) traits.sex = pet.sex;
  if (traits.spayNeuter == null) {
    if (pet?.spayedNeutered === true) {
      traits.spayNeuter = pet?.sex === 'male' ? 'neutered' : 'spayed';
    } else if (pet?.spayedNeutered === false) {
      traits.spayNeuter = 'intact';
    } else {
      traits.spayNeuter = 'unknown';
    }
  }

  // Apply to chip UI
  const modal = document.getElementById('editPetModal');
  if (!modal) return;

  modal.querySelectorAll('.trait-chips[data-trait]').forEach(group => {
    const key   = group.getAttribute('data-trait');
    const multi = group.getAttribute('data-multi') === 'true';
    const val   = traits[key];

    const btns = Array.from(group.querySelectorAll('.trait-chip'));
    if (multi) {
      const set = new Set((Array.isArray(val) ? val : []).map(s => String(s).toLowerCase()));
      btns.forEach(b => b.setAttribute('aria-pressed', set.has(String(b.dataset.value).toLowerCase()) ? 'true' : 'false'));
    } else {
      const chosen = val == null ? 'unknown' : String(val).toLowerCase();
      btns.forEach(b => b.setAttribute('aria-pressed',
        String(b.dataset.value).toLowerCase() === chosen ? 'true' : 'false'
      ));
    }
  });

  // Keep the hidden JSON in sync so submit picks it up
  const hidden = document.getElementById('petTraitsJson');
  if (hidden) hidden.value = JSON.stringify(traits);
}

function openEditModal(petId) {
  CURRENT_PET_ID = petId;
  CURRENT_AVATAR_DATAURL = null;

  const pet = PETS.find(p => String(p.id) === String(petId));
  if (!pet) return;

  CURRENT_PET_SNAPSHOT = { ...pet };

  const nameEl  = document.getElementById('editPetName');
  const typeEl  = document.getElementById('editPetType');
  const breedEl = document.getElementById('editPetBreed');
  const bdayEl  = document.getElementById('editPetBirthday');
  const preview = document.getElementById('avatarPreview');

  if (nameEl)  nameEl.value  = pet.name ?? '';
  if (typeEl)  setSelectValueCaseInsensitive(typeEl, pet.species);
  if (breedEl) breedEl.value = pet.breed ?? '';
  if (bdayEl)  bdayEl.value  = pet.birthday ? String(pet.birthday).slice(0,10) : '';
  if (preview) preview.src   = pet.avatar || '/assets/images/default-pet.png';

  // Hydrate trait chips and hidden JSON BEFORE opening so the enhancer won’t reset them
  hydrateTraitChipsFromPet(pet);

  openModal('editPetModal');
}

if (editForm) {
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!CURRENT_PET_ID) return;

    // Build a minimal patch; includes traits + normalized top-level fields
    const patch = buildPetPatchFromForm();

    // Always send PATCH so trait-only changes persist (even if only 'traits' changed)
    try {
      const res = await fetch(`/api/pets/${encodeURIComponent(CURRENT_PET_ID)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        console.error('Update failed', await res.text());
        alert('Could not save profile. Please try again.');
        return;
      }
      try { PetsBus.emit('pet:updated', { id: CURRENT_PET_ID, patch }); } catch {}
    } catch (err) {
      console.warn('[account.js] save failed:', err);
      alert('Could not save profile. Please try again.');
      return;
    }

    // Optional avatar upload if changed
    if (CURRENT_AVATAR_DATAURL) {
      const res2 = await fetch(`/api/pets/${encodeURIComponent(CURRENT_PET_ID)}/avatar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: CURRENT_AVATAR_DATAURL }),
      });
      if (!res2.ok) {
        console.error('Avatar upload failed', await res2.text());
        // continue anyway
      }
      CURRENT_AVATAR_DATAURL = null;
    }

    closeModal('editPetModal');
    await loadPets(); // rebind from server truth
  });
}

//
// -------------------------------
// Avatar helpers + handlers (robust remove + click-to-remove/replace)
// -------------------------------
function updateAvatarPreview(src) {
  const preview = document.getElementById('avatarPreview');
  if (preview) preview.src = src || '/assets/images/default-pet.png';
}

/**
 * Try multiple server patterns so removal works regardless of backend route:
 * 1) POST /api/pets/:id/avatar  { remove:true }
 * 2) DELETE /api/pets/:id/avatar
 * 3) PATCH /api/pets/:id        { avatar:null, avatarUrl:null }
 */
async function removePetAvatar(petId) {
  if (!petId) return { ok: false, tried: [] };
  const tried = [];

  // 1) POST remove:true
  try {
    tried.push('POST /api/pets/:id/avatar {remove:true}');
    const r1 = await fetch(`/api/pets/${encodeURIComponent(petId)}/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remove: true }),
    });
    if (r1.ok) return { ok: true, via: tried[tried.length - 1] };
  } catch {}

  // 2) DELETE avatar endpoint
  try {
    tried.push('DELETE /api/pets/:id/avatar');
    const r2 = await fetch(`/api/pets/${encodeURIComponent(petId)}/avatar`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (r2.ok) return { ok: true, via: tried[tried.length - 1] };
  } catch {}

  // 3) PATCH avatar null (common fallback)
  try {
    tried.push('PATCH /api/pets/:id {avatar:null, avatarUrl:null}');
    const r3 = await fetch(`/api/pets/${encodeURIComponent(petId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: null, avatarUrl: null }),
    });
    if (r3.ok) return { ok: true, via: tried[tried.length - 1] };
  } catch {}

  return { ok: false, tried };
}

// Avatar file selection → preview & stage upload (no default submit)
document.getElementById('editPetAvatar')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('Please choose an image 5MB or smaller.');
    e.target.value = '';
    return;
  }
  const dataUrl = await readFileAsDataURL(file);
  if (!dataUrl) return;
  CURRENT_AVATAR_DATAURL = dataUrl;
  updateAvatarPreview(CURRENT_AVATAR_DATAURL);
});

// Click the avatar → confirm remove; if cancelled, open picker to replace
document.getElementById('avatarPreview')?.addEventListener('click', async () => {
  if (!CURRENT_PET_ID) return;
  const confirmed = confirm('Remove this pet photo?\n\nOK: remove photo\nCancel: pick a new photo');
  if (confirmed) {
    const { ok } = await removePetAvatar(CURRENT_PET_ID);
    if (!ok) {
      alert('Sorry—could not remove the photo. Please try again.');
      return;
    }
    CURRENT_AVATAR_DATAURL = null;
    updateAvatarPreview('/assets/images/default-pet.png');
    try { await loadPets(); } catch {}
  } else {
    // choose a replacement
    document.getElementById('editPetAvatar')?.click();
  }
});

// Keep the old button wired too (in case you show it later via CSS)
document.getElementById('removeAvatarBtn')?.addEventListener('click', async () => {
  if (!CURRENT_PET_ID) return;
  const confirmed = confirm('Remove this pet photo?');
  if (!confirmed) return;
  const { ok } = await removePetAvatar(CURRENT_PET_ID);
  if (!ok) {
    alert('Sorry—could not remove the photo. Please try again.');
    return;
  }
  CURRENT_AVATAR_DATAURL = null;
  updateAvatarPreview('/assets/images/default-pet.png');
  try { await loadPets(); } catch {}
});

//
// -------------------------------
// Pet Journal Modal (mood, tags, photo)
// -------------------------------
function openJournalModal(petId) {
  CURRENT_PET_ID = petId;

  const idxEl   = document.getElementById('journalPetIndex');
  const noteEl  = document.getElementById('newJournalNote');
  const tagsEl  = document.getElementById('journalTags');
  const moodEl  = document.getElementById('journalMood');
  const photoEl = document.getElementById('journalPhoto');

  if (idxEl)  idxEl.value  = petId;
  if (noteEl) noteEl.value = '';
  if (tagsEl) tagsEl.value = '';
  if (moodEl)  moodEl.value = 'Happy';
  if (photoEl) photoEl.value = '';

  openModal('journal-modal');
  loadPetJournal(petId).catch(err => console.error('loadPetJournal', err));
}

async function loadPetJournal(petId) {
  const list = document.getElementById('journalEntryList');
  const empty = document.getElementById('journalEmpty');
  if (!list) return;

  list.innerHTML = `<div class="text-muted small">Loading…</div>`;
  empty && (empty.style.display = 'none');

  try {
    const res = await fetch(`/api/pets/${petId}/journal`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load journal');
    const entries = await res.json();

    if (!entries || entries.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }

    const html = entries.map(e => {
      const when = e.createdAt ? new Date(e.createdAt).toLocaleString() : '';
      const moodBadge = e.mood ? `<span class="badge bg-info-subtle text-info-emphasis journal-mood">${escapeHtml(e.mood)}</span>` : '';
      const tagsBadges = Array.isArray(e.tags) && e.tags.length
        ? e.tags.map(t => `<span class="badge bg-secondary-subtle text-secondary-emphasis me-1">#${escapeHtml(t)}</span>`).join('')
        : '';
      const photo = e.photo
        ? `<div class="mt-2">
             <img src="${escapeHtml(e.photo)}" alt="photo" style="max-width:100%;height:auto;max-height:220px;object-fit:cover;" />
             <div class="mt-1"><button class="btn btn-sm btn-outline-warning" data-action="remove-photo">Remove Photo</button></div>
           </div>`
        : '';

      return `
        <li class="border rounded p-2 mb-2" data-entry-id="${escapeHtml(e.id)}">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <div class="small text-muted">${when}</div>
              <div class="mb-1">
                ${moodBadge}
                ${tagsBadges ? `<span class="journal-tags ms-1">${tagsBadges}</span>` : ''}
              </div>
            </div>
            <div class="ms-2">
              <button class="btn btn-sm btn-outline-secondary me-1" data-action="edit-journal">Edit</button>
              <button class="btn btn-sm btn-outline-danger" data-action="delete-journal">Delete</button>
            </div>
          </div>
          <div class="journal-text mt-1">${escapeHtml(e.text || '')}</div>
          ${photo}
        </li>`;
    }).join('');

    list.innerHTML = html;
    if (empty) empty.style.display = 'none';
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="text-danger small">Failed to load.</div>`;
  }
}

const journalListEl = document.getElementById('journalEntryList');
if (journalListEl) {
  journalListEl.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const li = btn.closest('li[data-entry-id]');
    if (!li || !CURRENT_PET_ID) return;

    const entryId = li.getAttribute('data-entry-id');
    const action = btn.getAttribute('data-action');

    if (action === 'delete-journal') {
      if (!confirm('Delete this journal entry?')) return;
      const res = await fetch(`/api/pets/${CURRENT_PET_ID}/journal/${entryId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        console.error('Delete failed', await res.text());
        return;
      }
      loadPetJournal(CURRENT_PET_ID).catch(() => {});
      return;
    }

    if (action === 'remove-photo') {
      const res = await fetch(`/api/pets/${CURRENT_PET_ID}/journal/${entryId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removePhoto: true }),
      });
      if (!res.ok) {
        console.error('Remove photo failed', await res.text());
        return;
      }
      loadPetJournal(CURRENT_PET_ID).catch(() => {});
      return;
    }

    if (action === 'edit-journal') {
      const textEl  = li.querySelector('.journal-text');
      const moodEl  = li.querySelector('.journal-mood');
      const tagsWrap = li.querySelector('.journal-tags');

      const currentText = textEl ? textEl.textContent : '';
      const currentMood = moodEl ? moodEl.textContent.trim() : '';
      const currentTags = tagsWrap ? [...tagsWrap.querySelectorAll('.badge')].map(b => b.textContent.replace(/^#/, '').trim()) : [];

      const newText = prompt('Edit note text:', currentText ?? '');
      if (newText === null) return;
      const newMood = prompt('Edit mood (optional):', currentMood ?? '');
      if (newMood === null) return;
      const newTags = prompt('Edit tags (comma-separated):', currentTags.join(','));
      if (newTags === null) return;

      const patch = { text: newText, mood: newMood || null, tags: newTags };
      const res = await fetch(`/api/pets/${CURRENT_PET_ID}/journal/${entryId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        console.error('Edit failed', await res.text());
        return;
      }
      loadPetJournal(CURRENT_PET_ID).catch(() => {});
      return;
    }
  });
}

const addJournalBtn = document.getElementById('addJournalEntryBtn');
if (addJournalBtn) {
  addJournalBtn.addEventListener('click', async () => {
    if (!CURRENT_PET_ID) return;

    const noteEl  = document.getElementById('newJournalNote');
    const tagsEl  = document.getElementById('journalTags');
    const moodEl  = document.getElementById('journalMood');
    const photoEl = document.getElementById('journalPhoto');

    const text  = noteEl ? noteEl.value.trim() : '';
    if (!text) return;

    const tags = tagsEl ? tagsEl.value : '';
    const mood = moodEl ? moodEl.value : null;
    const file = photoEl?.files?.[0] || null;
    const photoDataUrl = file ? await readFileAsDataURL(file) : null;

    const res = await fetch(`/api/pets/${CURRENT_PET_ID}/journal`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mood, tags, photoDataUrl }),
    });
    if (!res.ok) {
      console.error('Add entry failed', await res.text());
      return;
    }
    if (noteEl)  noteEl.value = '';
    if (tagsEl)  tagsEl.value = '';
    if (moodEl)  moodEl.value = 'Happy';
    if (photoEl) photoEl.value = '';
    loadPetJournal(CURRENT_PET_ID).catch(() => {});
  });
}

//
// -------------------------------
// Profile + Orders (existing sections)
// -------------------------------
async function loadProfile() {
  try {
    const res = await fetch('/api/account/profile', { credentials: 'include' });
    if (!res.ok) return;
    const p = await res.json();
    $('#profileFirstName') && ($('#profileFirstName').value = p.firstName || '');
    $('#profileLastName')  && ($('#profileLastName').value  = p.lastName || '');
    $('#profileEmail')     && ($('#profileEmail').value     = p.email || '');
  } catch { /* noop */ }
}

// ✅ Wire the Profile form so "Save Changes" actually persists
function wireProfileForm() {
  const form = document.getElementById('profileForm');
  if (!form || form.dataset.wired === '1') return;
  form.dataset.wired = '1';

  const status = document.getElementById('profileStatus');
  const first  = document.getElementById('profileFirstName');
  const last   = document.getElementById('profileLastName');

  async function saveProfile(body) {
    // Prefer POST /update-info if present; otherwise PATCH the base endpoint.
    const tryPost = await fetch('/api/account/profile/update-info', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (tryPost.ok) return tryPost.json().catch(() => ({}));
    if (tryPost.status !== 404 && tryPost.status !== 405) {
      const t = await tryPost.text().catch(() => '');
      throw new Error(`Save failed (${tryPost.status}) ${t}`);
    }
    // Fallback
    const fallback = await fetch('/api/account/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!fallback.ok) {
      const t = await fallback.text().catch(() => '');
      throw new Error(`Save failed (${fallback.status}) ${t}`);
    }
    return fallback.json().catch(() => ({}));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    if (status) { status.className = 'alert alert-info mt-3'; status.style.display = 'block'; status.textContent = 'Saving…'; }
    try {
      const payload = {
        firstName: first?.value?.trim() || '',
        lastName:  last?.value?.trim()  || '',
      };
      await saveProfile(payload);
      if (status) { status.className = 'alert alert-success mt-3'; status.textContent = 'Saved!'; }
      await loadProfile().catch(() => {});
    } catch (err) {
      console.error('[profile save]', err);
      if (status) { status.className = 'alert alert-danger mt-3'; status.textContent = 'Save failed.'; }
    } finally {
      if (btn) btn.disabled = false;
      setTimeout(() => { if (status) status.style.display = 'none'; }, 1500);
    }
  });
}

async function loadOrders() {
  const container = document.getElementById('orderHistory');
  if (!container) return;
  container.innerHTML = `<div class="spinner-border text-info" role="status"><span class="visually-hidden">Loading...</span></div>`;
  try {
    const res = await fetch('/api/orders', { credentials: 'include' });
    if (!res.ok) throw new Error('Orders load failed');
    const orders = await res.json();
    container.innerHTML = Array.isArray(orders) && orders.length
      ? orders.map(o => {
          const when   = o.processedAt ? new Date(o.processedAt).toLocaleString() : '';
          const amount = o.totalPriceV2?.amount ?? '';
          const cur    = o.totalPriceV2?.currencyCode ?? '';
          const items  = (o.lineItems?.edges || []).map(e => `<li>${escapeHtml(e.node.title)} × ${e.node.quantity}</li>`).join('');
          return `
            <div class="card mb-3"><div class="card-body">
              <div class="d-flex justify-content-between">
                <div>
                  <div class="fw-semibold">Order #${o.orderNumber ?? o.name ?? ''}</div>
                  <div class="text-muted small">${when}</div>
                </div>
                <div class="text-end">
                  <div class="fw-semibold">${amount} ${cur}</div>
                  ${o.statusUrl ? `<a class="small" href="${o.statusUrl}" target="_blank" rel="noopener">Status</a>`:''}
                </div>
              </div>
              <ul class="mt-2 mb-0 small">${items}</ul>
            </div></div>`;
        }).join('')
      : `<div class="text-muted">No recent orders</div>`;
  } catch {
    container.innerHTML = `<div class="text-danger">Failed to load orders</div>`;
  }
}

//
// -------------------------------
// Address Book
// -------------------------------
async function loadAddresses() {
  const list = document.getElementById('addressList');
  if (!list) return;
  list.innerHTML = `<div class="text-muted small">Loading…</div>`;
  try {
    const res = await fetch('/api/addresses', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load addresses');
    const rows = await res.json();

    if (!rows || rows.length === 0) {
      list.innerHTML = `<div class="text-muted small">No addresses yet.</div>`;
      return;
    }

    const html = rows.map(a => {
      const badges = [
        a.isDefaultShipping ? `<span class="badge bg-info-subtle text-info-emphasis me-1">Default Shipping</span>` : '',
        a.isDefaultBilling  ? `<span class="badge bg-success-subtle text-success-emphasis me-1">Default Billing</span>`  : '',
      ].join('');
      const nameLine = [a.name, a.phone].filter(Boolean).join(' · ');
      const addrLines = [
        a.address1,
        a.address2,
        `${a.city}, ${a.state} ${a.postalCode}`,
        a.country
      ].filter(Boolean).map(escapeHtml).join('<br/>');

      return `
        <li class="border rounded p-2 mb-2" data-address-id="${escapeHtml(a.id)}">
          <div class="d-flex justify-content-between alignments-start">
            <div class="me-2">
              <div class="fw-semibold">${escapeHtml(a.label || 'Address')}</div>
              <div class="small text-muted">${escapeHtml(nameLine)}</div>
              <div class="mt-1">${badges}</div>
            </div>
            <div class="text-end">
              <button class="btn btn-sm btn-outline-secondary me-1" data-action="edit-address">Edit</button>
              <button class="btn btn-sm btn-outline-danger" data-action="delete-address">Delete</button><br/>
              <button class="btn btn-sm btn-outline-primary mt-1" data-action="set-default-ship">Make Default Ship</button>
              <button class="btn btn-sm btn-outline-success mt-1 ms-1" data-action="set-default-bill">Make Default Bill</button>
            </div>
          </div>
          <div class="mt-2 small">${addrLines}</div>
        </li>`;
    }).join('');

    list.innerHTML = html;
  } catch (e) {
    console.error(e);
    list.innerHTML = `<div class="text-danger small">Failed to load addresses.</div>`;
  }
}

// ---- Address Book: mount hooks without touching HTML ----
function ensureAddressSection() {
  // If hooks already exist, don't create duplicates
  if (document.getElementById('addressList') &&
      document.getElementById('addressAddBtn') &&
      document.getElementById('account-addresses')) {
    return true;
  }

  // Create the section markup
  const section = document.createElement('section');
  section.id = 'account-addresses';
  section.className = 'mt-4';
  section.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h3 class="h5 m-0">Address Book</h3>
      <button id="addressAddBtn" class="btn btn-sm btn-primary">Add Address</button>
    </div>
    <ul id="addressList" class="list-unstyled m-0 p-0"></ul>
  `;

  // Preferred anchors in your existing Account page (first one found wins)
  const anchors = [
    document.getElementById('account-journal'),
    document.getElementById('account-pets'),
    (function () {
      const o = document.getElementById('ordersContainer');
      if (o) {
        return o.closest('section') || o;
      }
      return null;
    })(),
    document.getElementById('accountRoot'),
    document.querySelector('main .container'),
    document.querySelector('main'),
  ].filter(Boolean);

  // Insert after the first anchor; otherwise append to body (last resort)
  const anchor = anchors[0] || document.body;
  if (anchor.insertAdjacentElement) {
    anchor.insertAdjacentElement('afterend', section);
  } else if (anchor.parentNode) {
    anchor.parentNode.insertBefore(section, anchor.nextSibling);
  } else {
    document.body.appendChild(section);
  }
  return true;
}

// Wire address UI once (after ensureAddressSection())
function wireAddressUI() {
  const listEl = document.getElementById('addressList');
  if (listEl && !listEl.__wiredAddressActions) {
    listEl.__wiredAddressActions = true;
    listEl.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('button[data-action]');
      if (!btn) return;
      const li = btn.closest('li[data-address-id]');
      const id = li?.getAttribute('data-address-id');
      const action = btn.getAttribute('data-action');

      if (action === 'delete-address') {
        if (!confirm('Delete this address?')) return;
        const res = await fetch(`/api/addresses/${id}`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) { console.error('Delete failed', await res.text()); return; }
        loadAddresses();
        return;
      }

      if (action === 'set-default-ship') {
        const res = await fetch(`/api/addresses/${id}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isDefaultShipping: true })
        });
        if (!res.ok) { console.error('Set default ship failed', await res.text()); return; }
        loadAddresses();
        return;
      }

      if (action === 'set-default-bill') {
        const res = await fetch(`/api/addresses/${id}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isDefaultBilling: true })
        });
        if (!res.ok) { console.error('Set default bill failed', await res.text()); return; }
        loadAddresses();
        return;
      }

      if (action === 'edit-address') {
        const data = await promptNewAddress({});
        if (!data) return;
        const res = await fetch(`/api/addresses/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) { console.error('Edit failed', await res.text()); return; }
        loadAddresses();
        return;
      }
    });
  }

  const addBtn = document.getElementById('addressAddBtn');
  if (addBtn && !addBtn.__wiredAddressAdd) {
    addBtn.__wiredAddressAdd = true;
    addBtn.addEventListener('click', async () => {
      const data = await promptNewAddress();
      if (!data) return;
      const makeDefault = confirm('Make this your default shipping address?');
      const makeDefaultBill = confirm('Make this your default billing address?');
      data.isDefaultShipping = !!makeDefault;
      data.isDefaultBilling  = !!makeDefaultBill;

      const res = await fetch('/api/addresses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) { console.error('Create failed', await res.text()); return; }
      loadAddresses();
    });
  }
}

async function promptNewAddress(initial = {}) {
  const label = prompt('Label (e.g., Home, Work):', initial.label ?? '') ?? null;
  const name  = prompt('Recipient name:', initial.name ?? '') ?? null;
  const phone = prompt('Phone:', initial.phone ?? '') ?? null;
  const address1 = prompt('Address line 1:', initial.address1 ?? '');
  if (address1 === null || !address1.trim()) return null;
  const address2 = prompt('Address line 2 (optional):', initial.address2 ?? '') ?? null;
  const city     = prompt('City:', initial.city ?? '');
  if (city === null || !city.trim()) return null;
  const state    = prompt('State/Region:', initial.state ?? '');
  if (state === null || !state.trim()) return null;
  const postal   = prompt('Postal code:', initial.postalCode ?? '');
  if (postal === null || !postal.trim()) return null;
  const country  = prompt('Country:', initial.country ?? 'US');
  if (country === null || !country.trim()) return null;

  return {
    label, name, phone,
    address1, address2,
    city, state, postalCode: postal, country
  };
}

//
// -------------------------------
// Init
// -------------------------------
(async function initAccountPage() {
  const session = await loadSession();
  if (!session?.signedIn) return;

  // ✅ Wire the profile form BEFORE we fetch and render current values
  wireProfileForm();

  // Ensure Address section exists, wire once, then load
  ensureAddressSection();
  wireAddressUI();

  await Promise.allSettled([loadProfile(), loadOrders(), loadPets(), loadAddresses()]);
})();