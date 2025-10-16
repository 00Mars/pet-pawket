<<<<<<< HEAD
// petpawket/public/mobileToggle.js
// Toggle the mobile menu drawer open or closed. When the menu opens we
// migrate the navigation links and icon area into the drawer. When the
// menu closes (on wider viewports) we return those elements back to
// their desktop containers. This function name uses camelCase so it
// can be imported correctly from other modules.
export function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
=======
export function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
>>>>>>> c2470ba (Initial real commit)
  const mobileContent = menu?.querySelector('.mobile-content');
  const navLinks = document.querySelector('.nav-links');
  const iconArea = document.querySelector('.icon-area');
  const navLeft = document.querySelector('.nav-left');
  const navRight = document.querySelector('.nav-right');

  if (!menu || !mobileContent || !navLinks || !iconArea || !navLeft || !navRight) return;

  const isActive = menu.classList.toggle('active');
  document.body.style.overflow = isActive ? 'hidden' : '';

  if (isActive) {
    if (!mobileContent.contains(navLinks)) mobileContent.appendChild(navLinks);
    if (!mobileContent.contains(iconArea)) mobileContent.appendChild(iconArea);
    iconArea.classList.add('icon-area-mobile');
  } else if (!isActive && window.innerWidth > 768) {
    navRight.appendChild(iconArea);
    iconArea.classList.remove('icon-area-mobile');
    iconArea.removeAttribute('style');
  }
}
