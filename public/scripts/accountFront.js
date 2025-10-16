// ✅ accountFront.js — Clerk + Shopify access token restoration

import { injectNavbar } from '../navbar.js';
import { injectFooter } from '../footer.js';
import { setupNavbarOverlayHandlers } from '../navbarOverlay.js';
import { setupHueyAnimation } from '../navbarAnimation.js';
import { updateCartBadge } from '../cartUtils.js';

// ✅ accountFront.js — Clerk Authentication Only

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await window.Clerk.load({
      publishableKey: "pk_test_c3Ryb25nLWZlbGluZS02Ny5jbGVyay5hY2NvdW50cy5kZXYk"
    });

    const user = await window.Clerk.user;

    if (!user) {
      await window.Clerk.openSignIn();
      return;
    }

    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) return;

    const res = await fetch("/api/clerk-restore-shopify", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}` // ⬅️ ADD THIS LINE
  },
  body: JSON.stringify({ email })
});


    const data = await res.json();

    if (data.shopifyAccessToken) {
      localStorage.setItem("shopifyAccessToken", data.shopifyAccessToken);
      localStorage.setItem("currentUserId", data.user?.id || "");
      localStorage.setItem("pp_user_logged_in", "true");
      console.log("[✅] Shopify token restored.");
    } else {
      console.warn("[⚠️] Clerk user matched but no Shopify token found.");
    }

    document.querySelectorAll(".requires-auth").forEach(el => el.style.display = "block");

  } catch (err) {
    console.error("[🔥 Clerk Setup Error]", err);
  }
});

const token = await session.getToken({ template: "backend" });

const res = await fetch("/api/me", {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  }
});

const userData = await res.json();
console.log("[User Data]", userData);
