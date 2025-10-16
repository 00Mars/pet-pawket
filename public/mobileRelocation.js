<<<<<<< HEAD
// petpawket/public/mobileRelocation.js
import { throttleLog } from './throttleLog.js';

// Setup responsive mobile menu relocation. This function relocates
// navigation links and icon areas into the mobile drawer when the
// viewport width is within tablet or mobile sizes, and moves them back
// into the desktop navbar when wider. Renamed to camelCase for proper
// exports.
=======
import { throttleLog } from './throttleLog.js';

>>>>>>> c2470ba (Initial real commit)
export function setupResponsiveMobileMenu() {
  const logLayoutState = throttleLog("LayoutState", () => {
    const navLinks = document.querySelector('.nav-links');
    const iconArea = document.querySelector('.icon-area');
    if (!navLinks || !iconArea) return;
    console.table({
      'navLinks parent': navLinks.parentElement.className || navLinks.parentElement.id,
      'iconArea parent': iconArea.parentElement.className || iconArea.parentElement.id
    });
  });

  const relocateToMobile = () => {
    const navLinks = document.querySelector('.nav-links');
    const iconArea = document.querySelector('.icon-area');
<<<<<<< HEAD
    const mobileMenu = document.getElementById('mobile-menu');
=======
    const mobileMenu = document.getElementById('mobileMenu');
>>>>>>> c2470ba (Initial real commit)
    const mobileContent = mobileMenu?.querySelector('.mobile-content');
    const navLeft = document.querySelector('.nav-left');
    const navRight = document.querySelector('.nav-right');
    if (!navLinks || !iconArea || !mobileContent || !navLeft || !navRight) return;

    const isTabletOrBelow = window.innerWidth <= 1024;
    const isMobile = window.innerWidth < 769;

    const safeAppend = (parent, child) => {
      if (child && parent && parent !== child.parentElement && !child.contains(parent)) {
        parent.appendChild(child);
      }
    };

    if (isTabletOrBelow && !navLinks.classList.contains('nav-links-mobile')) {
      safeAppend(mobileContent, navLinks);
      navLinks.classList.add('nav-links-mobile');
    }

    if (isMobile && !iconArea.classList.contains('icon-area-mobile')) {
      safeAppend(mobileContent, iconArea);
      iconArea.classList.add('icon-area-mobile');
    }

    if (!isTabletOrBelow && navLinks.classList.contains('nav-links-mobile')) {
      safeAppend(navLeft, navLinks);
      navLinks.classList.remove('nav-links-mobile');
      navLinks.removeAttribute('style');
    }

    if (!isMobile && iconArea.classList.contains('icon-area-mobile')) {
      safeAppend(navRight, iconArea);
      iconArea.classList.remove('icon-area-mobile');
      iconArea.removeAttribute('style');
    }

    logLayoutState();
  };

  let lastViewportIsMobile = null;
  let resizeTimer;

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const isMobileNow = window.innerWidth <= 1024;
<<<<<<< HEAD
      const mobileMenu = document.getElementById('mobile-menu');
=======
      const mobileMenu = document.getElementById('mobileMenu');
>>>>>>> c2470ba (Initial real commit)

      if (!isMobileNow && mobileMenu?.classList.contains('active')) {
        mobileMenu.classList.remove('active');
        mobileMenu.classList.add('closing');
        document.body.style.overflow = '';
        const navLinks = document.querySelector('.nav-links');
        const iconArea = document.querySelector('.icon-area');
        const navLeft = document.querySelector('.nav-left');
        const navRight = document.querySelector('.nav-right');
        navLeft?.appendChild(navLinks);
        navRight?.appendChild(iconArea);
        iconArea.classList.remove('icon-area-mobile');
        setTimeout(() => mobileMenu.classList.remove('closing'), 400);
      }

      if (isMobileNow !== lastViewportIsMobile) {
        lastViewportIsMobile = isMobileNow;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => relocateToMobile());
        });
      }
    }, 150);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => relocateToMobile());
  });
}
