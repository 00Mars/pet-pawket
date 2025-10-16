// routes/wishlistRoutes.js
import express from 'express';
import {
  getUserByEmail,
  getUserById,
  updateUser
} from '../userDB.pg.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Apply strict auth to all wishlist routes
router.use(requireAuth);

// --- helpers ---
async function resolveUserId(req, res) {
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
    return u.id;
  } catch (e) {
    console.error('[wishlist] resolveUserId error:', e);
    res.status(500).json({ error: 'User resolution failed' });
    return null;
  }
}

function normalizeHandle(handle) {
  if (typeof handle !== 'string') return null;
  const h = handle.trim();
  // Optional: enforce a simple handle format (letters, numbers, hyphen, underscore, slash)
  if (!/^[A-Za-z0-9/_-]{1,200}$/.test(h)) return null;
  return h;
}

// --- routes ---

// GET /api/wishlist
router.get('/', async (req, res) => {
  try {
    const userId = await resolveUserId(req, res);
    if (!userId) return;

    const user = await getUserById(userId);
    const wishlist = Array.isArray(user?.wishlist) ? user.wishlist : [];
    res.json({ wishlist });
  } catch (e) {
    console.error('GET /wishlist error:', e);
    res.status(500).json({ error: 'Failed to load wishlist' });
  }
});

// POST /api/wishlist  { handle: "product-handle" }
router.post('/', async (req, res) => {
  try {
    const userId = await resolveUserId(req, res);
    if (!userId) return;

    const raw = req.body?.handle;
    const handle = normalizeHandle(raw);
    if (!handle) {
      return res.status(400).json({ error: 'Invalid or missing handle' });
    }

    const user = await getUserById(userId);
    const current = Array.isArray(user?.wishlist) ? user.wishlist : [];

    // Deduplicate + cap size to avoid abuse (optional cap: 500)
    const next = Array.from(new Set([handle, ...current])).slice(0, 500);

    const updated = await updateUser(userId, { wishlist: next });
    res.status(201).json({ ok: true, wishlist: updated?.wishlist || next });
  } catch (e) {
    console.error('POST /wishlist error:', e);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// DELETE /api/wishlist/:handle
router.delete('/:handle', async (req, res) => {
  try {
    const userId = await resolveUserId(req, res);
    if (!userId) return;

    const handle = normalizeHandle(req.params?.handle);
    if (!handle) {
      return res.status(400).json({ error: 'Invalid handle' });
    }

    const user = await getUserById(userId);
    const current = Array.isArray(user?.wishlist) ? user.wishlist : [];

    // Remove requested handle; idempotent (no error if not present)
    const filtered = current.filter(h => h !== handle);

    const updated = await updateUser(userId, { wishlist: filtered });
    res.status(200).json({ ok: true, wishlist: updated?.wishlist || filtered });
  } catch (e) {
    console.error('DELETE /wishlist/:handle error:', e);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

export default router;
