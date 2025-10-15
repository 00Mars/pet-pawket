// routes/petsRoutes.js — Pets API with diagnostic error echo and raw row view.
import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  ensureUser,
  getPetsByUserId,
  addPet,
  updatePetById,
  deletePetById,
  getPetJournal,
  addPetJournalEntry,
  updatePetJournalEntry,
  deletePetJournalEntry,
  getPetJournalEntryById,
} from '../userDB.pg.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storefrontFetch } from '../utils/shopify.js';
import pkg from 'pg';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'pets');

router.use(express.json({ limit: '10mb' }));
router.use(express.urlencoded({ extended: false }));
router.use(requireAuth);

/* ---------------- helpers ---------------- */
const csv = v =>
  Array.isArray(v)
    ? v.map(x => String(x).trim()).filter(Boolean)
    : String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);

function toISODate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

function coerceSex(raw) {
  const val = raw?.sex ?? raw?.gender ?? raw?.traits?.sex ?? raw?.traits?.gender;
  if (val === undefined) return undefined;
  if (val === null) return null;
  const v = String(val).trim().toLowerCase();
  if (['f','female','girl'].includes(v)) return 'female';
  if (['m','male','boy'].includes(v))    return 'male';
  if (['unknown','n/a',''].includes(v))  return null;
  return v; // already canonical? accept
}

function coerceSpayNeuter(raw) {
  const val = raw?.spayedNeutered ?? raw?.spayNeuter ?? raw?.spayed ?? raw?.neutered ?? raw?.traits?.spayNeuter;
  if (val === undefined) return undefined;
  if (val === null) return null;
  if (val === true || val === false) return !!val;
  const s = String(val).trim().toLowerCase();
  if (['1','true','yes','y','t','spayed','neutered','fixed'].includes(s)) return true;
  // map 'intact' and negative forms to false; treat unknown/empty as null (unknown)
  if (['0','false','no','n','f','intact'].includes(s)) return false;
  if (['unknown','n/a',''].includes(s)) return null;
  return null;
}

function weightKg(raw) {
  const kg = raw?.weight_kg ?? raw?.weightKg;
  if (kg != null && isFinite(Number(kg))) return Number(kg);
  const lb = raw?.weightLb ?? raw?.traits?.weightLb;
  if (lb != null && isFinite(Number(lb))) return Math.round(Number(lb) * 0.45359237 * 1000) / 1000;
  return undefined;
}

function buildPatch(body) {
  const p = {};
  if (body.name     !== undefined) p.name     = String(body.name).trim() || null;
  if (body.species  !== undefined) p.species  = String(body.species).trim() || null;
  if (body.breed    !== undefined) p.breed    = String(body.breed).trim() || null;
  if (body.avatar   !== undefined) p.avatar   = body.avatar || null;
  if (body.notes    !== undefined) p.notes    = String(body.notes ?? '');

  if (body.size     !== undefined) p.size = String(body.size ?? '').trim() || null;
  const chew = body.chew_strength ?? body.chewStrength;
  if (chew !== undefined && chew !== null && chew !== '') {
    const n = Number(chew);
    if (Number.isFinite(n)) p.chew_strength = Math.max(1, Math.min(5, Math.round(n)));
  }

  const b = toISODate(body.birthday) || toISODate(body.birthdate) || toISODate(body.dob) || null;
  if (body.birthday !== undefined || body.birthdate !== undefined || body.dob !== undefined) {
    p.birthday = b; p.birthdate = b;
  }

  const sex = coerceSex(body);
  if (sex !== undefined) p.sex = sex;
  const spn = coerceSpayNeuter(body);
  if (spn !== undefined) p.spayed_neutered = spn;

  const kg = weightKg(body);
  if (kg !== undefined) p.weight_kg = kg;

  // --- FIXED LINE (corruption caused 500s) ---
  if (body.allergies !== undefined || body?.traits?.allergies !== undefined) {
    p.allergies = csv(body.allergies ?? body?.traits?.allergies ?? []);
  }
  // ------------------------------------------

  if (body.dislikes !== undefined) {
    p.dislikes = csv(body.dislikes ?? []);
  }
  if (body.toyPrefs !== undefined || body.toy_prefs !== undefined) {
    p.toy_prefs = csv(body.toyPrefs ?? body.toy_prefs ?? []);
  }
  if (body.food_prefs !== undefined || body.likes !== undefined || body?.traits?.flavors !== undefined) {
    p.food_prefs = csv(body.food_prefs ?? body.likes ?? body?.traits?.flavors ?? []);
  }

  if (body.traits !== undefined) {
    const t = typeof body.traits === 'string' ? JSON.parse(body.traits || '{}') : (body.traits || {});
    p.traits = t;
  }
  return p;
}

function lens(p) {
  const kg = p?.weight_kg == null ? null : Number(p.weight_kg);
  const lb = kg == null ? null : Math.round((kg / 0.45359237) * 10) / 10;
  const spn = p?.spayedNeutered ?? p?.spayed_neutered ?? null;
  const sex = p?.sex ?? null;

  // Preserve original spay/neuter enumeration from traits if provided; fallback to boolean mapping
  let spayEnum;
  if (p?.traits && p.traits.spayNeuter !== undefined) {
    spayEnum = p.traits.spayNeuter;
  } else {
    if (spn === true) {
      if (sex === 'female') spayEnum = 'spayed';
      else if (sex === 'male') spayEnum = 'neutered';
      else spayEnum = 'spayed';
    } else if (spn === false) {
      spayEnum = 'intact';
    } else {
      spayEnum = 'unknown';
    }
  }

  return {
    ...p,
    spayedNeutered: spn,
    traits: {
      ...(p.traits || {}),
      sex,
      gender: sex,
      spayNeuter: spayEnum,
      fixed: spn === true ? true : (spn === false ? false : null),
      weightLb: lb,
      flavors: (p.food_prefs || []).map(String),
      allergies: (p.allergies || []).map(String),
    },
  };
}

/* ---------------- list/create ---------------- */
router.get('/', async (req, res) => {
  const user = await ensureUser(req.customer.email, req.customer.firstName || '', req.customer.lastName || '');
  const pets = await getPetsByUserId(user.id);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache'); res.set('Expires', '0');
  res.json((pets || []).map(lens));
});

router.post('/', async (req, res) => {
  const c = req.customer;
  const raw = req.body || {};
  const name = String(raw.name ?? raw.petName ?? '').trim();
  const species = String(raw.species ?? raw.type ?? raw.petType ?? '').trim();
  const breed = raw.breed ? String(raw.breed).trim() : null;
  const birthday = toISODate(raw.birthday) || toISODate(raw.birthdate) || toISODate(raw.dob) || null;
  if (!name || !species) return res.status(400).json({ error: 'Missing required fields: name, species' });

  let inserted = await addPet(c.email, { name, species, breed, birthday });
  // Immediately apply any extras passed on create
  const patch = buildPatch(raw);
  delete patch.name; delete patch.species; delete patch.breed; delete patch.birthday; delete patch.birthdate;
  if (Object.keys(patch).length) {
    inserted = (await updatePetById(inserted.userId || inserted.user_id, inserted.id, patch)) || inserted;
  }
  res.json({ ok: true, pet: lens(inserted) });
});

/* ---------------- update/delete ---------------- */
async function doUpdate(req, res) {
  try {
    const user = await ensureUser(req.customer.email, req.customer.firstName || '', req.customer.lastName || '');
    const petId = String(req.params.id || '');
    if (!petId) return res.status(400).json({ error: 'Missing pet id' });

    const patch = buildPatch(req.body || {});
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'No fields to update' });

    const updated = await updatePetById(user.id, petId, patch);
    if (!updated) return res.status(404).json({ error: 'Pet not found' });
    return res.json({ ok: true, pet: lens(updated) });
  } catch (e) {
    console.error('PATCH /api/pets/:id error:', e);
    // TEMP (dev): echo raw message so we can see the real cause in the browser
    return res.status(500).json({ error: e?.message || 'Failed to update pet' });
  }
}
router.patch('/:id', doUpdate);
router.put('/:id',   doUpdate);
// accept legacy POST-to-resource as update
router.post('/:id',  doUpdate);

router.delete('/:id', async (req, res) => {
  const user = await ensureUser(req.customer.email, req.customer.firstName || '', req.customer.lastName || '');
  const ok = await deletePetById(user.id, String(req.params.id || ''));
  if (!ok) return res.status(404).json({ error: 'Pet not found' });
  res.json({ ok: true });
});

export default router;