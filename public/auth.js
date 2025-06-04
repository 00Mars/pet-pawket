export async function fetchCurrentUser() {
  const token = localStorage.getItem("authToken");
  if (!token) {
    console.warn("[auth] No token found. Skipping fetch.");
    return null;
  }

  try {
    const res = await fetch("/api/me", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      console.warn(`[auth] /api/me failed (${res.status}). Removing token.`);
      localStorage.removeItem("authToken");
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("[auth] Error fetching current user:", err);
    localStorage.removeItem("authToken");
    return null;
  }
}

export async function updateAuthDisplay() {
  const status = document.getElementById("auth-status");
  if (!status) {
    console.warn("[auth] No #auth-status element found.");
    return;
  }

  const user = await fetchCurrentUser();

  if (user && user.email) {
    status.textContent = `[auth] Logged in as: ${user.email}`;
  } else {
    status.textContent = "[auth] Guest mode";
  }
}

export async function logout() {
  try {
    const res = await fetch("/logout", {
      method: "POST",
      credentials: "include"
    });

    if (res.ok) {
      console.log("[logout] User logged out");
      localStorage.clear(); // 🔄 clear token + UI consistency
      updateAuthDisplay();
    } else {
      console.warn("[logout] Server logout failed");
    }
  } catch (err) {
    console.error("[logout] Error during logout:", err);
  }
}
