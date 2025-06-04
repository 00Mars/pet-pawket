import express from 'express';
import { getUser, updateUser } from '../userDB.js';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import { requireAuth } from '../middleware/requireAuth.js';

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
