// userDB.js — Updated for relational pets/journal_entries structure

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.resolve('petpawket.db');
let db;

export async function initDB() {
  db = await open({ filename: dbPath, driver: sqlite3.Database });
}

function scaffoldUser(user) {
  return {
    id: user.id || '',
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    shopifyCustomerId: user.shopifyCustomerId || null,
    preferences: parseJSON(user.preferences, { theme: 'light', showActivityFeed: true }),
    wishlist: parseJSON(user.wishlist, []),
    pets: parseJSON(user.pets, []),
    achievements: parseJSON(user.achievements, []),
    progress: parseJSON(user.progress, { profile: 0, pets: 0, orders: 0 }),
    activityLog: parseJSON(user.activityLog, []),
    hueyMemory: parseJSON(user.hueyMemory, []),
    memorials: parseJSON(user.memorials, [
      {
        name: "Charm",
        type: "Dog",
        years: "2009–2024",
        tribute: "The spark that started it all ❤️"
      }
    ])
  };
}

function parseJSON(raw, fallback) {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}

// -- USERS --

export async function getUser(email) {
  const row = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  return row ? scaffoldUser(row) : null;
}

export async function getUserById(id) {
  const row = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  return row ? scaffoldUser(row) : null;
}

export async function getUserByEmail(email) {
  return await getUser(email);
}

export async function getAllUsers() {
  const rows = await db.all('SELECT * FROM users');
  return rows.map(scaffoldUser);
}

export async function updateUser(email, data) {
  const existing = await getUser(email) || { email };
  const updated = scaffoldUser({ ...existing, ...data });
  await db.run(
    `INSERT OR REPLACE INTO users (
      id, email, passwordHash, shopifyLinked,
      wishlist, pets, preferences, achievements,
      progress, activityLog, hueyMemory, memorials
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      updated.id,
      updated.email,
      updated.passwordHash || null,
      updated.shopifyLinked ? 1 : 0,
      JSON.stringify(updated.wishlist),
      JSON.stringify(updated.pets),
      JSON.stringify(updated.preferences),
      JSON.stringify(updated.achievements),
      JSON.stringify(updated.progress),
      JSON.stringify(updated.activityLog),
      JSON.stringify(updated.hueyMemory),
      JSON.stringify(updated.memorials)
    ]
  );
  return updated;
}

// -- PETS --

export async function getPetsByUserId(userId) {
  return await db.all('SELECT * FROM pets WHERE userId = ?', [userId]);
}

export async function getPetById(petId) {
  return await db.get('SELECT * FROM pets WHERE id = ?', [petId]);
}

export async function addPet(userId, petData) {
  const id = crypto.randomUUID();
  await db.run(
    `INSERT INTO pets (id, userId, name, type, breed, birthday, mood, persona, avatar)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      petData.name,
      petData.type,
      petData.breed,
      petData.birthday,
      petData.mood || 'Happy',
      petData.persona || 'Unset',
      petData.avatar || ''
    ]
  );
  return id;
}

export async function updatePet(petId, updates) {
  await db.run(
    `UPDATE pets SET name = ?, type = ?, breed = ?, birthday = ?, mood = ?, persona = ?, avatar = ?
     WHERE id = ?`,
    [
      updates.name,
      updates.type,
      updates.breed,
      updates.birthday,
      updates.mood,
      updates.persona,
      updates.avatar,
      petId
    ]
  );
}

export async function deletePet(petId) {
  await db.run(`DELETE FROM pets WHERE id = ?`, [petId]);
}

// LEGACY PATCH: Disable pets array logic
export function updateUserPets(userId, newPets) {
  console.warn("updateUserPets is deprecated due to schema normalization.");
  return false;
}
