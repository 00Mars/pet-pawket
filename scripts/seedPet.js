// scripts/seedPet.js
// Seed a pet tied to a real user row using userDB.pg.js helpers.
// Usage:
//   SEED_CUSTOMER_EMAIL="you@example.com" node scripts/seedPet.js
// Optional env:
//   SEED_PET_NAME="Luna" SEED_PET_SPECIES="dog" SEED_PET_BREED="Husky" SEED_PET_BIRTHDAY="2019-04-01"

import 'dotenv/config';
import { ensureUser, addPet, getPetsByUserId } from '../userDB.pg.js';

const EMAIL = process.env.SEED_CUSTOMER_EMAIL;
if (!EMAIL) {
  console.error('Set SEED_CUSTOMER_EMAIL env var to an email that will own the pet.');
  process.exit(1);
}

const PET_NAME     = process.env.SEED_PET_NAME     || 'Luna';
const PET_SPECIES  = process.env.SEED_PET_SPECIES  || 'dog';
const PET_BREED    = process.env.SEED_PET_BREED    || null;
const PET_BIRTHDAY = process.env.SEED_PET_BIRTHDAY || null; // 'YYYY-MM-DD' or null

(async () => {
  try {
    const u = await ensureUser(EMAIL, '', '');
    if (!u?.id) throw new Error('ensureUser returned no id');
    console.log('[seed] user id:', u.id);

    const pet = await addPet(EMAIL, {
      name: PET_NAME,
      species: PET_SPECIES,
      breed: PET_BREED,
      birthday: PET_BIRTHDAY,
    });
    console.log('[seed] inserted pet:', pet);

    const pets = await getPetsByUserId(u.id);
    console.log('[seed] pets for user:', pets.map(p => ({ id: p.id, name: p.name, species: p.species })));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();