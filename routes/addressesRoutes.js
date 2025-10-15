// routes/addressesRoutes.js — Shopify cookie auth; PG-backed address book (no Clerk, no frameworks)
import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  ensureUser,
  getAddressesByUserId,
  addAddress,
  updateAddressById,
  deleteAddressById,
} from '../userDB.pg.js';

const router = express.Router();
router.use(express.json({ limit: '1mb' }));
router.use(express.urlencoded({ extended: false }));
router.use(requireAuth);

async function resolveDbUser(req, res) {
  try {
    const c = req.customer;
    if (!c?.email) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    const u = await ensureUser(c.email, c.firstName || '', c.lastName || '');
    return u || null;
  } catch (e) {
    console.error('[addresses] resolveDbUser error:', e);
    res.status(500).json({ error: 'User resolution error' });
    return null;
  }
}

// GET /api/addresses → list
router.get('/', async (req, res) => {
  const dbUser = await resolveDbUser(req, res);
  if (!dbUser) return;
  try {
    const rows = await getAddressesByUserId(dbUser.id);
    res.json(rows);
  } catch (e) {
    console.error('GET /api/addresses error:', e);
    res.status(500).json({ error: 'Failed to load addresses' });
  }
});

// POST /api/addresses → create
router.post('/', async (req, res) => {
  const dbUser = await resolveDbUser(req, res);
  if (!dbUser) return;
  try {
    const a = req.body || {};
    // minimal validation
    if (!a.address1 || !a.city || !a.state || !a.postalCode || !a.country) {
      return res.status(400).json({ error: 'Missing required address fields' });
    }
    const inserted = await addAddress(dbUser.id, {
      label: a.label ?? null,
      name: a.name ?? null,
      phone: a.phone ?? null,
      address1: String(a.address1),
      address2: a.address2 ? String(a.address2) : null,
      city: String(a.city),
      state: String(a.state),
      postalCode: String(a.postalCode),
      country: String(a.country),
      isDefaultShipping: !!a.isDefaultShipping,
      isDefaultBilling:  !!a.isDefaultBilling,
    });
    if (!inserted) return res.status(500).json({ error: 'Failed to create address' });
    res.json({ ok: true, address: inserted });
  } catch (e) {
    console.error('POST /api/addresses error:', e);
    res.status(500).json({ error: 'Failed to create address' });
  }
});

// PATCH /api/addresses/:id → update (including default flags)
router.patch('/:id', async (req, res) => {
  const dbUser = await resolveDbUser(req, res);
  if (!dbUser) return;
  try {
    const id = String(req.params?.id || '');
    if (!id) return res.status(400).json({ error: 'Missing address id' });
    const patch = req.body || {};
    const updated = await updateAddressById(dbUser.id, id, patch);
    if (!updated) return res.status(404).json({ error: 'Address not found or nothing changed' });
    res.json({ ok: true, address: updated });
  } catch (e) {
    console.error('PATCH /api/addresses/:id error:', e);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

// DELETE /api/addresses/:id → remove
router.delete('/:id', async (req, res) => {
  const dbUser = await resolveDbUser(req, res);
  if (!dbUser) return;
  try {
    const id = String(req.params?.id || '');
    if (!id) return res.status(400).json({ error: 'Missing address id' });
    const ok = await deleteAddressById(dbUser.id, id);
    if (!ok) return res.status(404).json({ error: 'Address not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/addresses/:id error:', e);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// GET /api/addresses/default → { defaultShipping, defaultBilling }
router.get('/default', async (req, res) => {
  const user = await resolveDbUser(req, res); if (!user) return;
  try {
    const rows = await getAddressesByUserId(user.id);
    const defaultShipping = rows.find(r => r.isDefaultShipping) || null;
    const defaultBilling  = rows.find(r => r.isDefaultBilling)  || null;
    res.json({ defaultShipping, defaultBilling });
  } catch (e) {
    console.error('GET /api/addresses/default error:', e);
    res.status(500).json({ error: 'Failed to load defaults' });
  }
});

export default router;