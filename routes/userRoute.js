// routes/userRoute.js

import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
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
