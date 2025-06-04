export function setupHueyAnimation() {
  const huey = document.getElementById('huey');
  const searchIcon = document.getElementById('search-icon');
  if (!huey || !searchIcon) return;

  huey.addEventListener('mouseenter', () => {
    huey.classList.remove('huey-animate');
    searchIcon.classList.remove('search-pop');
    void huey.offsetWidth; // force reflow
    void searchIcon.offsetWidth;
    huey.classList.add('huey-animate');

    const handler = (e) => {
      if (e.animationName === 'wagAndBounce') {
        setTimeout(() => searchIcon.classList.add('search-pop'), 300);
        huey.removeEventListener('animationend', handler);
      }
    };

    huey.addEventListener('animationend', handler);
  });
}
