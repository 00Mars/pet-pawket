import express from 'express';
const router = express.Router();
import { getUserById, updateUserPets } from '../userDB.js';
import { requireAuth } from '../middleware/requireAuth.js'; // adjust path

router.post('/edit-journal-entry', requireAuth, async (req, res) => {
  const { petIndex, entryIndex, note, mood, photo, displayDate, highlighted } = req.body;
  const userId = req.user.id;

  try {
    const user = await getUserById(userId);
    if (!user?.pets?.[petIndex]) return res.status(404).json({ success: false });

    const entry = user.pets[petIndex].journal[entryIndex];
    if (!entry) return res.status(404).json({ success: false });

    if (note !== undefined) entry.note = note;
    if (mood !== undefined) entry.mood = mood;
    if (photo !== undefined) entry.photo = photo;
    if (displayDate !== undefined) entry.displayDate = displayDate;
    if (highlighted !== undefined) entry.highlighted = highlighted;

    await updateUserPets(userId, user.pets);
    res.json({ success: true });
  } catch (err) {
    console.error("[edit-journal-entry] Error:", err);
    res.status(500).json({ success: false });
  }
});

router.post('/delete-journal-entry', requireAuth, async (req, res) => {
  const { petIndex, entryIndex } = req.body;
  const userId = req.user.id;

  try {
    const user = await getUserById(userId);
    if (!user?.pets?.[petIndex]) return res.status(404).json({ success: false });

    user.pets[petIndex].journal.splice(entryIndex, 1);
    await updateUserPets(userId, user.pets);
    res.json({ success: true });
  } catch (err) {
    console.error("[delete-journal-entry] Error:", err);
    res.status(500).json({ success: false });
  }
});

export default router;