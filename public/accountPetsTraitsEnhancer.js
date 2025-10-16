/**
 * Pet Pawket — Account Pets Traits Enhancer (species-aware + tokenized allergies)
 * Scope: ONLY the Traits UI inside the Edit Pet modal.
 *
 * Adds:
 *  - Token input for Allergies with removable chips (click × or the chip to remove).
 *  - Prevents Enter from closing the modal when adding an allergy.
 *  - Keeps #petTraitsJson in sync on every interaction.
 *  - Species-aware show/hide without losing visible values, safe reset for hidden groups.
 *  - Sex-aware gating of spay/neuter.
 */

(function () {
  const modal = document.getElementById('editPetModal');
  if (!modal) return;
  const form = document.getElementById('editPetForm');
  if (!form) return;

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* -------------------- Spec -------------------- */

  const SPECIES_TRAIT_PROFILE = {
    dog:  ["size","weightLb","sex","spayNeuter","houseTrained","chewStrength","playStyle","diets","flavors","allergies","neckIn","chestIn","backIn","notes"],
    cat:  ["size","weightLb","sex","spayNeuter","litterTrained","catnip","playStyle","diets","flavors","allergies","neckIn","chestIn","backIn","notes"],
    bird: ["weightLb","sex","flightStatus","cageSizeClass","notes"],
    reptile: ["uvb","habitat","humidity","baskTemp","notes"],
    fish: ["waterType","tankGal","temperamentFish","schooling","notes"],
    horse: ["heightHands","blanketSize","sex","notes"],
    rabbit: ["size","weightLb","sex","spayNeuter","litterTrained","notes","allergies"],
    "guinea pig": ["size","weightLb","sex","litterTrained","notes","allergies"],
    hamster: ["size","weightLb","sex","litterTrained","notes","allergies"],
    ferret: ["size","weightLb","sex","spayNeuter","litterTrained","diets","flavors","allergies","neckIn","chestIn","backIn","notes"],
    other: ["notes","allergies"]
  };

  const TRAIT_DOM = {
    size: '.trait-chips[data-trait="size"]',
    weightLb: '#trait-weight-lb',
    sex: '.trait-chips[data-trait="sex"]',
    spayNeuter: '.trait-chips[data-trait="spayNeuter"]',
    chewStrength: '.trait-chips[data-trait="chewStrength"]',
    playStyle: '.trait-chips[data-trait="playStyle"]',
    houseTrained: '.trait-chips[data-trait="houseTrained"]',
    litterTrained: '.trait-chips[data-trait="litterTrained"]',
    catnip: '#trait-catnip-wrap',
    diets: '.trait-chips[data-trait="diets"]',
    flavors: '.trait-chips[data-trait="flavors"]',
    allergies: '.trait-chips[data-trait="allergies"]',
    neckIn: '#trait-neck-in',
    chestIn: '#trait-chest-in',
    backIn: '#trait-back-in',
    notes: '#trait-notes',
    flightStatus: '.trait-chips[data-trait="flightStatus"]',
    cageSizeClass: '.trait-chips[data-trait="cageSizeClass"]',
    uvb: '.trait-chips[data-trait="uvb"]',
    habitat: '.trait-chips[data-trait="habitat"]',
    humidity: '#trait-humidity',
    baskTemp: '#trait-bask-temp',
    waterType: '.trait-chips[data-trait="waterType"]',
    tankGal: '#trait-tank-gal',
    temperamentFish: '.trait-chips[data-trait="temperamentFish"]',
    schooling: '.trait-chips[data-trait="schooling"]',
    heightHands: '#trait-height-hands',
    blanketSize: '.trait-chips[data-trait="blanketSize"]'
  };

  const CHIP_DEFAULTS = {
    sex: "unknown",
    spayNeuter: "unknown",
    houseTrained: "unknown",
    litterTrained: "unknown",
    catnip: "unknown",
    uvb: "unknown",
    flightStatus: "unknown",
    schooling: "unknown",
    playStyle: "unknown"
  };

  /* -------------------- Utilities -------------------- */

  function ensureHiddenInput() {
    let input = $('#petTraitsJson', form);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.id = 'petTraitsJson';
      input.name = 'traits';
      input.value = '{}';
      form.appendChild(input);
    }
    return input;
  }
  function getHiddenTraits() {
    try { return JSON.parse(ensureHiddenInput().value || '{}') || {}; }
    catch { return {}; }
  }
  function setHiddenTraits(obj) {
    ensureHiddenInput().value = JSON.stringify(obj || {});
  }

  function nearestGroupContainer(sel) {
    const node = $(sel, modal);
    if (!node) return null;
    return node.closest('.trait-group') || node;
  }

  function setPressed(btn, on) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function isPressed(btn) {
    return (btn.getAttribute('aria-pressed') || '').toLowerCase() === 'true';
  }
  function toggleChip(container, chip) {
    const multi = (container.getAttribute('data-multi') || '').toLowerCase() === 'true';
    if (multi) {
      setPressed(chip, !isPressed(chip));
    } else {
      $$('.trait-chip', container).forEach(b => setPressed(b, b === chip));
    }
  }
  function pressedValues(container) {
    const multi = (container.getAttribute('data-multi') || '').toLowerCase() === 'true';
    const vals  = $$('button.trait-chip[aria-pressed="true"]', container).map(b => b.dataset.value);
    return multi ? vals : (vals[0] ?? null);
  }
  function setSingle(container, value) {
    $$('.trait-chip', container).forEach(b => setPressed(b, b.dataset.value === value));
  }

  function idToCamel(id) {
    return String(id || '')
      .replace(/^trait-/, '')
      .split('-')
      .map((p,i) => i ? p[0].toUpperCase()+p.slice(1) : p)
      .join('');
  }

  function readNumeric(el) {
    if (!el) return undefined;
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : undefined;
  }
  function readText(el) {
    if (!el) return undefined;
    const v = (el.value || '').trim();
    return v ? v : undefined;
  }

  function buildTraitsSnapshot() {
    const out = {};

    // All chip groups
    $$('.trait-chips[data-trait]', modal).forEach(group => {
      const key = group.getAttribute('data-trait');
      const val = pressedValues(group);
      if (Array.isArray(val)) {
        if (val.length) out[key] = val;
      } else {
        if (val !== null) out[key] = val;
      }
    });

    // Numeric / text inputs beginning with trait-
    $$('input[id^="trait-"], textarea[id^="trait-"]', modal).forEach(inp => {
      if (inp.tagName === 'TEXTAREA') {
        const v = readText(inp);
        if (v !== undefined) out[idToCamel(inp.id)] = v;
      } else if (inp.type === 'number') {
        const v = readNumeric(inp);
        if (v !== undefined) out[idToCamel(inp.id)] = v;
      } else if (inp.type === 'text') {
        const v = readText(inp);
        if (v !== undefined) out[idToCamel(inp.id)] = v;
      }
    });

    return out;
  }

  function writeHiddenJson() {
    setHiddenTraits(buildTraitsSnapshot());
  }

  function normalizeSpecies(raw) {
    return String(raw || '').trim().toLowerCase();
  }
  function currentSpecies() {
    return normalizeSpecies($('#editPetType')?.value);
  }

  function show(el) { if (!el) return; el.classList.remove('d-none'); el.style.display = ''; }
  function hide(el) { if (!el) return; el.classList.add('d-none'); el.style.display = 'none'; }

  function resetChipGroup(group, explicitDefault) {
    if (!group) return;
    const def = explicitDefault ?? CHIP_DEFAULTS[group.getAttribute('data-trait') || ''] ?? null;
    if (def) setSingle(group, def);
    else $$('.trait-chip', group).forEach(b => setPressed(b, false));
  }

  function resetInputsIn(el) {
    $$('input[type="number"], input[type="text"], textarea', el).forEach(inp => { inp.value = ''; });
  }

  function resetContainer(containerEl) {
    if (!containerEl) return;
    $$('[data-trait]', containerEl).forEach(gr => resetChipGroup(gr));
    resetInputsIn(containerEl);
    // Special: allergies list is dynamic chips
    if (containerEl.querySelector('.trait-chips[data-trait="allergies"]')) {
      containerEl.querySelector('.trait-chips[data-trait="allergies"]').innerHTML = '';
    }
  }

  function updateSpeciesVisibility({ revertWhenHide = true } = {}) {
    const species = currentSpecies();
    const visibleKeys = SPECIES_TRAIT_PROFILE[species] || SPECIES_TRAIT_PROFILE.other;
    const allow = new Set(visibleKeys);

    Object.entries(TRAIT_DOM).forEach(([key, sel]) => {
      const groupContainer = nearestGroupContainer(sel);
      if (!groupContainer) return;

      if (allow.has(key)) {
        show(groupContainer);
      } else {
        if (revertWhenHide) resetContainer(groupContainer);
        hide(groupContainer);
      }
    });

    writeHiddenJson();
  }

  /* -------------------- Sex-aware spay/neuter gating -------------------- */

  function spayNeuterGroup() {
    return modal.querySelector('.trait-chips[data-trait="spayNeuter"]');
  }
  function sexGroup() {
    return modal.querySelector('.trait-chips[data-trait="sex"]');
  }
  function selectedSingle(container) {
    return pressedValues(container);
  }

  function applySpayNeuterRules() {
    const spGroup = spayNeuterGroup();
    const sxGroup = sexGroup();
    if (!spGroup || !sxGroup) return;

    const btnSpayed   = spGroup.querySelector('button.trait-chip[data-value="spayed"]');
    const btnNeutered = spGroup.querySelector('button.trait-chip[data-value="neutered"]');
    const btnIntact   = spGroup.querySelector('button.trait-chip[data-value="intact"]');
    const btnUnknown  = spGroup.querySelector('button.trait-chip[data-value="unknown"]');
    [btnSpayed, btnNeutered, btnIntact, btnUnknown].forEach(b => { if (b) { b.disabled = false; b.hidden = false; } });

    const sex = String(selectedSingle(sxGroup) || 'unknown').toLowerCase();
    const currentSp = String(selectedSingle(spGroup) || 'unknown').toLowerCase();

    if (sex === 'female') {
      if (btnNeutered) { btnNeutered.disabled = true; btnNeutered.hidden = true; }
      if (currentSp === 'neutered') setSingle(spGroup, 'unknown');
    } else if (sex === 'male') {
      if (btnSpayed) { btnSpayed.disabled = true; btnSpayed.hidden = true; }
      if (currentSp === 'spayed') setSingle(spGroup, 'unknown');
    } else {
      if (btnSpayed)   { btnSpayed.disabled = true; btnSpayed.hidden = true; }
      if (btnNeutered) { btnNeutered.disabled = true; btnNeutered.hidden = true; }
      if (btnIntact)   { btnIntact.disabled = true; btnIntact.hidden = true; }
      if (btnUnknown)  { btnUnknown.disabled = false; btnUnknown.hidden = false; }
      setSingle(spGroup, 'unknown');
    }

    writeHiddenJson();
  }

  /* -------------------- Allergies tokenization -------------------- */

  const allergiesInput = $('[data-trait-input="allergies"]', modal);
  const allergiesWrap  = $('.trait-chips[data-trait="allergies"]', modal);

  function normalizeToken(v) {
    return String(v || '').trim().replace(/\s+/g, ' ');
  }

  function currentAllergyValues() {
    return $$('button.trait-chip', allergiesWrap).map(b => b.dataset.value);
  }

  function hasAllergy(val) {
    const needle = normalizeToken(val).toLowerCase();
    return currentAllergyValues().some(v => String(v).toLowerCase() === needle);
  }

  function addAllergyChip(val) {
    const v = normalizeToken(val);
    if (!v || hasAllergy(v)) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trait-chip';
    btn.setAttribute('data-value', v);
    btn.setAttribute('aria-pressed', 'true');
    btn.innerHTML = `<span>${v}</span><span class="chip-x" aria-hidden="true">×</span>`;
    allergiesWrap.appendChild(btn);
  }

  function removeAllergyChip(val) {
    const needle = normalizeToken(val).toLowerCase();
    const btn = $$('button.trait-chip', allergiesWrap).find(b => String(b.dataset.value).toLowerCase() === needle);
    if (btn) btn.remove();
  }

  function renderAllergyChipsFromTraits(traits) {
    if (!allergiesWrap) return;
    allergiesWrap.innerHTML = '';
    const list = Array.isArray(traits?.allergies) ? traits.allergies : [];
    list.forEach(addAllergyChip);
  }

  function commitAllergiesToHidden() {
    const traits = getHiddenTraits();
    const vals = currentAllergyValues();
    if (vals.length) traits.allergies = vals;
    else delete traits.allergies;
    setHiddenTraits(traits);
  }

  // Trap Enter/Tab/Comma to add tokens, prevent form submit / modal close
  allergiesInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
      e.preventDefault();
      e.stopPropagation();
      const raw = allergiesInput.value;
      const token = normalizeToken(raw.replace(/,$/, ''));
      if (token) {
        addAllergyChip(token);
        allergiesInput.value = '';
        commitAllergiesToHidden();
      }
    } else if (e.key === 'Backspace' && !allergiesInput.value) {
      // remove last chip for convenience
      const chips = $$('button.trait-chip', allergiesWrap);
      if (chips.length) {
        chips[chips.length - 1].remove();
        commitAllergiesToHidden();
      }
    }
  });

  // Click a chip (or its ×) to remove
  allergiesWrap?.addEventListener('click', (e) => {
    const chip = e.target.closest('button.trait-chip');
    if (!chip) return;
    e.preventDefault();
    e.stopPropagation();
    chip.remove();
    commitAllergiesToHidden();
  });

  /* -------------------- Events -------------------- */

  // Chip clicks for all groups except allergies (handled above)
  modal.addEventListener('click', (e) => {
    const chip = e.target.closest('button.trait-chip');
    if (!chip || !modal.contains(chip)) return;
    const group = chip.closest('.trait-chips[data-trait]');
    if (!group) return;

    const traitKey = group.getAttribute('data-trait');
    if (traitKey === 'allergies') return; // removal handled by allergiesWrap click

    toggleChip(group, chip);

    if (traitKey === 'sex') {
      applySpayNeuterRules();
    }

    writeHiddenJson();
  });

  // Species change
  $('#editPetType')?.addEventListener('change', () => {
    updateSpeciesVisibility({ revertWhenHide: true });
    applySpayNeuterRules();
  });

  // Any inputs affecting traits (numbers/textareas)
  modal.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;
    const id = t.id || '';
    if (id.startsWith('trait-')) writeHiddenJson();
  });

  // Observe modal open/close for hydration
  const mo = new MutationObserver(() => {
    const open = !modal.classList.contains('hidden');
    if (open) {
      // hydrate allergies from existing JSON (set by openEditModal)
      renderAllergyChipsFromTraits(getHiddenTraits());
      updateSpeciesVisibility({ revertWhenHide: false });
      applySpayNeuterRules();
      requestAnimationFrame(writeHiddenJson);
    }
  });
  mo.observe(modal, { attributes: true, attributeFilter: ['class'] });

  // Initial (page load) alignment
  renderAllergyChipsFromTraits(getHiddenTraits());
  updateSpeciesVisibility({ revertWhenHide: false });
  applySpayNeuterRules();
  writeHiddenJson();
})();
