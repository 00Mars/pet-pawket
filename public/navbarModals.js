export function attachNavbarModals() {
  const modals = {
    login: document.getElementById("loginModal"),
    tracker: document.getElementById("orderTrackerModal"),
    signup: document.getElementById("signupModal")
  };

  function showModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
    requestAnimationFrame(() => modal.classList.add("visible"));
  }

  function hideModal(modal) {
    if (!modal) return;
    modal.classList.remove("visible");
    setTimeout(() => modal.classList.add("hidden"), 250);
  }

  document.querySelectorAll('[data-toggle="login-modal"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      showModal(modals.login);
    });
  });

  document.querySelectorAll('[data-close="loginModal"]').forEach(btn => {
    btn.addEventListener('click', () => hideModal(modals.login));
  });

  document.querySelectorAll('[data-toggle="order-tracker-modal"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      showModal(modals.tracker);
    });
  });

  document.querySelectorAll('[data-close="orderTrackerModal"]').forEach(btn => {
    btn.addEventListener('click', () => hideModal(modals.tracker));
  });

  document.querySelectorAll('[data-toggle="signup-modal"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      showModal(modals.signup);
    });
  });

  document.querySelectorAll('[data-close="signupModal"]').forEach(btn => {
    btn.addEventListener('click', () => hideModal(modals.signup));
  });

  // ESC key closes all modals
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      Object.values(modals).forEach(hideModal);
    }
  });

  // Click outside modal-content to close
  Object.values(modals).forEach(modal => {
    modal?.addEventListener("click", e => {
      if (e.target === modal) hideModal(modal);
    });
  });

  // Optional: mobile swipe down to close (basic)
  Object.values(modals).forEach(modal => {
    let startY = 0;
    modal?.addEventListener("touchstart", e => {
      startY = e.touches[0].clientY;
    });
    modal?.addEventListener("touchend", e => {
      const endY = e.changedTouches[0].clientY;
      if (endY - startY > 100) hideModal(modal);
    });
  });

  document.getElementById("orderTrackerForm")?.addEventListener("submit", e => {
    e.preventDefault();
    window.location.href = "/tools/order-tracker";
  });

  
}
