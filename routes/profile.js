// routes/profile.js — Canonical Profile endpoints using userDB.pg.js
// Mounted at /api in server.js so paths are:
//   GET  /api/account/profile
//   POST /api/account/profile/update-info

import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  getUserByEmail,
  ensureUserByEmail,
  updateUser,
} from '../userDB.pg.js';

const router = express.Router();

// Everything here requires a valid Shopify session
router.use(requireAuth);

// GET /api/account/profile
router.get('/account/profile', async (req, res) => {
  try {
    const email = req.customer?.email;
    if (!email) return res.status(401).json({ error: 'No session' });

    // Ensure a row exists; seed with Shopify names if needed
    await ensureUserByEmail(email, {
      firstName: req.customer?.firstName || req.customer?.first_name || '',
      lastName : req.customer?.lastName  || req.customer?.last_name  || '',
    });

    const user = await getUserByEmail(email);
    // Normalize the minimal shape expected by account.js
    return res.json({
      email: user?.email || email,
      firstName: user?.firstName || '',
      lastName : user?.lastName  || '',
    });
  } catch (err) {
    console.error('[profile:get]', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// POST /api/account/profile/update-info
router.post('/account/profile/update-info', async (req, res) => {
  try {
    const email = req.customer?.email;
    if (!email) return res.status(401).json({ error: 'No session' });

    const firstName = (req.body?.firstName ?? '').toString().trim();
    const lastName  = (req.body?.lastName  ?? '').toString().trim();

    // Find user id, then patch with camelCase keys (DB layer remaps to snake_case)
    const user = await getUserByEmail(email);
    if (!user?.id) {
      // If for some reason it doesn't exist, ensure then re-fetch
      await ensureUserByEmail(email, { firstName, lastName });
    }
    const fresh = await getUserByEmail(email);
    const updated = await updateUser(fresh.id, { firstName, lastName });

    // Return the canonical minimal response for the profile form
    return res.json({
      email: updated?.email || email,
      firstName: updated?.firstName || '',
      lastName : updated?.lastName  || '',
    });
  } catch (err) {
    console.error('[profile:update-info]', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
