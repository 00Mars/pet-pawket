<<<<<<< HEAD
// routes/userRoute.js — robust /me endpoint (Shopify-auth required)

import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getUserByEmail } from '../userDB.pg.js';

const router = express.Router();

const ALLOWED_FIELDS = new Set([
  'id',
  'email',
  'firstName',
  'lastName',
  'avatar',
  'shopifyLinked',
  'preferences',
  'achievements',
  'progress',
  'activityLog',
  'hueyMemory',
  'memorials',
  'wishlist',
  'createdAt',
  'updatedAt',
]);

const DEFAULT_FIELDS = [
  'id',
  'email',
  'firstName',
  'lastName',
  'avatar',
  'createdAt',
  'updatedAt',
];

function project(user, fields) {
  if (!user) return null;
  if (!fields || fields.length === 0) {
    return Object.fromEntries(DEFAULT_FIELDS.map(k => [k, user[k]]));
  }
  if (fields === '*') return user; // explicit: caller asked for full object
  const list = String(fields)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // validate requested fields
  for (const f of list) {
    if (!ALLOWED_FIELDS.has(f)) {
      const sorted = Array.from(ALLOWED_FIELDS).sort().join(', ');
      const msg = `Invalid field "${f}". Allowed: ${sorted} or "*" for all.`;
      const err = new Error(msg);
      err.status = 400;
      throw err;
    }
  }
  return Object.fromEntries(list.map(k => [k, user[k]]));
}

/**
 * GET /me
 * Auth: required (validated via Shopify cookie)
 * Query:
 *   - fields (optional): comma-separated whitelist of fields, or "*" for all
 */
router.get('/me', requireAuth, async (req, res) => {  // ✅ fix: pass middleware by reference
  // prevent caching of personalized data
  res.set('Cache-Control', 'no-store');
  res.set('Vary', 'Cookie');

  try {
    // email comes from validated Shopify customer (middleware)
    const email = req.customer?.email;
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const fields = req.query.fields; // e.g., "id,email,firstName" or "*"
    const payload = project(user, fields);
    return res.json(payload);
  } catch (err) {
    if (err?.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[GET /me] error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
=======
// routes/userRoute.js

import express from 'express';
import { requireAuth } from '../server.js';
import { getUserById } from '../userDB.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('[GET /user] Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
>>>>>>> c2470ba (Initial real commit)
