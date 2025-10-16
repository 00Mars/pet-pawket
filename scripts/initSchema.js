<<<<<<< HEAD
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbPath = path.resolve('petpawket.db');

async function init() {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

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

  console.log("✅ users table created (or already exists).");
  await db.close();
}

init().catch(err => {
  console.error("Schema init failed:", err);
  process.exit(1);
});
=======
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbPath = path.resolve('petpawket.db');

async function init() {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

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

  console.log("✅ users table created (or already exists).");
  await db.close();
}

init().catch(err => {
  console.error("Schema init failed:", err);
  process.exit(1);
});
>>>>>>> c2470ba (Initial real commit)
