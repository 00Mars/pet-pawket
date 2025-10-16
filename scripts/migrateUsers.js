// migrateUsers.js — one-time script to add password hashes to legacy users

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';

const dbPath = 'petpawket.db';
const DEFAULT_PASSWORD = 'changeme'; // You can instruct users to reset it after

async function runMigration() {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  const users = await db.all('SELECT id, email, passwordHash FROM users');

  let updated = 0;

  for (const user of users) {
    if (!user.passwordHash) {
      const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      await db.run('UPDATE users SET passwordHash = ? WHERE id = ?', [hash, user.id]);
      console.log(`✅ Updated user ${user.email}`);
      updated++;
    }
  }

  console.log(`\nDone. Updated ${updated} user(s).`);
  await db.close();
}

runMigration().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
