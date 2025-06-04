import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';

const dbPath = './petpawket.db';

const patchUserIds = async () => {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  const users = await db.all(`SELECT email, id FROM users`);
  let patched = 0;

  for (const user of users) {
    if (!user.id) {
      const newId = uuidv4();
      await db.run(`UPDATE users SET id = ? WHERE email = ?`, [newId, user.email]);
      console.log(`Assigned ID ${newId} to ${user.email}`);
      patched++;
    }
  }

  console.log(`✅ Patched ${patched} users.`);
  await db.close();
};

patchUserIds().catch(err => console.error("Patch failed:", err));
