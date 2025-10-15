function parseJSON(raw, fallback) {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}

function parsePets(raw) {
  const pets = parseJSON(raw, []);
  return pets.map(pet => ({
    name: pet.name || '',
    type: pet.type || '',
    breed: pet.breed || '',
    birthday: pet.birthday || '',
    mood: pet.mood || 'Happy',
    persona: pet.persona || 'Unset',
    avatar: pet.avatar || '',
    badges: pet.badges || [],
    journal: (pet.journal || []).map(entry => ({
      date: entry.date || new Date().toLocaleString('en-US', {
        dateStyle: 'medium', timeStyle: 'short'
      }),
      displayDate: entry.displayDate || '',
      note: entry.note || '',
      mood: entry.mood || 'Happy',
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      photo: entry.photo || null,
      highlighted: entry.highlighted === true
    }))
  }));
}

function parsePreferences(raw) {
  const fallback = {'theme': 'light', 'showActivityFeed': true, 'notifications': {'email': true, 'sms': false}};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return fallback;
    return parsed;
  } catch (e) {
    return fallback;
  }
}

function parseWishlist(raw) {
  const fallback = [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return fallback;
    return parsed.map(item => ({
      id: item.id || '',
      title: item.title || '',
      type: item.type || 'product',
      notes: item.notes || '',
      added: item.added || new Date().toISOString()
    }));
  } catch (e) {
    return fallback;
  }
}


function parseAchievements(raw) {
  const fallback = [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return fallback;
    return parsed;
  } catch (e) {
    return fallback;
  }
}


function parseProgress(raw) {
  const fallback = {'profile': 0, 'pets': 0, 'orders': 0, 'charity': 0};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return fallback;
    return parsed;
  } catch (e) {
    return fallback;
  }
}


function parseMemorials(raw) {
  const fallback = [{'name': 'Charm', 'type': 'Dog', 'years': '2009–2024', 'tribute': 'The spark that started it all ❤️', 'subtributes': [], 'linkedEvents': [], 'resonance': []}];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return fallback;
    return parsed;
  } catch (e) {
    return fallback;
  }
}


function parseHueyMemory(raw) {
  const fallback = [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return fallback;
    return parsed;
  } catch (e) {
    return fallback;
  }
}


function parseActivityLog(raw) {
  const fallback = [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return fallback;
    return parsed;
  } catch (e) {
    return fallback;
  }
}


export {
  parsePets,
  parsePreferences,
  parseAchievements,
  parseWishlist,
  parseProgress,
  parseMemorials,
  parseHueyMemory,
  parseActivityLog
};
