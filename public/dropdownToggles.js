export function setupDropdownToggles() {
  const navDropdowns = document.querySelectorAll('.nav-item.dropdown');
  const iconDropdowns = document.querySelectorAll('.icon-dropdown');

  function closeAllDropdowns(except = null) {
    document.body.classList.remove('dropdown-active');
    [...navDropdowns, ...iconDropdowns].forEach(d => {
      if (d !== except) d.classList.remove('active');
    });
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
}
