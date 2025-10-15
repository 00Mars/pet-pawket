// server.js — Express 5, ESM, cookie-based Shopify auth (no Clerk), Postgres profile

import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// ✅ Use the shared DB layer (camelCase⇄snake_case handled here)
import { ensureUser, getUserByEmail, updateUser } from './userDB.pg.js';

import { requireAuth, softSession } from './middleware/requireAuth.js';
import addressesRouter from './routes/addressesRoutes.js';
import productsRouter from './routes/productsRoutes.js';
import searchRouter from './routes/searchRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import petsRoutes from './routes/petsRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';

const app = express();
const PORT = process.env.PORT || 3001;

const NODE_ENV = process.env.NODE_ENV || 'development';
const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⛔ Disable ETags for dynamic responses (prevents 304 on JSON APIs)
app.set('etag', false);

// Body parsers (once)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/api/pets', petsRoutes);
app.use('/api/wishlist', wishlistRoutes);

// 🔒 No-store for all API routes (dynamic data should never be cached by the browser)
function apiNoStore(_req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}
app.use('/api', apiNoStore);

// Static (keep normal caching for assets)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Addresses API (mounted early so 404s are obvious) ------------------------
app.use('/api/addresses', addressesRouter);
console.log('[mount] /api/addresses');

// --- Products proxy API -------------------------------------------------------
app.use('/api/products', productsRouter);
console.log('[mount] /api/products');

// --- Search API ---------------------------------------------------------------
app.use('/api/search', searchRouter);
console.log('[mount] /api/search');

// --- Cart API (PG-backed) -----------------------------------------------------
app.use('/api/cart', cartRoutes);
console.log('[mount] /api/cart]');

// --- Shopify helpers ----------------------------------------------------------
const SF_ENDPOINT = `https://${SHOPIFY_DOMAIN}/api/2024-07/graphql.json`;

async function shopifyGQL(query, variables) {
  const res = await fetch(SF_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  return json;
}

function setTokenCookie(res, token, maxDays = 30) {
  const maxAge = maxDays * 24 * 60 * 60 * 1000;
  // Express 5 supports res.cookie without cookie-parser
  res.cookie?.('shopify_token', token, {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  }) || res.setHeader(
    'Set-Cookie',
    `shopify_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(
      maxAge / 1000
    )}${NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

function clearTokenCookie(res) {
  res.cookie?.('shopify_token', '', {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  }) || res.setHeader(
    'Set-Cookie',
    `shopify_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

// --- Health -------------------------------------------------------------------
app.get('/health', (_req, res) => res.json({ ok: true }));

// --- Auth ---------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password required' });

    const mutation = /* GraphQL */ `
      mutation Login($input: CustomerAccessTokenCreateInput!) {
        customerAccessTokenCreate(input: $input) {
          customerAccessToken { accessToken, expiresAt }
          customerUserErrors { field, message, code }
        }
      }
    `;
    const resp = await shopifyGQL(mutation, { input: { email, password } });
    const payload = resp?.data?.customerAccessTokenCreate;

    theToken: {
      const token = payload?.customerAccessToken?.accessToken;
      const errMsg = payload?.customerUserErrors?.[0]?.message;
      if (!token) {
        res.status(401).json({ ok: false, error: errMsg || 'Invalid credentials' });
        break theToken;
      }
      setTokenCookie(res, token);

      // ✅ Seed/ensure user row via shared DB layer (normalize email case)
      const normalizedEmail = String(email).trim().toLowerCase();
      await ensureUser(normalizedEmail, '', '');

      res.json({ ok: true });
    }
  } catch (err) {
    console.error('[login] error:', err);
    return res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

app.post('/logout', (req, res) => {
  clearTokenCookie(res);
  res.json({ ok: true });
});

app.get('/api/session', softSession);

app.get('/api/me', requireAuth, async (req, res) => {
  res.json({ customer: req.customer });
});

/* --------- Name normalization helpers (fixes old JSON-blob saves) --------- */
function parseNameMaybeJSON(s, key) {
  if (typeof s !== 'string') return s ?? '';
  const t = s.trim();
  if (!t.startsWith('{') || !t.endsWith('}')) return t;
  try {
    const o = JSON.parse(t);
    // Prefer exact key, but accept common variants
    return (
      o?.[key] ??
      (key === 'firstName'
        ? (o.first_name || o.given_name || o.first)
        : (o.last_name || o.family_name || o.last)) ??
      ''
    );
  } catch {
    return t;
  }
}

/* --- Profile API (PG-backed; uses shared DB and lowercased email) ----------- */
app.get('/api/account/profile', requireAuth, async (req, res) => {
  try {
    const emailRaw = req.customer?.email;
    if (!emailRaw) return res.status(401).json({ error: 'No session' });
    const email = String(emailRaw).trim().toLowerCase();

    // Make sure we have a row, seeding with Shopify names if available
    await ensureUser(
      email,
      req.customer?.firstName || req.customer?.first_name || '',
      req.customer?.lastName  || req.customer?.last_name  || ''
    );

    const u = await getUserByEmail(email);
    const clean = {
      email: u?.email || email,
      firstName: parseNameMaybeJSON(u?.firstName ?? '', 'firstName'),
      lastName : parseNameMaybeJSON(u?.lastName  ?? '', 'lastName'),
    };

    // If normalization changed values, persist the clean ones silently
    if (clean.firstName !== (u?.firstName ?? '') || clean.lastName !== (u?.lastName ?? '')) {
      await updateUser(u.id, { firstName: clean.firstName, lastName: clean.lastName });
    }

    res.json(clean);
  } catch (e) {
    console.error('[profile:get] error:', e);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.post('/api/account/profile/update-info', requireAuth, async (req, res) => {
  try {
    const emailRaw = req.customer?.email;
    if (!emailRaw) return res.status(401).json({ error: 'No session' });
    const email = String(emailRaw).trim().toLowerCase();

    // Coerce & sanitize
    const rawFirst = (req.body?.firstName ?? '').toString();
    const rawLast  = (req.body?.lastName  ?? '').toString();

    const firstName = parseNameMaybeJSON(rawFirst, 'firstName').trim();
    const lastName  = parseNameMaybeJSON(rawLast,  'lastName').trim();

    // Ensure a row exists, then update via shared helper by id
    const user = await ensureUser(email, '', '');
    await updateUser(user.id, { firstName, lastName });

    const fresh = await getUserByEmail(email);
    res.json({
      email: fresh?.email || email,
      firstName: fresh?.firstName ?? null,
      lastName: fresh?.lastName ?? null,
    });
  } catch (e) {
    console.error('[profile:update] error:', e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// --- Orders (Shopify) ---------------------------------------------------------
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const query = /* GraphQL */ `
      query Orders($token: String!) {
        customer(customerAccessToken: $token) {
          orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {
            edges {
              node {
                id
                name
                orderNumber
                processedAt
                statusUrl
                totalPriceV2 { amount currencyCode }
                lineItems(first: 20) { edges { node { title quantity } } }
              }
            }
          }
        }
      }
    `;
    const j = await shopifyGQL(query, { token: req.customerToken });
    const edges = j?.data?.customer?.orders?.edges || [];
    const orders = edges.map(e => e.node);
    res.json(orders);
  } catch (err) {
    console.error('[orders] error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ---------- Shop listing HTML entry (moved from /products to /shop) -----------
app.get('/shop', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'shop.html'));
});
// Back-compat redirects for old paths:
app.get(['/products', 'shop.html'], (_req, res) => res.redirect(301, '/shop'));

// --- Product detail HTML entry (kept: /products/:handle and /product/:handle) -
app.get(['/products/:handle', '/product/:handle'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

// Optional: canonicalize /product.html?handle=... to pretty route
app.get('/shop.html', (req, res) => {
  const handle = String(req.query.handle || '');
  if (handle) return res.redirect(302, `/products/${encodeURIComponent(handle)}`);
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

// --- Pets/Wishlist/Journal routes (mounted if present) ------------------------
try {
  const petsRoutes = (await import('./routes/petsRoutes.js')).default;
  app.use('/api/pets', petsRoutes);
  console.log('[mount] /api/pets');
} catch (e) {
  // optional
}

try {
  const journalRoutes = (await import('./routes/journalRoutes.js')).default;
  // Legacy/compat profile+journal endpoints (user & pet journals)
  app.use('/api/profile', journalRoutes);
  console.log('[mount] /api/profile');
} catch (e) {
  // optional
}

try {
  const wishlistRoutes = (await import('./routes/wishlistRoutes.js')).default;
  app.use('/api/wishlist', wishlistRoutes);
  console.log('[mount] /api/wishlist');
} catch (e) {
  // optional
}

// HTML entry points always available
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/navbar.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'navbar.html'));
});

app.listen(PORT, () => {
  console.log(`[server] up on http://localhost:${PORT}`);
});