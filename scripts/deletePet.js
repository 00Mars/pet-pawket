// scripts/deletePet.js
// Usage: SEED_CUSTOMER_EMAIL="you@example.com" PET_ID="<uuid>" node scripts/deletePet.js
import 'dotenv/config';
import { ensureUser, deletePetById } from '../userDB.pg.js';

const EMAIL = process.env.SEED_CUSTOMER_EMAIL;
const PET_ID = process.env.PET_ID;

if (!EMAIL || !PET_ID) {
  console.error('Usage: SEED_CUSTOMER_EMAIL="you@example.com" PET_ID="<uuid>" node scripts/deletePet.js');
  process.exit(1);
}

(async () => {
  try {
    const u = await ensureUser(EMAIL, '', '');
    if (!u?.id) throw new Error('User not found for email');
    const ok = await deletePetById(u.id, PET_ID);
    console.log(ok ? `[delete] removed ${PET_ID}` : `[delete] not found: ${PET_ID}`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();