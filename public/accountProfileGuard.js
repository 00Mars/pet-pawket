/**
 * Account Profile Guard — v2
 * Runs AFTER account.js. If first/last/email are still empty, it tries:
 *  1) Profile-like endpoints: /api/account/profile, /api/profile, /api/user, /api/me, /api/account, /api/customer
 *  2) Shopify-style customer: { customer: { first_name, last_name, email, default_address } }
 *  3) Addresses endpoints: /api/account/addresses, /api/addresses, /api/customer/addresses
 *  4) DOM fallbacks (email label above), then name-from-email ONLY if obvious (first.last or first_last or first-last)
 *
 * Non-invasive: never attaches form handlers; only fills if fields are empty.
 */

(function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const $ = (sel) => document.querySelector(sel);
  const $id = (id) => document.getElementById(id);

  const fName = $id('profileFirstName');
  const lName = $id('profileLastName');
  const email = $id('profileEmail');
  const emailLabel = $('[data-auth-user-email]');

  if (!fName || !lName || !email) return;

  // Helper: write only if empty and value is non-empty
  const setIfEmpty = (input, val) => {
    const v = String(val || '').trim();
    if (!input || !v) return;
    if (!input.value) input.value = v;
  };

  // Normalize common API shapes into {first,last,mail}
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj && obj[k] != null && String(obj[k]).trim() !== '') return String(obj[k]).trim();
    }
    return '';
  };

  function normalizeProfile(raw) {
    if (!raw || typeof raw !== 'object') return {};
    // Common containers
    let src = raw.profile || raw.user || raw.data || raw.customer || raw.account || raw;

    let first = pick(src, ['firstName', 'first_name', 'given_name', 'firstname']);
    let last  = pick(src, ['lastName', 'last_name', 'family_name', 'lastname']);
    let mail  = pick(src, ['email', 'emailAddress', 'email_address']);

    // Shopify default_address fallback
    if ((!first || !last) && src.default_address) {
      first ||= pick(src.default_address, ['first_name', 'firstName']);
      last  ||= pick(src.default_address,  ['last_name', 'lastName']);
    }

    // If we still don't have names, try a top-level `name`
    if ((!first || !last) && src.name) {
      const parts = String(src.name).trim().split(/\s+/);
      if (!first) first = parts[0] || '';
      if (!last && parts.length > 1) last = parts.slice(1).join(' ');
    }

    // Shopify-style wrapper: { customer: {...} }
    if ((!first || !last || !mail) && raw.customer) {
      const c = raw.customer;
      first ||= pick(c, ['first_name', 'firstName']);
      last  ||= pick(c, ['last_name', 'lastName']);
      mail  ||= pick(c, ['email']);
      if ((!first || !last) && c.default_address) {
        first ||= pick(c.default_address, ['first_name', 'firstName']);
        last  ||= pick(c.default_address,  ['last_name', 'lastName']);
      }
    }

    return { first, last, mail };
  }

  async function fetchJson(url) {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  // Try a list of endpoints, return the first normalized profile that yields any data
  async function tryProfiles() {
    const endpoints = [
      '/api/account/profile',
      '/api/profile',
      '/api/user',
      '/api/me',
      '/api/account',
      '/api/customer'
    ];
    for (const url of endpoints) {
      try {
        const j = await fetchJson(url);
        const p = normalizeProfile(j);
        if (p.first || p.last || p.mail) return p;
      } catch {}
    }
    return {};
  }

  // Addresses fallbacks (to pull first/last from default)
  async function tryAddresses() {
    const endpoints = [
      '/api/account/addresses',
      '/api/addresses',
      '/api/customer/addresses'
    ];
    for (const url of endpoints) {
      try {
        const j = await fetchJson(url);
        const list = Array.isArray(j?.addresses) ? j.addresses : (Array.isArray(j) ? j : []);
        // Prefer default
        let def = list.find(a => a.default || a.default_address || a.isDefault);
        if (!def && list.length) def = list[0];
        if (def) {
          return {
            first: pick(def, ['first_name', 'firstName']),
            last:  pick(def, ['last_name', 'lastName']),
            mail:  pick(def, ['email'])
          };
        }
      } catch {}
    }
    return {};
  }

  // Final fallback: derive a name ONLY if the email looks like "first.last@"
  function nameFromEmail(mail) {
    if (!mail || !/@/.test(mail)) return {};
    const local = mail.split('@')[0];
    if (!local) return {};
    // Only split if clear separators are present
    const sep = local.includes('.') ? '.' : (local.includes('_') ? '_' : (local.includes('-') ? '-' : ''));
    if (!sep) return {}; // avoid guessing from "jcwvaughn"
    const parts = local.split(sep).filter(Boolean);
    if (parts.length < 2) return {};
    const first = titleCase(parts[0]);
    const last  = titleCase(parts.slice(1).join(' '));
    return { first, last };
  }

  function titleCase(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/(^|\s|[-_])/g, m => m.trim() ? m : ' ')
      .replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
  }

  async function run() {
    // Give account.js a moment to populate if it’s already working
    await wait(150);

    const already =
      (fName.value && fName.value.trim()) ||
      (lName.value && lName.value.trim()) ||
      (email.value && email.value.trim());

    // Always set email from the label if empty (it was showing for you)
    if (!email.value && emailLabel) {
      const lbl = (emailLabel.textContent || '').trim();
      if (/@/.test(lbl)) email.value = lbl;
    }
    if (already && fName.value && lName.value) return;

    // 1) Try profile endpoints
    let prof = await tryProfiles();
    setIfEmpty(fName, prof.first);
    setIfEmpty(lName,  prof.last);
    setIfEmpty(email,  prof.mail);

    // 2) If still missing names, try addresses
    if (!fName.value || !lName.value) {
      const addr = await tryAddresses();
      setIfEmpty(fName, addr.first);
      setIfEmpty(lName,  addr.last);
      setIfEmpty(email,  addr.mail);
    }

    // 3) Last resort: infer from email when obvious (first.last)
    if ((!fName.value || !lName.value) && email.value) {
      const guess = nameFromEmail(email.value);
      setIfEmpty(fName, guess.first);
      setIfEmpty(lName,  guess.last);
    }
  }

  run().catch(() => {});
})();
