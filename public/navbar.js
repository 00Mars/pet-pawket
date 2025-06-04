import { attachNavbarModals } from './navbarModals.js';
import { updateAuthDisplay, logout } from './auth.js';
import { throttleLog } from './throttleLog.js';
import { toggleMobileMenu } from './mobileToggle.js';
import { setupDropdownToggles } from './dropdownToggles.js';
import { setupResponsiveMobileMenu } from './mobileRelocation.js';

let moved = false;

export function injectNavbar(callback) {
  fetch('navbar.html')
    .then(res => res.text())
    .then(data => {
      const container = document.getElementById('navbar-container');
      if (!container) return;

      container.innerHTML = data;
      console.log("[injectNavbar] Navbar injected.");

      requestAnimationFrame(() => {
        attachNavbarModals();
        updateAuthDisplay();

        // Logout Button
        document.getElementById("logoutBtn")?.addEventListener("click", e => {
          e.preventDefault();
          logout();
        });

        // LOGIN FORM
        const loginForm = document.getElementById("loginForm");
        if (loginForm) {
          loginForm.addEventListener("submit", async e => {
            e.preventDefault();

            const email = e.target.email.value;
            const password = e.target.password.value;

            try {
              const res = await fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
              });

              const data = await res.json();
              console.log("[login] response:", data);

              if (!res.ok || !data.token) {
                alert("Login failed: " + (data.error || "No token received"));
                return;
              }

              // Save tokens
              localStorage.setItem("authToken", data.token);
              localStorage.setItem("shopifyAccessToken", data.shopifyAccessToken || "");
              localStorage.setItem("currentUserId", data.user?.id || "");
              localStorage.setItem("pp_user_logged_in", "true");

              console.log("[login] Tokens saved.");
              updateAuthDisplay();

              // Close modal
              const modal = document.getElementById("loginModal");
              if (modal) {
                modal.classList.remove("visible");
                setTimeout(() => modal.classList.add("hidden"), 250);
              }

              // Redirect or refresh
              if (window.location.pathname.includes("account")) {
                location.reload();
              } else {
                window.location.href = "/account.html";
              }

            } catch (err) {
              console.error("[login] Error:", err);
              alert("An error occurred. Try again.");
            }
          });
        }

        // SIGNUP FORM
        const signupForm = document.getElementById("signupForm");
        if (signupForm) {
          signupForm.addEventListener("submit", async e => {
            e.preventDefault();
            const form = e.target;

            const password = form.password.value;
            const confirmPassword = form.confirmPassword.value;

            if (password !== confirmPassword) {
              alert("Passwords do not match.");
              return;
            }

            const payload = {
              firstName: form.firstName.value,
              lastName: form.lastName.value,
              email: form.email.value,
              password
            };

            try {
              const res = await fetch("/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });

              const data = await res.json();
              if (!res.ok || !data.token) {
                alert("Signup failed: " + (data.message || "No token returned"));
                return;
              }

              console.log("[signup] Success:", data.email);
              alert("Account created! You can now log in.");
              document.getElementById("signupModal")?.classList.add("hidden");

            } catch (err) {
              console.error("[signup] Error:", err);
              alert("An error occurred. Try again.");
            }
          });
        }

        // Continue init
        callback?.();
      });

      // Setup for mobile
      if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.body.classList.add('touch-device');
      }

      const toggles = container.querySelectorAll('.mobile-menu-toggle');
      toggles.forEach(t => t.addEventListener('click', toggleMobileMenu));

      setupResponsiveMobileMenu();
      setupDropdownToggles();
    })
    .catch(err => console.error("[injectNavbar] Injection failed:", err));
}
