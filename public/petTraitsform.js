import { TRAITS, defaultTraits } from '/public/petTraitsSchema.js';

// ——— helpers
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const toNum = v => (v===''? '' : Number(v));

// Add a “chip” group behavior (multi or single)
function wireChipGroup(group) {
  const multi = group.getAttribute('data-multi') === 'true';
  group.addEventListener('click', (e) => {
    const chip = e.target.closest('.trait-chip');
    if (!chip) return;
    if (multi) {
      const pressed = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', pressed ? 'false' : 'true');
    } else {
      $$('.trait-chip', group).forEach(c => c.setAttribute('aria-pressed','false'));
      chip.setAttribute('aria-pressed','true');
    }
  });
}

// Read value(s) from a chip group
function readChipGroup(group) {
  const multi = group.getAttribute('data-multi') === 'true';
  const on = $$('.trait-chip[aria-pressed="true"]', group).map(c => c.dataset.value);
  return multi ? on : (on[0] || '');
}

// Set selected chips from value(s)
function setChipGroup(group, value) {
  const multi = group.getAttribute('data-multi') === 'true';
  const values = Array.isArray(value) ? value : [value];
  $$('.trait-chip', group).forEach(chip => {
    chip.setAttribute('aria-pressed', values.includes(chip.dataset.value) ? 'true' : 'false');
  });
}

// Support “add custom” input -> chips (for allergies)
function wireCustomAdd(container) {
  const input = $('[data-custom-input]', container);
  const addBtn = $('[data-custom-add]', container);
  const group  = $('[data-trait="allergies"]', container);
  if (!input || !addBtn || !group) return;

  addBtn.addEventListener('click', () => {
    const val = input.value.trim().toLowerCase().replace(/\s+/g,'-');
    if (!val) return;
    // If already exists, toggle it on
    let chip = group.querySelector(`.trait-chip[data-value="${val}"]`);
    if (!chip) {
      chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'trait-chip';
      chip.dataset.value = val;
      chip.setAttribute('aria-pressed','true');
      chip.textContent = input.value.trim();
      group.appendChild(chip);
    } else {
      chip.setAttribute('aria-pressed','true');
    }
    input.value = '';
  });
}

// ——— public API

export function initTraitsForm(form) {
  // Wire groups
  $$('[data-trait]', form).forEach(wireChipGroup);
  wireCustomAdd(form);
}

export function setTraitsToForm(form, traits) {
  const t = { ...defaultTraits(), ...(traits || {}) };

  // singles
  const size = $('[data-trait="size"]', form);
  const sex = $('[data-trait="sex"]', form);
  const spn = $('[data-trait="spayNeuter"]', form);
  const chew= $('[data-trait="chewStrength"]', form);
  const catn= $('[data-trait="catnip"]', form);

  size && setChipGroup(size, t.size);
  sex  && setChipGroup(sex, t.sex);
  spn  && setChipGroup(spn, t.spayNeuter);
  chew && setChipGroup(chew, t.chewStrength);
  catn && setChipGroup(catn, t.catnip);

  // multis
  const diets = $('[data-trait="diets"]', form);
  const toys  = $('[data-trait="toyTypes"]', form);
  const flavs = $('[data-trait="flavors"]', form);
  const sens  = $('[data-trait="sensitivities"]', form);
  const alrg  = $('[data-trait="allergies"]', form);

  diets && setChipGroup(diets, t.diets);
  toys  && setChipGroup(toys, t.toyTypes);
  flavs && setChipGroup(flavs, t.flavors);
  sens  && setChipGroup(sens, t.sensitivities);
  alrg  && setChipGroup(alrg, t.allergies);

  // numbers
  const weight = $('#trait-weight-lb', form);
  const neck   = $('#trait-neck-in', form);
  const chest  = $('#trait-chest-in', form);
  const back   = $('#trait-back-in', form);
  const notes  = $('#trait-notes', form);

  if (weight) weight.value = t.weightLb ?? '';
  if (neck)   neck.value   = t.neckIn ?? '';
  if (chest)  chest.value  = t.chestIn ?? '';
  if (back)   back.value   = t.backIn ?? '';
  if (notes)  notes.value  = t.notes ?? '';
}

export function getTraitsFromForm(form) {
  const t = defaultTraits();

  const size = $('[data-trait="size"]', form);
  const sex  = $('[data-trait="sex"]', form);
  const spn  = $('[data-trait="spayNeuter"]', form);
  const chew = $('[data-trait="chewStrength"]', form);
  const catn = $('[data-trait="catnip"]', form);

  t.size        = size ? readChipGroup(size) : '';
  t.sex         = sex  ? readChipGroup(sex)  : 'unknown';
  t.spayNeuter  = spn  ? readChipGroup(spn)  : 'unknown';
  t.chewStrength= chew ? readChipGroup(chew) : '';
  t.catnip      = catn ? readChipGroup(catn) : 'unknown';

  const diets = $('[data-trait="diets"]', form);
  const toys  = $('[data-trait="toyTypes"]', form);
  const flavs = $('[data-trait="flavors"]', form);
  const sens  = $('[data-trait="sensitivities"]', form);
  const alrg  = $('[data-trait="allergies"]', form);

  t.diets        = diets ? readChipGroup(diets)        : [];
  t.toyTypes     = toys  ? readChipGroup(toys)         : [];
  t.flavors      = flavs ? readChipGroup(flavs)        : [];
  t.sensitivities= sens  ? readChipGroup(sens)         : [];
  t.allergies    = alrg  ? readChipGroup(alrg)         : [];

  t.weightLb = toNum($('#trait-weight-lb', form)?.value ?? '');
  t.neckIn   = toNum($('#trait-neck-in', form)?.value ?? '');
  t.chestIn  = toNum($('#trait-chest-in', form)?.value ?? '');
  t.backIn   = toNum($('#trait-back-in', form)?.value ?? '');
  t.notes    = ($('#trait-notes', form)?.value ?? '').trim();

  // Clean empty numerics back to '' so JSON is tidy
  ['weightLb','neckIn','chestIn','backIn'].forEach(k => {
    if (t[k] === '') return;
    if (!Number.isFinite(t[k])) t[k] = '';
  });

  return t;
}

// Boot helper: populate + keep hidden JSON input up to date before submit
export function attachTraitsLifecycle(modal, fetchPetByIndex) {
  const form = modal.querySelector('#editPetForm');
  if (!form) return;

  initTraitsForm(form);

  const hidden = document.createElement('input');
  hidden.type = 'hidden';
  hidden.name = 'traits';
  hidden.id   = 'editPetTraitsJson';
  form.appendChild(hidden);

  // When modal opens, load traits from API using editPetIndex
  const observer = new MutationObserver(() => {
    const isOpen = !modal.classList.contains('hidden');
    if (!isOpen) return;
    const idx = modal.querySelector('#editPetIndex')?.value;
    if (!idx) return;
    fetchPetByIndex(Number(idx)).then(pet => {
      try {
        const traits = pet?.traits || (typeof pet?.traitsJson === 'string' ? JSON.parse(pet.traitsJson) : null);
        if (traits) setTraitsToForm(form, traits);
      } catch {}
    }).catch(()=>{ /* noop */ });
  });
  observer.observe(modal, { attributes:true, attributeFilter:['class'] });

  // Before submit, serialize traits into hidden input (don’t prevent default)
  form.addEventListener('submit', () => {
    const traits = getTraitsFromForm(form);
    hidden.value = JSON.stringify(traits);
  });
}