// routes/accountBack.js — Clerk-free, JWT-free, Shopify-cookie auth

import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  getUserByEmail,
  getUserById,
  updateUser
} from '../userDB.pg.js';

const router = express.Router();

// Apply strict auth to all routes in this module
router.use(requireAuth());

// Helper: resolve DB user from validated Shopify customer
async function resolveDbUser(req, res) {
  try {
    const email = req.customer?.email;
    if (!email) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    const u = await getUserByEmail(email);
    if (!u?.id) {
      res.status(404).json({ error: 'User not found' });
      return null;
    }
    return u;
  } catch (e) {
    console.error('[accountBack] resolveDbUser error:', e);
    res.status(500).json({ error: 'User resolution failed' });
    return null;
  }
}

// GET /api/account/me  → current identity (Shopify + DB id)
router.get('/me', async (req, res) => {
  const dbUser = await resolveDbUser(req, res);
  if (!dbUser) return;

  // req.customer comes from Shopify validation (id/email/firstName/lastName)
  const c = req.customer;
  res.json({
    customer: {
      id: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName
    },
    db: { id: dbUser.id }
  });
});

// GET /api/account/profile  → full profile from Postgres
router.get('/profile', async (req, res) => {
  const dbUser = await resolveDbUser(req, res);
  if (!dbUser) return;

  // Re-read to ensure freshest data (optional)
  const fresh = await getUserById(dbUser.id);
  res.json({
    id: fresh.id,
    email: fresh.email,
    firstName: fresh.firstName,
    lastName: fresh.lastName,
    preferences: fresh.preferences ?? {},
    achievements: fresh.achievements ?? [],
    progress: fresh.progress ?? {},
    activityLog: fresh.activityLog ?? [],
    hueyMemory: fresh.hueyMemory ?? {},
    memorials: fresh.memorials ?? [],
    wishlist: fresh.wishlist ?? [],
    avatar: fresh.avatar ?? null,
    shopifyLinked: !!fresh.shopifyLinked,
    createdAt: fresh.createdAt,
    updatedAt: fresh.updatedAt
  });
});

// PUT /api/account/profile  → partial update (safe, whitelisted)
router.put('/profile', async (req, res) => {
  const dbUser = await resolveDbUser(req, res);
  if (!dbUser) return;

  // Whitelist + light validation
  const allowed = {
    firstName: v => typeof v === 'string',
    lastName: v => typeof v === 'string',
    preferences: v => v && typeof v === 'object',
    achievements: v => Array.isArray(v),
    progress: v => v && typeof v === 'object',
    activityLog: v => Array.isArray(v),
    hueyMemory: v => v && typeof v === 'object',
    memorials: v => Array.isArray(v),
    wishlist: v => Array.isArray(v),
    avatar: v => (v === null) || (typeof v === 'string'),
    shopifyLinked: v => typeof v === 'boolean'
  };

  const patch = {};
  for (const [k, v] of Object.entries(req.body || {})) {
    if (k in allowed && allowed[k](v)) patch[k] = v;
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    const updated = await updateUser(dbUser.id, patch);
    res.json({
      ok: true,
      profile: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        preferences: updated.preferences ?? {},
        achievements: updated.achievements ?? [],
        progress: updated.progress ?? {},
        activityLog: updated.activityLog ?? [],
        hueyMemory: updated.hueyMemory ?? {},
        memorials: updated.memorials ?? [],
        wishlist: updated.wishlist ?? [],
        avatar: updated.avatar ?? null,
        shopifyLinked: !!updated.shopifyLinked,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      }
    });
  } catch (e) {
    console.error('PUT /account/profile error:', e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;

/*
Notes:
- Login is implemented in server.js (/api/auth/login and /api/login aliases).
- This file assumes server mounts it like: app.use('/api/account', accountBackRouter)
  so routes become:
    GET  /api/account/me
    GET  /api/account/profile
    PUT  /api/account/profile
*/
