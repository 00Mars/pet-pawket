export function setupHueyAnimation() {
  const huey = document.getElementById('huey');
  if (!huey) return;

  // Restart Huey’s own animation on hover/focus — NO interaction with the search icon anymore.
  const trigger = () => {
    huey.classList.remove('huey-animate');
    // force reflow to restart
    void huey.offsetWidth;
    huey.classList.add('huey-animate');
  };

  huey.addEventListener('mouseenter', trigger);
  huey.addEventListener('focus', trigger, true);
}
