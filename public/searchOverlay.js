export function toggleSearchOverlay() {
  const overlay = document.getElementById('searchOverlay');
  if (!overlay) return;

  const isVisible = getComputedStyle(overlay).display !== 'none';
  overlay.style.setProperty("display", isVisible ? "none" : "block", "important");
  console.log(`[Toggle] Overlay visibility set to: ${!isVisible ? 'block' : 'none'}`);
}
