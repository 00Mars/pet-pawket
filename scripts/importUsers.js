// importUsers.js — migrate users from users.json to petpawket.db

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';

const dbPath = path.resolve('petpawket.db');
const usersJsonPath = path.resolve('users.json');
const defaultPassword = 'changeme';

async function importUsers() {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  // Ensure users table exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT,
      shopifyLinked INTEGER DEFAULT 0,
      wishlist TEXT DEFAULT '[]',
      preferences TEXT DEFAULT '{}',
      pets TEXT DEFAULT '[]',
      achievements TEXT DEFAULT '[]',
      progress TEXT DEFAULT '{}',
      activityLog TEXT DEFAULT '[]',
      hueyMemory TEXT DEFAULT '[]',
      memorials TEXT DEFAULT '[]'
    );
  `);

  // Load users.json
  const raw = fs.readFileSync(usersJsonPath, 'utf-8');
  const users = JSON.parse(raw);

  let count = 0;

  for (const email in users) {
    const user = users[email];
    const userId = `user_${Math.abs(email.hashCode())}`;
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const fields = {
      wishlist: user.wishlist || [],
      preferences: user.preferences || {},
      pets: user.pets || [],
      achievements: user.achievements || [],
      progress: user.progress || {},
      activityLog: user.activityLog || [],
      hueyMemory: user.hueyMemory || [],
      memorials: user.memorials || [{
        name: "Charm",
        type: "Dog",
        years: "2009–2024",
        tribute: "The spark that started it all ❤️"
      }],
      shopifyLinked: user.shopifyCustomerId ? 1 : 0
    };

    await db.run(`
      INSERT OR IGNORE INTO users (
        id, email, passwordHash, shopifyLinked,
        wishlist, preferences, pets, achievements,
        progress, activityLog, hueyMemory, memorials
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      email,
      passwordHash,
      fields.shopifyLinked,
      JSON.stringify(fields.wishlist),
      JSON.stringify(fields.preferences),
      JSON.stringify(fields.pets),
      JSON.stringify(fields.achievements),
      JSON.stringify(fields.progress),
      JSON.stringify(fields.activityLog),
      JSON.stringify(fields.hueyMemory),
      JSON.stringify(fields.memorials)
    ]);

    console.log(`✅ Imported: ${email}`);
    count++;
  }

  console.log(`\n✅ ${count} users migrated.`);
  await db.close();
}

// Helper to get a simple hash code from email
String.prototype.hashCode = function() {
  let hash = 0, i, chr;
  for (i = 0; i < this.length; i++) {
    chr = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash;
};

importUsers().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
