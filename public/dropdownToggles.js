<<<<<<< HEAD
// /public/dropdownToggles.js
// Keep legacy UX without fighting Bootstrap.
// - If a trigger uses [data-bs-toggle="dropdown"] or .dropdown-toggle and Bootstrap is present,
//   let Bootstrap handle open/close and DO NOT call preventDefault/stopPropagation.
// - The document-level closer now ignores clicks inside menus/toggles
//   and does nothing if Bootstrap already has a .dropdown-menu.show open.

export function setupDropdownToggles() {
  // Prevent double-binding if this gets called multiple times
  if (typeof window !== 'undefined' && window.__ppDropdownTogglesWired) {
    try { window.__ppDropdownDebug?.push('dropdownToggles.alreadyWired', {}); } catch {}
    return;
  }
  try { if (typeof window !== 'undefined') window.__ppDropdownTogglesWired = true; } catch {}
  const HAS_BS = !!(window.bootstrap || window.Tooltip || window.Popover);
  try { window.__ppDropdownDebug?.push('dropdownToggles.init', { HAS_BS }); } catch {}

  const navDropdowns  = document.querySelectorAll('.nav-item.dropdown');
=======
export function setupDropdownToggles() {
  const navDropdowns = document.querySelectorAll('.nav-item.dropdown');
>>>>>>> c2470ba (Initial real commit)
  const iconDropdowns = document.querySelectorAll('.icon-dropdown');

  function closeAllDropdowns(except = null) {
    document.body.classList.remove('dropdown-active');
    [...navDropdowns, ...iconDropdowns].forEach(d => {
      if (d !== except) d.classList.remove('active');
    });
<<<<<<< HEAD
    // NOTE: we do NOT strip .show here; Bootstrap will handle its own menus.
  }

  // -------- nav (text) dropdowns
  navDropdowns.forEach(dropdown => {
    const trigger =
      dropdown.querySelector('[data-bs-toggle="dropdown"], .dropdown-toggle') ||
      dropdown.querySelector('a,button');

    if (!trigger) return;

    if (HAS_BS && trigger.matches('[data-bs-toggle="dropdown"], .dropdown-toggle')) {
      // Defer to Bootstrap, only coordinate siblings.
      trigger.addEventListener('show.bs.dropdown', () => {
        try { window.__ppDropdownDebug?.push('dropdownToggles.event', { type: 'show.bs.dropdown', id: trigger.id || null }); } catch {}
        closeAllDropdowns(dropdown);
        document.body.classList.add('dropdown-active');
      });
      trigger.addEventListener('hide.bs.dropdown', () => {
        try { window.__ppDropdownDebug?.push('dropdownToggles.event', { type: 'hide.bs.dropdown', id: trigger.id || null }); } catch {}
        document.body.classList.remove('dropdown-active');
      });
      try { trigger.dataset.wired = (trigger.dataset.wired ? trigger.dataset.wired + ',dropdownToggles' : 'dropdownToggles'); } catch {}
    } else {
      // Legacy emulation for pages without Bootstrap
      trigger.addEventListener('click', (e) => {
        try { window.__ppDropdownDebug?.push('dropdownToggles.event', { type: 'click', id: trigger.id || null }); } catch {}
        const href = trigger.getAttribute('href') || '';
        if (href === '' || href === '#') e.preventDefault();
        const isActive = dropdown.classList.contains('active');
        closeAllDropdowns();
        if (!isActive) {
          dropdown.classList.add('active');
          document.body.classList.add('dropdown-active');
        }
      });
      try { trigger.dataset.wired = (trigger.dataset.wired ? trigger.dataset.wired + ',dropdownToggles' : 'dropdownToggles'); } catch {}
    }
  });

  // -------- icon dropdowns (wishlist/cart)
  iconDropdowns.forEach(dropdown => {
    const trigger =
      dropdown.querySelector('#nav-wish-toggle, #nav-cart-toggle, [data-bs-toggle="dropdown"], .dropdown-toggle') ||
      dropdown.querySelector('a,button');

    if (!trigger) return;

    if (HAS_BS && trigger.matches('[data-bs-toggle="dropdown"], .dropdown-toggle')) {
      trigger.addEventListener('show.bs.dropdown', () => {
        closeAllDropdowns(dropdown);
        document.body.classList.add('dropdown-active');
      });
      trigger.addEventListener('hide.bs.dropdown', () => {
        document.body.classList.remove('dropdown-active');
      });
    } else {
      // Legacy path
      trigger.addEventListener('click', (e) => {
        const href = trigger.getAttribute('href') || '';
        if (href === '' || href === '#') e.preventDefault();
        const isActive = dropdown.classList.contains('active');
        closeAllDropdowns();
        if (!isActive) {
          dropdown.classList.add('active');
          document.body.classList.add('dropdown-active');
        }
      });
    }
  });

  // -------- global closer (HARD PART)
  // Only close legacy .active dropdowns.
  // Ignore clicks inside menus/toggles and do NOT fight Bootstrap when a .show is present.
  document.addEventListener('click', (e) => {
    try { window.__ppDropdownDebug?.push('dropdownToggles.globalClick', { target: e.target && (e.target.id || e.target.className || e.target.tagName) }); } catch {}
    // Click was inside a dropdown menu or on a toggle → ignore
    const inside = e.target.closest('.dropdown-menu, .icon-dropdown-menu, [data-bs-toggle="dropdown"], .dropdown-toggle, .nav-item.dropdown, .icon-dropdown');
    if (inside) return;

    // Defer a frame to let Bootstrap's own event handlers run first; this avoids immediate cross-talk
    requestAnimationFrame(() => {
      try {
        // If Bootstrap has an open menu, let Bootstrap own the lifecycle
        if (HAS_BS && document.querySelector('.dropdown-menu.show')) return;
        // Otherwise close legacy-emulated dropdowns, but record a stack to help triage race sources
        try { window.__ppDropdownDebug?.push('dropdownToggles.globalClose', { when: Date.now(), stack: (new Error()).stack }); } catch {}
        closeAllDropdowns();
      } catch (ex) { console.error('[dropdownToggles] closer error', ex); }
    });
  });
=======
  }

  navDropdowns.forEach(dropdown => {
    const trigger = dropdown.querySelector('a');
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isActive = dropdown.classList.contains('active');
      closeAllDropdowns();
      if (!isActive) dropdown.classList.add('active');
    });
  });

  iconDropdowns.forEach(dropdown => {
    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = dropdown.classList.contains('active');
      closeAllDropdowns();
      if (!isActive) dropdown.classList.add('active');
    });
  });

  document.addEventListener('click', () => {
    closeAllDropdowns();
  });
>>>>>>> c2470ba (Initial real commit)
}
