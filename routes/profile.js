<<<<<<< HEAD
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
=======
import express from 'express';
import { getUser, updateUser } from '../userDB.js';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import { requireAuth } from '../server.js';

const router = express.Router();
router.use(requireAuth); // ✅ Apply once globally

// 📸 Multer setup
const journalUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/journal'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
      cb(null, name);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
}).single('photo');

// 🧠 GET /api/profile
import { getUserByEmail } from '../userDB.js';

router.get('/', requireAuth, async (req, res) => {
  const user = await getUserByEmail(req.user.email); // 🔄 Correct method
  if (!user) return res.status(404).json({ error: 'Profile not found' });
  res.json(user);
});


// 📝 Update name
router.post('/update-info', requireAuth, async (req, res) => {
  const { firstName, lastName } = req.body;
  const user = await getUser(req.user.email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await updateUser(req.user.email, { firstName, lastName });
  res.json({ success: true });
});

// 🐾 Add Pet
router.post('/add-pet', requireAuth, async (req, res) => {
  const { name, type, birthday } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Missing fields' });

  const user = await getUser(req.user.email);
  const newPet = {
    name, type, birthday,
    mood: 'Happy', persona: 'Unset', avatar: '',
    journal: [], badges: []
  };

  user.pets.push(newPet);
  await updateUser(req.user.email, user);
  res.json({ success: true, pet: newPet });
});

// 🐾 Update Pet
router.post('/update-pet', requireAuth, async (req, res) => {
  const { index, updatedPet } = req.body;
  const user = await getUser(req.user.email);

  const oldAvatar = user.pets[index]?.avatar;
  if (oldAvatar && !updatedPet.avatar && oldAvatar.startsWith('/uploads/avatars/')) {
    const filePath = path.join(process.cwd(), 'public', oldAvatar);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  user.pets[index] = { ...user.pets[index], ...updatedPet };
  await updateUser(req.user.email, user);
  res.json({ success: true });
});

// ❌ Delete Pet
router.post('/delete-pet', requireAuth, async (req, res) => {
  const { index } = req.body;
  const user = await getUser(req.user.email);
  user.pets.splice(index, 1);
  await updateUser(req.user.email, user);
  res.json({ success: true });
});

// 📷 Upload avatar
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/avatars'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
      cb(null, name);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});

router.post('/upload-avatar', avatarUpload.single('avatar'), requireAuth, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const originalPath = req.file.path;
  const compressedPath = path.join('public/uploads/avatars', `compressed-${req.file.filename}.jpg`);

  try {
    await sharp(originalPath)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(compressedPath);

    fs.unlinkSync(originalPath);
    const avatarPath = `/uploads/avatars/${path.basename(compressedPath)}`;
    res.json({ success: true, avatar: avatarPath });
  } catch (err) {
    console.error('[avatar compress]', err);
    res.status(500).json({ error: 'Image processing failed' });
  }
});

// 🧠 Add journal
router.post('/add-journal-entry', requireAuth, async (req, res) => {
  const { index, note, mood = 'Happy', tags = [], photo = null } = req.body;
  const user = await getUser(req.user.email);
  const pet = user.pets[index];
  if (!pet) return res.status(404).json({ error: 'Pet not found' });

  const timestamp = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const entry = { date: timestamp, note, mood, tags, photo };
  pet.journal = pet.journal || [];
  pet.journal.unshift(entry);

  await updateUser(req.user.email, user);
  res.json({ success: true });
});

// ✏️ Edit journal
router.post('/edit-journal-entry', requireAuth, async (req, res) => {
  const { petIndex, entryIndex, note, mood, tags, photo, displayDate, highlighted } = req.body;
  const user = await getUser(req.user.email);
  const pet = user.pets[petIndex];
  const entry = pet?.journal?.[entryIndex];

  if (!pet || !entry) return res.status(404).json({ error: 'Entry not found' });

  if (typeof note === 'string') entry.note = note.trim();
  if (typeof mood === 'string') entry.mood = mood;
  if (Array.isArray(tags)) entry.tags = tags.slice(0, 10);
  if (photo === null || typeof photo === 'string') entry.photo = photo;
  if (typeof displayDate === 'string') entry.displayDate = displayDate.trim();
  if (typeof highlighted === 'boolean') entry.highlighted = highlighted;

  await updateUser(req.user.email, user);
  res.json({ success: true });
});

// ❌ Delete journal
router.post('/delete-journal-entry', requireAuth, async (req, res) => {
  const { petIndex, entryIndex } = req.body;
  const user = await getUser(req.user.email);
  if (!user.pets[petIndex]) return res.status(404).json({ error: 'Pet not found' });

  user.pets[petIndex].journal.splice(entryIndex, 1);
  await updateUser(req.user.email, user);
  res.json({ success: true });
});

export default router;
>>>>>>> c2470ba (Initial real commit)
