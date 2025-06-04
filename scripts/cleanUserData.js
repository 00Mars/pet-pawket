// insertCurrentUser.js
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';

const dbPath = path.resolve('petpawket.db');
const jsonPath = path.resolve('users.json');
const defaultPassword = 'changeme'; // temporary password

async function insertUser(email) {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const users = JSON.parse(raw);

  const user = users[email];
  if (!user) {
    console.error(`❌ No user found with email: ${email}`);
    process.exit(1);
  }

  const userId = `user_${Math.abs(email.hashCode())}`;
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const pets = user.pets || [];
  const fields = {
    wishlist: user.wishlist || [],
    preferences: user.preferences || {},
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
    INSERT OR REPLACE INTO users (
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
    JSON.stringify(pets),
    JSON.stringify(fields.achievements),
    JSON.stringify(fields.progress),
    JSON.stringify(fields.activityLog),
    JSON.stringify(fields.hueyMemory),
    JSON.stringify(fields.memorials)
  ]);

  console.log(`✅ User ${email} inserted.`);
  await db.close();
}

// string hash like previous import
String.prototype.hashCode = function () {
  let hash = 0, i, chr;
  for (i = 0; i < this.length; i++) {
    chr = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash;
};

insertUser('jon.bonin@gmail.com').catch(err => {
  console.error('❌ Insert failed:', err);
});
