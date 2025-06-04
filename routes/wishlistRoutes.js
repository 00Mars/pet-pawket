import express from 'express';
import { getUser, updateUser } from '../userDB.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.use(requireAuth); // ✅ Apply before any route

// GET wishlist
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id; // ✅ Secure from token
  const user = await getUser(userId);
  res.json(user?.wishlist || []);
});

// ADD to wishlist
router.post('/', requireAuth, async (req, res) => {
  const { handle } = req.body;
  const userId = req.user.id;

  if (!handle || !userId) return res.status(400).send("Missing handle");

  const user = await getUser(userId);
  const wishlist = new Set(user.wishlist || []);
  wishlist.add(handle);

  await updateUser(userId, { wishlist: [...wishlist] });
  res.status(200).send("Added");
});

// REMOVE from wishlist
router.delete('/:handle', requireAuth, async (req, res) => {
  const { handle } = req.params;
  const userId = req.user.id;

  const user = await getUser(userId);
  const filtered = (user.wishlist || []).filter(h => h !== handle);

  await updateUser(userId, { wishlist: filtered });
  res.status(200).send("Removed");
});

export default router;
