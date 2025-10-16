x// routes/journalRoutes.js — Shopify-only auth; Clerk removed

import express from 'express';
const router = express.Router();

import {
  getUserByEmail,
  getUserById,
  updateUser,    // try saving pets as JSONB if available
  updatePet      // fallback: replace pets via relational table
} from '../userDB.pg.js';

import { requireAuth } from '../middleware/requireAuth.js';

// Apply Shopify token validation to the entire router
router.use(requireAuth);  // ✅ no parentheses

// Resolve DB user.id from validated Shopify customer email
async function resolveUserId(req, res) {
  const email = req.customer?.email;
  if (!email) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return null;
  }
  const u = await getUserByEmail(email);
  if (!u?.id) {
    res.status(404).json({ success: false, error: 'User not found' });
    return null;
  }
  return u.id;
}

// Utility: ensure integer index
function toIndex(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// Utility: persist pets array with dual-path (JSONB vs relational)
async function persistPets(userId, pets) {
  // First try JSONB 'users.pets' if your schema has it
  try {
    const saved = await updateUser(userId, { pets });
    if (saved) return true;
  } catch (_) {
    // ignore and fall back
  }
  // Fallback to relational replacement
  await updatePet(userId, pets);
  return true;
}

/**
 * POST /edit-journal-entry
 * body: { petIndex, entryIndex, note?, mood?, photo?, displayDate?, highlighted? }
 * Updates fields on a specific journal entry.
 */
router.post('/edit-journal-entry', async (req, res) => {
  const {
    petIndex: piRaw,
    entryIndex: eiRaw,
    note,
    mood,
    photo,
    displayDate,
    highlighted
  } = req.body || {};

  const petIndex = toIndex(piRaw);
  const entryIndex = toIndex(eiRaw);
  if (petIndex === null || entryIndex === null) {
    return res.status(400).json({ success: false, error: 'Invalid petIndex or entryIndex' });
  }

  const userId = await resolveUserId(req, res);
  if (!userId) return;

  try {
    const user = await getUserById(userId);
    // Expect pets JSON on the user; create scaffolding if missing
    if (!Array.isArray(user?.pets)) user.pets = [];
    if (!user.pets[petIndex]) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }
    const pet = user.pets[petIndex];
    if (!Array.isArray(pet.journal)) pet.journal = [];

    const entry = pet.journal[entryIndex];
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Journal entry not found' });
    }

    // Apply partial updates only for provided fields
    if (note !== undefined) entry.note = note;
    if (mood !== undefined) entry.mood = mood;
    if (photo !== undefined) entry.photo = photo;
    if (displayDate !== undefined) entry.displayDate = displayDate;
    if (highlighted !== undefined) entry.highlighted = highlighted;

    await persistPets(userId, user.pets);
    res.json({ success: true });
  } catch (err) {
    console.error('[edit-journal-entry] Error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * POST /delete-journal-entry
 * body: { petIndex, entryIndex }
 * Deletes a specific journal entry.
 */
router.post('/delete-journal-entry', async (req, res) => {
  const { petIndex: piRaw, entryIndex: eiRaw } = req.body || {};
  const petIndex = toIndex(piRaw);
  const entryIndex = toIndex(eiRaw);
  if (petIndex === null || entryIndex === null) {
    return res.status(400).json({ success: false, error: 'Invalid petIndex or entryIndex' });
  }

  const userId = await resolveUserId(req, res);
  if (!userId) return;

  try {
    const user = await getUserById(userId);
    if (!Array.isArray(user?.pets)) user.pets = [];
    if (!user.pets[petIndex]) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }
    const pet = user.pets[petIndex];
    if (!Array.isArray(pet.journal)) pet.journal = [];

    if (!pet.journal[entryIndex]) {
      return res.status(404).json({ success: false, error: 'Journal entry not found' });
    }

    pet.journal.splice(entryIndex, 1);
    await persistPets(userId, user.pets);
    res.json({ success: true });
  } catch (err) {
    console.error('[delete-journal-entry] Error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;