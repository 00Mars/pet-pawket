// routes/signup-route.js
import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import { createUser, getUserByEmail } from '../userDB.pg.js';

const router = express.Router();
const SHOPIFY_API_ENDPOINT = `https://${process.env.SHOPIFY_DOMAIN}/api/2024-04/graphql.json`;

// --- tiny utils ---
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const httpOnlyCookie = (res, name, value, days = 30) => {
  const maxAge = days * 24 * 60 * 60 * 1000;
  // set secure:true behind HTTPS / reverse proxy
  res.cookie(name, value, { httpOnly: true, sameSite: 'Lax', secure: false, maxAge });
};

async function shopifyGraphQL(query, variables) {
  const resp = await fetch(SHOPIFY_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Shopify HTTP ${resp.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function handleSignup(req, res) {
  try {
    // 1) Validate env
    if (!process.env.SHOPIFY_DOMAIN || !process.env.SHOPIFY_STOREFRONT_TOKEN) {
      return res.status(500).json({ error: 'Shopify environment not configured' });
    }

    // 2) Validate input
    const email = (req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password || '';
    const firstName = (req.body?.firstName || '').trim();
    const lastName = (req.body?.lastName || '').trim();

    if (!isEmail(email)) return res.status(400).json({ error: 'Valid email is required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (firstName.length > 100 || lastName.length > 100) {
      return res.status(400).json({ error: 'Name fields are too long' });
    }

    // 3) Shopify: create customer
    const createQuery = `
      mutation customerCreate($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
          customer { id email }
          customerUserErrors { field message }
        }
      }
    `;
    const createVars = { input: { email, password, firstName, lastName } };
    const createRes = await shopifyGraphQL(createQuery, createVars);

    const createPayload = createRes?.data?.customerCreate;
    const createErrors = createPayload?.customerUserErrors || [];

    if (!createPayload?.customer && createErrors.length) {
      // common cases: email taken, invalid password, etc.
      const msg = createErrors.map(e => e?.message).filter(Boolean).join('; ') || 'Signup failed';
      return res.status(400).json({ error: msg });
    }
    if (!createPayload?.customer) {
      return res.status(502).json({ error: 'Unexpected response from Shopify during signup' });
    }

    // 4) Shopify: auto-login (create customerAccessToken)
    const tokenQuery = `
      mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
        customerAccessTokenCreate(input: $input) {
          customerAccessToken { accessToken, expiresAt }
          customerUserErrors { message }
        }
      }
    `;
    const tokenVars = { input: { email, password } };
    const tokenRes = await shopifyGraphQL(tokenQuery, tokenVars);

    const tokenPayload = tokenRes?.data?.customerAccessTokenCreate;
    const tokenErrors = tokenPayload?.customerUserErrors || [];
    const token = tokenPayload?.customerAccessToken?.accessToken || null;

    if (!token && tokenErrors.length) {
      // Signed up, but auto-login failed — surface the reason
      const msg = tokenErrors.map(e => e?.message).filter(Boolean).join('; ');
      // Still continue to upsert local user and return 200 with ok:false? Better to be explicit:
      return res.status(200).json({
        ok: false,
        error: `Account created but auto-login failed: ${msg}`,
        user: { email, firstName, lastName }
      });
    }
    if (!token) {
      return res.status(502).json({ error: 'Unexpected response from Shopify during auto-login' });
    }

    // 5) Set HttpOnly cookie (auth)
    httpOnlyCookie(res, 'shopify_token', token);

    // 6) Upsert local user (no local password stored)
    let dbUser = await getUserByEmail(email);
    if (!dbUser) {
      dbUser = await createUser({ email, firstName, lastName, password: null });
    }

    // 7) Respond (keep legacy alias 'token' for FE compatibility)
    return res.json({
      ok: true,
      shopifyAccessToken: token,
      token, // legacy alias
      user: dbUser
        ? { id: dbUser.id, email: dbUser.email, firstName: dbUser.firstName, lastName: dbUser.lastName }
        : { email, firstName, lastName }
    });
  } catch (err) {
    console.error('[/api/auth/signup] error:', err);
    // Normalize error message
    const msg = (err && err.message) ? String(err.message) : 'Internal server error';
    return res.status(500).json({ error: msg });
  }
}

// Mount canonical + legacy paths
router.post('/api/auth/signup', handleSignup);
router.post('/signup', handleSignup); // legacy alias

export default router;