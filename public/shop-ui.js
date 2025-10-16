/* Tiny UI-only helpers for the Shop page (no data logic changed)
   - Adds a shadow class when the controls bar is stuck under the navbar
   - Polishes the "For My Pets" toggle to sync aria-expanded state
*/
(() => {
  const controls = document.getElementById('pp-controls-glass');
  if (controls) {
    const top = parseInt(getComputedStyle(controls).top || '0', 10);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          // When the sentinel scrolls out above, the bar is "stuck"
          if (!e.isIntersecting && e.boundingClientRect.top < top) {
            controls.classList.add('stuck');
          } else {
            controls.classList.remove('stuck');
          }
        });
      },
      { rootMargin: `-${top + 1}px 0px 0px 0px`, threshold: [1] }
    );
    // Create a sentinel right above the bar
    const sentinel = document.createElement('div');
    sentinel.style.position = 'absolute';
    sentinel.style.top = `calc(-${top + 2}px)`;
    sentinel.style.height = '1px';
    sentinel.style.width = '1px';
    sentinel.setAttribute('aria-hidden', 'true');
    controls.parentElement.style.position = 'relative';
    controls.parentElement.prepend(sentinel);
    obs.observe(sentinel);
  }

  const petsToggle = document.getElementById('pp-my-pets-toggle');
  const petsPane = document.getElementById('pp-my-pane');
  if (petsToggle && petsPane) {
    // If Bootstrap's collapse is present, just mirror its events; otherwise do a simple toggle
    const applyAria = () => {
      const expanded = petsPane.classList.contains('show');
      petsToggle.setAttribute('aria-expanded', String(expanded));
    };

    // Bootstrap collapse events (if available)
    const onShown = () => applyAria();
    const onHidden = () => applyAria();

    petsToggle.addEventListener('click', () => {
      // Prefer Bootstrap's data API if present
      if (window.bootstrap?.Collapse) {
        const c = bootstrap.Collapse.getOrCreateInstance(petsPane, { toggle: false });
        c.toggle();
      } else {
        petsPane.classList.toggle('show');
        applyAria();
      }
    });

    petsPane.addEventListener('shown.bs.collapse', onShown);
    petsPane.addEventListener('hidden.bs.collapse', onHidden);
    applyAria();
  }
})();
