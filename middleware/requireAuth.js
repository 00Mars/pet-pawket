// middleware/requireAuth.js
// Shopify Storefront cookie auth (no Clerk). Resilient to network timeouts.
// Exports: softSession (non-blocking), requireAuth (blocking)
// Node 20 / ESM

import fetch from 'node-fetch';

// --- Env & constants ----------------------------------------------------------
const RAW_DOMAIN = process.env.SHOPIFY_DOMAIN || ''; // e.g. "your-shop.myshopify.com"
const SHOPIFY_DOMAIN = sanitizeDomain(RAW_DOMAIN);
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN || '';
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-07';
const SF_ENDPOINT = `https://${SHOPIFY_DOMAIN}/api/${API_VERSION}/graphql.json`;

// 5s default timeout; override with SHOPIFY_TIMEOUT_MS
const TIMEOUT_MS = Number.parseInt(process.env.SHOPIFY_TIMEOUT_MS || '5000', 10);
// 10 minutes default cache TTL; override with SHOPIFY_AUTH_CACHE_TTL_MS
const CACHE_TTL_MS = Number.parseInt(process.env.SHOPIFY_AUTH_CACHE_TTL_MS || '600000', 10);

// --- Tiny in-memory cache keyed by access token -------------------------------
/** Map<token, { customer: {email, firstName, lastName, id}, ts:number }> */
const tokenCache = new Map();

// --- Public: softSession ------------------------------------------------------
/**
 * GET /api/session uses this.
 * Never throws; returns { signedIn:false } on any failure.
 */
export async function softSession(req, res) {
  try {
    const token = readCookie(req, 'shopify_token');
    if (!token) return res.json({ signedIn: false });

    const customer = await getCustomerSafe(token);
    if (!customer) return res.json({ signedIn: false });

    // Stash on req for any downstream route that might rely on it
    req.customerToken = token;
    req.customer = customer;

    return res.json({
      signedIn: true,
      email: customer.email || null,
      firstName: customer.firstName || null,
      lastName: customer.lastName || null,
    });
  } catch (err) {
    // Do not crash session endpoint; just report signed out
    console.warn('[softSession] degraded:', briefError(err));
    return res.json({ signedIn: false });
  }
}

// --- Public: requireAuth ------------------------------------------------------
/**
 * Middleware to guard API routes.
 * - 401 on missing/invalid token
 * - 503 on Shopify network timeout (unless we have a cached customer, then continue)
 *
 * Defensive wrapper:
 *   - If someone mistakenly calls requireAuth() as a factory,
 *     we return the actual middleware function (no crash).
 */
export function requireAuth(...args) {
  // Factory-usage guard: allow router.use(requireAuth()) and router.use(requireAuth)
  if (args.length !== 3 || !args[0] || !args[1] || !args[2]) {
    return (req, res, next) => requireAuth(req, res, next);
  }

  const [req, res, next] = args;

  (async () => {
    try {
      const token = readCookie(req, 'shopify_token');
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      try {
        const customer = await getCustomerStrict(token);
        req.customerToken = token;
        req.customer = customer;
        return next();
      } catch (err) {
        // On network timeout, try cache as a graceful fallback
        if (isTimeout(err)) {
          const cached = getCached(token);
          if (cached) {
            console.warn('[requireAuth] Shopify timeout; using cached customer for token.');
            req.customerToken = token;
            req.customer = cached;
            return next();
          }
          console.error('[requireAuth] timeout to Shopify with no cache:', briefError(err));
          return res.status(503).json({ error: 'Shopify auth timeout' });
        }

        // Invalid token or other auth failure → 401
        if (isUnauthorized(err)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Unexpected errors
        console.error('[requireAuth] error:', err);
        return res.status(500).json({ error: 'Auth verification failed' });
      }
    } catch (outer) {
      console.error('[requireAuth] outer error:', outer);
      try {
        return res.status(500).json({ error: 'Auth middleware error' });
      } catch {
        // If res is somehow not usable, bubble up
        return next(outer);
      }
    }
  })();
}

// --- Internals: Shopify -------------------------------------------------------
async function getCustomerStrict(token) {
  const cached = getCached(token);
  if (cached) return cached;

  const customer = await fetchCustomerWithRetry(token);
  if (!customer) throw unauthorized('Missing customer');

  setCached(token, customer);
  return customer;
}

async function getCustomerSafe(token) {
  const cached = getCached(token);
  if (cached) return cached;

  try {
    const customer = await fetchCustomerWithRetry(token);
    if (!customer) return null;
    setCached(token, customer);
    return customer;
  } catch (err) {
    // On timeout or network errors, soft path returns null
    if (isTimeout(err)) return null;
    if (isUnauthorized(err)) return null;
    console.warn('[getCustomerSafe] non-fatal error:', briefError(err));
    return null;
  }
}

async function fetchCustomerWithRetry(token, retries = 1) {
  try {
    return await fetchCustomer(token);
  } catch (err) {
    if (retries > 0 && (isTimeout(err) || isTransient(err))) {
      await sleep(200); // tiny backoff
      return fetchCustomerWithRetry(token, retries - 1);
    }
    throw err;
  }
}

async function fetchCustomer(token) {
  if (!SHOPIFY_DOMAIN || !STOREFRONT_TOKEN) {
    throw new Error('Shopify env not configured: SHOPIFY_DOMAIN/SHOPIFY_STOREFRONT_TOKEN');
  }

  const query = /* GraphQL */ `
    query WhoAmI($token: String!) {
      customer(customerAccessToken: $token) {
        id
        email
        firstName
        lastName
      }
    }
  `;

  const json = await fetchWithTimeout(
    SF_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables: { token } }),
    },
    TIMEOUT_MS
  );

  // Network-level .ok check is inside fetchWithTimeout; here we inspect body
  if (!json || json.errors) {
    // If Storefront returns errors for an invalid token, treat as 401
    const message = (json?.errors && JSON.stringify(json.errors)) || 'Unknown GraphQL error';
    const e = new Error(message);
    e.status = 401;
    throw e;
  }

  const customer = json?.data?.customer;
  if (!customer || !customer.email) {
    const e = new Error('No customer for token');
    e.status = 401;
    throw e;
  }

  // Return a normalized object (only what we actually use)
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
  };
}

// --- Helpers: fetch with timeout ---------------------------------------------
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text().catch(() => '');
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.body = text;
      throw err;
    }
    return json;
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('ETIMEDOUT');
      e.code = 'ETIMEDOUT';
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

// --- Helpers: cookie, cache, errors ------------------------------------------
function readCookie(req, key) {
  const raw = req?.headers?.cookie || '';
  if (!raw) return null;
  // naive parse; fine for a single key
  const parts = raw.split(/;\s*/);
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (decodeURIComponent(k) === key) {
      try { return decodeURIComponent(v || ''); } catch { return v || ''; }
    }
  }
  return null;
}

function sanitizeDomain(domain) {
  return String(domain || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

function setCached(token, customer) {
  tokenCache.set(token, { customer, ts: Date.now() });
}

function getCached(token) {
  const hit = tokenCache.get(token);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    tokenCache.delete(token);
    return null;
  }
  return hit.customer;
}

function isTimeout(err) {
  return err?.code === 'ETIMEDOUT' || err?.name === 'AbortError';
}

function isUnauthorized(err) {
  return err?.status === 401;
}

function isTransient(err) {
  // network-y issues we might retry once
  return ['ECONNRESET', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH'].includes(err?.code);
}

function unauthorized(msg = 'Unauthorized') {
  const e = new Error(msg);
  e.status = 401;
  return e;
}

function briefError(err) {
  const base = err?.message || String(err);
  const code = err?.code ? ` code=${err.code}` : '';
  const status = err?.status ? ` status=${err.status}` : '';
  return `${base}${code}${status}`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default { softSession, requireAuth };