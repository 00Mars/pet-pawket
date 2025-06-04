import express from 'express';
import { getUserById, updateUser } from '../userDB.js';

const router = express.Router();

// GET wishlist
router.get('/', async (req, res) => {
  const userId = req.headers['x-user-id']; // or replace with actual auth method
  const user = await getUserById(userId);
  res.json(user?.wishlist || []);
});

// ADD to wishlist
router.post('/', async (req, res) => {
  const { handle } = req.body;
  const userId = req.headers['x-user-id'];
  if (!handle || !userId) return res.status(400).send("Missing handle or user ID");

  const user = await getUserById(userId);
  const wishlist = new Set(user.wishlist || []);
  wishlist.add(handle);

  await updateUser(userId, { wishlist: [...wishlist] });
  res.status(200).send("Added");
});

// REMOVE from wishlist
router.delete('/:handle', async (req, res) => {
  const { handle } = req.params;
  const userId = req.headers['x-user-id'];
  const user = await getUserById(userId);

  const filtered = (user.wishlist || []).filter(h => h !== handle);
  await updateUser(userId, { wishlist: filtered });

  res.status(200).send("Removed");
});

export default router;

import { requireAuth } from './server.js';

router.use(requireAuth); // applies to all wishlist routes
