async function handleLogin(email, password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (res.ok) {
    localStorage.setItem("authToken", data.token);
    localStorage.setItem("currentUserId", data.user.id);
    // redirect or show dashboard
  } else {
    alert(data.message || "Login failed");
  }
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  await handleLogin(email, password);
});
