// public/auth.js — unified Shopify cookie auth (no Clerk/localStorage)
// [auth.js] v5 — sets data-auth on <html> and <body>, and force‑shows all signed‑in gated sections

console.info('[auth.js] v5');

const bus = new EventTarget();

function emitAuthChanged(detail) {
  try { bus.dispatchEvent(new CustomEvent('auth:changed', { detail })); }
  catch (e) { console.warn('[auth] emitAuthChanged error:', e); }
}

export function onAuthChange(handler) {
  const h = (e) => handler?.(e.detail);
  bus.addEventListener('auth:changed', h);
  return () => bus.removeEventListener('auth:changed', h);
}

/* ---------------- Session helpers ---------------- */
export async function getSession() {
  try {
    const res = await fetch('/api/session', {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { signedIn: false };
    const data = await res.json();
    return { signedIn: !!data?.signedIn, customer: data?.customer || null };
  } catch (err) {
    console.warn('[auth.getSession] error:', err);
    return { signedIn: false };
  }
}

export async function login(email, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      const error = data?.error || 'Invalid credentials';
      throw new Error(error);
    }
    emitAuthChanged({ action: 'login' });
    return data;
  } catch (err) {
    emitAuthChanged({ action: 'login-failed', error: err.message });
    throw err;
  }
}

export async function logout() {
  try {
    await fetch('/logout', { method: 'POST', credentials: 'include', cache: 'no-store' });
  } catch (err) {
    console.warn('[auth.logout] error:', err);
  } finally {
    emitAuthChanged({ action: 'logout' });
  }
}

/* ---------------- UI paint ---------------- */
function toggle(el, show) {
  if (!el) return;
  el.classList.toggle('hidden', !show);
  el.classList.toggle('d-none', !show);
  if (show) el.style.removeProperty('display');
}

function setDataAuthAttr(signedIn) {
  const val = signedIn ? 'signed-in' : 'signed-out';
  const htmlEl = document.documentElement;
  const bodyEl = document.body;
  if (htmlEl) htmlEl.setAttribute('data-auth', val);
  if (bodyEl) bodyEl.setAttribute('data-auth', val);
  if (bodyEl) {
    bodyEl.classList.toggle('authenticated', signedIn);
    bodyEl.classList.toggle('guest', !signedIn);
  }
}

/**
 * Remove any "requires-auth" class (which forces display:none via CSS)
 * and show the element by clearing inline display styles. Only run
 * this when the user is signed in.
 */
function forceShowSignedInBlocks(signedIn) {
  if (!signedIn) return;
  const selectors = [
    '.requires-auth',
    '[data-auth-visible="signed-in"]',
    '[data-auth="signed-in"]',
  ];
  document.querySelectorAll(selectors.join(',')).forEach((el) => {
    el.classList.remove('requires-auth', 'hidden', 'd-none');
    el.style.removeProperty('display');
  });
}

export async function updateAuthDisplay() {
  const session = await getSession();
  const signedIn = !!session.signedIn;
  const name = session.customer?.firstName
    ? `${session.customer.firstName} ${session.customer?.lastName ?? ''}`.trim()
    : session.customer?.email || '';

  setDataAuthAttr(signedIn);

  // Toggle explicit blocks
  document.querySelectorAll('[data-auth="signed-in"]').forEach((el) => toggle(el, signedIn));
  document.querySelectorAll('[data-auth="signed-out"]').forEach((el) => toggle(el, !signedIn));

  // Navbar sections
  toggle(document.getElementById('auth-menu-user'), signedIn);
  toggle(document.getElementById('auth-menu-guest'), !signedIn);

  // Populate account name labels
  ['[data-auth="account-name"]','#accountName','.account-name','#account-name'].forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      el.textContent = signedIn ? (name || 'Account') : 'Sign in';
    });
  });

  // Generic gating
  document.querySelectorAll('.requires-auth,[data-auth-visible="signed-in"]').forEach((el) => toggle(el, signedIn));
  document.querySelectorAll('.requires-guest,[data-auth-visible="signed-out"]').forEach((el) => toggle(el, !signedIn));

  // Force show stubborn blocks
  forceShowSignedInBlocks(signedIn);

  const statusEl = document.getElementById('auth-status');
  if (statusEl) {
    statusEl.textContent = signedIn
      ? `Signed in as ${name || 'customer'}`
      : 'You are not signed in.';
  }
  return session;
}

/* ---------------- Global wiring for login/logout forms ---------------- */
if (!window.__authUIWired) {
  window.__authUIWired = true;

  document.addEventListener('submit', async (e) => {
    const form = e.target?.closest('#loginForm, #login-form, [data-auth="login-form"]');
    if (!form) return;
    e.preventDefault();
    const email = form.querySelector('input[name="email"], input[type="email"]')?.value?.trim() || '';
    const password = form.querySelector('input[name="password"], input[type="password"]')?.value || '';
    const msg = form.querySelector('[data-login-msg]') || document.querySelector('[data-login-msg]');
    try {
      await login(email, password);
      if (msg) msg.textContent = 'Signed in!';
      form.closest('.custom-modal, .modal')?.classList.add('hidden');
      await updateAuthDisplay();
    } catch (err) {
      if (msg) msg.textContent = err.message || 'Login failed';
    }
  });

  document.addEventListener('click', async (e) => {
    const cont = e.target?.closest('[data-action="login-continue"]');
    if (cont) {
      e.preventDefault();
      const scope = cont.closest('form, .modal, .custom-modal') || document;
      const email = scope.querySelector('input[name="email"], input[type="email"]')?.value?.trim() || '';
      const password = scope.querySelector('input[name="password"], input[type="password"]')?.value || '';
      const msg = scope.querySelector('[data-login-msg]') || document.querySelector('[data-login-msg]');
      try {
        await login(email, password);
        if (msg) msg.textContent = 'Signed in!';
        cont.closest('.custom-modal, .modal')?.classList.add('hidden');
        await updateAuthDisplay();
      } catch (err) {
        if (msg) msg.textContent = err.message || 'Login failed';
      }
      return;
    }
    const out = e.target?.closest('#logoutBtn, #logout-btn, [data-action="logout"]');
    if (out) {
      e.preventDefault();
      await logout();
      await updateAuthDisplay();
    }
  });

  onAuthChange(async () => { await updateAuthDisplay(); });
}