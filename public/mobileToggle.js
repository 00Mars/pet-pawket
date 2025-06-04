export function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
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
