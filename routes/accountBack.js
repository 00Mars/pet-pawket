// routes/accountBack.js — Clerk-free, Shopify-cookie auth with safe user resolution

import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  getUserByEmail,
  getUserById,
  updateUser,
  ensureUserByEmail,   // <- create-on-miss helper
} from '../userDB.pg.js';

const router = express.Router();

// All routes require a valid Shopify customer token
router.use(requireAuth);  // ✅ pass middleware by reference

// Resolve DB user from validated Shopify customer (create if missing)
async function resolveDbUser(req, res) {
  try {
    const c = req.customer; // set by requireAuth()
    const email = c?.email;
    if (!email) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }

    // Idempotent: ensure a row exists and return it
    const user = await ensureUserByEmail(
      email,
      c?.firstName || '',
      c?.lastName || ''
    );
    return user; // full row with id/fields
  } catch (e) {
    console.error('[accountBack] resolveDbUser error:', e);
    res.status(500).json({ error: 'User resolution error' });
    return null;
  }
}

// GET /api/account/me – echo current identity (Shopify + DB id)
router.get('/me', async (req, res) => {
  const dbUser = await resolveDbUser(req, res);
  if (!dbUser) return;
  const c = req.customer;
  res.json({
    customer: {
      id: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
    },
    db: { id: dbUser.id },
  });
});

// GET /api/account/profile – full profile from Postgres
router.get('/profile', async (req, res) => {
  const dbUser = await resolveDbUser(req, res);
  if (!dbUser) return;

  const fresh = await getUserById(dbUser.id);
  res.json({
    id: fresh.id,
    email: fresh.email,
    firstName: fresh.firstName,
    lastName: fresh.lastName,
    preferences: fresh?.preferences ?? {},
    achievements: fresh?.achievements ?? [],
    progress: fresh?.progress ?? {},
    activityLog: fresh?.activityLog ?? [],
    hueyMemory: fresh?.hueyMemory ?? {},
    memorials: fresh?.memorials ?? [],
    wishlist: fresh?.wishlist ?? [],
    avatar: fresh?.avatar ?? null,
    shopifyLinked: !!fresh?.shopifyLinked,
    createdAt: fresh?.createdAt,
    updatedAt: fresh?.updatedAt,
  });
});

// PUT /api/account/profile – safe partial update
router.put('/profile', async (req, res) => {
  const dbUser = await resolveDbUser(req, res);
  if (!dbUser) return;

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
    avatar: v => v === null || typeof v === 'string',
    shopifyLinked: v => typeof v === 'boolean',
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
    res.json({ ok: true, profile: updated });
  } catch (e) {
    console.error('PUT /api/account/profile error:', e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;