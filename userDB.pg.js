// userDB.pg.js — Postgres-only data access (ESM, Clerk-free)
import bcrypt from 'bcrypt';
import pkg from 'pg';
const { Pool } = pkg;

/* -------------------- Pool init -------------------- */
function normalizeConnString(raw) {
  if (!raw) return raw;
  // safety for earlier placeholder "@host:"
  return raw.replace('@host:', '@localhost:');
}

function normalizeTags(input) {
  if (input === undefined) return undefined;
  if (Array.isArray(input)) return input.map(s => String(s).trim()).filter(Boolean);
  if (typeof input === 'string') return input.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

const connectionString = normalizeConnString(process.env.DATABASE_URL);
const useSSL = process.env.PGSSLMODE === 'require'
  ? { rejectUnauthorized: false }
  : undefined;

const pool = new Pool({ connectionString, ssl: useSSL });

// one-time sanitized boot log (no secrets)
try {
  const url = new URL(connectionString);
  const safe = `${url.protocol}//${url.username ? '***@' : ''}${url.hostname}:${url.port}${url.pathname}`;
  console.log('[DB] pool init →', safe, useSSL ? '(ssl=require)' : '(ssl=off)');
} catch { /* ignore */ }

/* -------------------- Common projection -------------------- */
const SELECT_USER =
  `id,
   email,
   first_name AS "firstName",
   last_name  AS "lastName",
   preferences,
   achievements,
   progress,
   activity_log AS "activityLog",
   huey_memory  AS "hueyMemory",
   memorials,
   wishlist,
   avatar,
   shopify_linked AS "shopifyLinked",
   created_at    AS "createdAt",
   updated_at    AS "updatedAt"`;

// Normalizes a row to always have sensible defaults
function mapUserRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    email: r.email,
    firstName: r.firstName ?? '',
    lastName: r.lastName ?? '',
    preferences: r.preferences ?? {},
    achievements: r.achievements ?? [],
    progress: r.progress ?? {},
    activityLog: r.activityLog ?? [],
    hueyMemory: r.hueyMemory ?? {},
    memorials: r.memorials ?? [],
    wishlist: r.wishlist ?? [],
    avatar: r.avatar ?? null,
    shopifyLinked: !!r.shopifyLinked,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/* -------------------- Users: getters & ensure -------------------- */
export async function getUserByEmail(email) {
  const q = `SELECT ${SELECT_USER} FROM users WHERE email = $1 LIMIT 1;`;
  const { rows } = await pool.query(q, [email]);
  return rows[0] || null;
}

export async function getUserById(id) {
  const q = `SELECT ${SELECT_USER} FROM users WHERE id = $1 LIMIT 1;`;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
}

/** Idempotent: returns existing row or creates one */
export async function ensureUser(email, firstName = '', lastName = '') {
  if (!email) throw new Error('ensureUser: email is required');

  // Fast-path
  const existing = await getUserByEmail(email);
  if (existing) return existing;

  // Try UPSERT first (requires a unique index on email)
  try {
    const q = `
      INSERT INTO users (email, first_name, last_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE
        SET first_name = COALESCE(users.first_name, EXCLUDED.first_name),
            last_name  = COALESCE(users.last_name,  EXCLUDED.last_name)
      RETURNING ${SELECT_USER};
    `;
    const { rows } = await pool.query(q, [email, firstName, lastName]);
    return rows[0];
  } catch (e) {
    // Fallback when ON CONFLICT can't be used (no unique/exclusion constraint yet)
    if ((e?.message || '').includes('ON CONFLICT')) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const sel = await client.query(
          `SELECT ${SELECT_USER} FROM users WHERE email = $1 FOR UPDATE;`,
          [email]
        );
        if (sel.rows[0]) {
          await client.query('COMMIT');
          return sel.rows[0];
        }

        const ins = await client.query(
          `INSERT INTO users (email, first_name, last_name)
           VALUES ($1, $2, $3)
           RETURNING ${SELECT_USER};`,
          [email, firstName, lastName]
        );

        await client.query('COMMIT');
        return ins.rows[0];
      } catch (e2) {
        await client.query('ROLLBACK');
        throw e2;
      } finally {
        client.release();
      }
    }
    throw e;
  }
}

export async function ensureUserByEmail(email, firstName = '', lastName = '') {
  if (!email) throw new Error('ensureUserByEmail: email required');
  const q = `
    INSERT INTO users (email, first_name, last_name)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO UPDATE
      SET first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), users.first_name),
          last_name  = COALESCE(NULLIF(EXCLUDED.last_name,  ''), users.last_name),
          updated_at = NOW()
    RETURNING id, email, first_name, last_name, preferences, achievements, progress,
              activity_log, huey_memory, memorials, wishlist, avatar, shopify_linked,
              created_at, updated_at;`;
  const { rows } = await pool.query(q, [email, firstName, lastName]);
  return mapUserRow(rows[0]);
}

export async function createUser({
  email,
  firstName = '',
  lastName = '',
  password = null,
  passwordHash = null,
  shopifyLinked = false,
  preferences = {},
  achievements = [],
  progress = {},
  activityLog = [],
  hueyMemory = {},
  memorials = [],
  wishlist = [],
  avatar = null,
} = {}) {
  if (!email) throw new Error('createUser: email is required');

  const hash = passwordHash || (password ? await bcrypt.hash(password, 12) : null);

  const sql = `
    INSERT INTO users (
      email, first_name, last_name, password_hash, shopify_linked,
      preferences, achievements, progress, activity_log, huey_memory, memorials, wishlist, avatar
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13
    )
    ON CONFLICT (email) DO UPDATE
      SET first_name = COALESCE(users.first_name, EXCLUDED.first_name),
          last_name  = COALESCE(users.last_name,  EXCLUDED.last_name)
    RETURNING ${SELECT_USER};
  `;

  const params = [
    email,
    firstName,
    lastName,
    hash,
    !!shopifyLinked,
    JSON.stringify(preferences ?? {}),
    JSON.stringify(achievements ?? []),
    JSON.stringify(progress ?? {}),
    JSON.stringify(activityLog ?? []),
    JSON.stringify(hueyMemory ?? {}),
    JSON.stringify(memorials ?? []),
    JSON.stringify(wishlist ?? []),
    avatar,
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0];
}

/**
 * getOrCreateUser(profileLike)
 */
export async function getOrCreateUser(profile = {}) {
  const email =
    profile.email ||
    profile.emailAddress ||
    profile.email_address ||
    profile?.primaryEmailAddress?.emailAddress ||
    profile?.emailAddresses?.[0]?.emailAddress ||
    profile?.emailes?.[0]?.email || // legacy typo seen earlier
    profile?.customer?.email ||      // Shopify-like shape
    null;

  if (!email) throw new Error('getOrCreateUser: email is required');

  const firstName = profile.firstName || profile.first_name || profile?.customer?.firstName || '';
  const lastName  = profile.lastName  || profile.last_name  || profile?.customer?.lastName  || '';

  const password      = profile.password      || null;
  const passwordHash  = profile.passwordHash  || null;

  const existing = await getUserByEmail(email);
  if (existing) return existing;

  return await createUser({
    email,
    firstName,
    lastName,
    password,
    passwordHash,
  });
}

/** Compatibility alias for older code paths */
export async function syncUserIfMissing(email, firstName = '', lastName = '') {
  if (!email) throw new Error('syncUserIfMissing: email is required');
  const existing = await getUserByEmail(email);
  if (existing) return existing;
  return await createUser({ email, firstName, lastName });
}

/* -------------------- UPDATE USER (camelCase-safe) -------------------- */
export async function updateUser(id, patch = {}) {
  const remap = {
    firstName: 'first_name',
    lastName: 'last_name',
    passwordHash: 'password_hash',
    shopifyLinked: 'shopify_linked',
    activityLog: 'activity_log',
    hueyMemory: 'huey_memory',
  };
  const norm = {};
  for (const [k, v] of Object.entries(patch || {})) {
    norm[remap[k] || k] = v;
  }

  const allowed = new Set([
    'first_name', 'last_name', 'password_hash', 'avatar', 'shopify_linked',
    'preferences', 'progress', 'huey_memory',
    'achievements', 'activity_log', 'memorials', 'wishlist',
  ]);

  const jsonbMerge   = new Set(['preferences', 'progress', 'huey_memory']);
  const jsonbReplace = new Set(['achievements', 'activity_log', 'memorials', 'wishlist']);

  const keys = Object.keys(norm).filter(k => allowed.has(k));
  if (keys.length === 0) return await getUserById(id);

  const setClauses = [];
  const params = [id]; // $1 is id

  keys.forEach((k, i) => {
    const idx = i + 2;
    if (jsonbMerge.has(k)) {
      setClauses.push(`${k} = COALESCE(${k}, '{}'::jsonb) || $${idx}::jsonb`);
      params.push(JSON.stringify(norm[k]));
    } else if (jsonbReplace.has(k)) {
      setClauses.push(`${k} = $${idx}::jsonb`);
      params.push(JSON.stringify(norm[k]));
    } else {
      setClauses.push(`${k} = $${idx}`);
      params.push(norm[k]);
    }
  });

  const sql = `
    UPDATE users
       SET ${setClauses.join(', ')},
           updated_at = NOW()
     WHERE id = $1
     RETURNING ${SELECT_USER};
  `;
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

/* -------------------- Pets -------------------- */

export async function getPetsByUserId(userId) {
  try {
    const q = `
      SELECT
        id,
        user_id        AS "userId",
        name,
        species,
        breed,
        birthday,
        birthdate,
        sex,
        spayed_neutered AS "spayedNeutered",
        weight_kg,
        size,
        chew_strength,
        allergies,
        dislikes,
        toy_prefs,
        food_prefs,
        notes,
        avatar,
        customer_email   AS "customerEmail",
        traits,
        created_at       AS "createdAt",
        updated_at       AS "updatedAt"
      FROM pets
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const { rows } = await pool.query(q, [userId]);
    return rows;
  } catch (e) {
    if (e?.code === '42703') {
      const q2 = `
        SELECT id, user_id AS "userId", name, species, breed, birthday, avatar,
               '{}'::jsonb AS traits,
               created_at AS "createdAt", updated_at AS "updatedAt"
          FROM pets
         WHERE user_id = $1
         ORDER BY created_at DESC;
      `;
      const { rows } = await pool.query(q2, [userId]);
      return rows;
    }
    if (e?.code === '42P01') { // relation missing
      return [];
    }
    throw e;
  }
}

export async function addPet(email, newPet = {}) {
  const user = await getUserByEmail(email);
  if (!user) return false;
  const { name, species = null, breed = null, birthday = null, traits = {} } = newPet;
  if (!name) throw new Error('addPet: pet.name is required');

  // normalize species to lowercase to satisfy check constraint
  const speciesNorm =
    species == null || species === ''
      ? null
      : String(species).trim().toLowerCase();

  const sql = `
    INSERT INTO pets (user_id, name, species, breed, birthday, traits)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    RETURNING
      id, user_id AS "userId", name, species, breed, birthday, birthdate,
      sex, spayed_neutered AS "spayedNeutered", weight_kg, size, chew_strength,
      allergies, dislikes, toy_prefs, food_prefs, notes, avatar, customer_email AS "customerEmail",
      traits, created_at AS "createdAt", updated_at AS "UpdatedAt";
  `;
  const params = [user.id, name, speciesNorm, breed, birthday, JSON.stringify(traits ?? {})];
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

export async function updateUserPets(email, newPets = []) {
  const user = await getUserByEmail(email);
  if (!user) return false;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM pets WHERE user_id = $1;', [user.id]);
    for (const p of newPets) {
      if (!p?.name) continue;
      await client.query(
        `INSERT INTO pets (user_id, name, species, breed, birthday)
         VALUES ($1, $2, $3, $4, $5);`,
        [user.id, p.name, p.species ?? null, p.breed ?? null, p.birthday ?? null]
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function deletePet(email, petIndex = 0) {
  const user = await getUserByEmail(email);
  if (!user) return false;

  const { rows } = await pool.query(
    `SELECT id FROM pets WHERE user_id = $1 ORDER BY created_at ASC;`,
    [user.id]
  );
  const target = rows[petIndex];
  if (!target) return false;

  await pool.query(`DELETE FROM pets WHERE id = $1;`, [target.id]);
  return true;
}

export async function updatePet(userId, pets) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM pets WHERE user_id = $1;', [userId]);
    for (const p of (pets || [])) {
      if (!p?.name) continue;
      await client.query(
        `INSERT INTO pets (user_id, name, species, breed, birthday)
         VALUES ($1, $2, $3, $4, $5);` ,
        [userId, p.name, p.species ?? null, p.breed ?? null, p.birthday ?? null]
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Edit a single pet by id for a specific user — hardened placeholders & casts */

// helper for dynamic updates
function _snake(k) {
  return k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

// columns we allow to be written
const PET_WRITEABLE = new Set([
  'name','species','breed',
  'birthday','birthdate',
  'sex','spayed_neutered',
  'weight_kg','size','chew_strength',
  'notes','avatar',
  'allergies','dislikes','toy_prefs','food_prefs',
  'traits'
]);

export async function updatePetById(userId, petId, patch = {}) {
  if (!userId || !petId) throw new Error('Missing ids');

  const fields = [];
  const values = [];
  let i = 1;

  for (const [key, val] of Object.entries(patch)) {
    const col = _snake(key);
    const target = PET_WRITEABLE.has(col) ? col : (PET_WRITEABLE.has(key) ? key : null);
    if (!target) continue;

    // normalize species to lowercase always
    if (target === 'species') {
      if (val == null || val === '') {
        fields.push(`species = NULL`);
      } else {
        fields.push(`species = LOWER($${i})`);
        values.push(String(val).trim());
        i++;
      }
      continue;
    }

    if (target === 'traits') {
      fields.push(`traits = $${i}::jsonb`);
      values.push(typeof val === 'string' ? val : JSON.stringify(val ?? {}));
      i++;
      continue;
    }

    if (Array.isArray(val) && ['allergies','dislikes','toy_prefs','food_prefs'].includes(target)) {
      fields.push(`${target} = $${i}::text[]`);
      values.push(val);
      i++;
      continue;
    }

    if (target === 'birthday' || target === 'birthdate') {
      if (val == null || val === '') {
        fields.push(`${target} = NULL`);
      } else {
        fields.push(`${target} = $${i}::date`);
        values.push(val);
        i++;
      }
      continue;
    }

    if (target === 'spayed_neutered') {
      fields.push(`${target} = $${i}::boolean`);
      values.push(val === null ? null : !!val);
      i++;
      continue;
    }

    if (target === 'weight_kg') {
      fields.push(`${target} = $${i}::numeric`);
      values.push(val);
      i++;
      continue;
    }

    if (target === 'chew_strength') {
      fields.push(`${target} = $${i}::integer`);
      values.push(val);
      i++;
      continue;
    }

    fields.push(`${target} = $${i}`);
    values.push(val);
    i++;
  }

  if (!fields.length) throw new Error('No fields to update');

  // mirror birthday/birthdate if only one was provided
  const touchedBirthday  = fields.some(f => f.startsWith('birthday '));
  const touchedBirthdate = fields.some(f => f.startsWith('birthdate '));
  if (touchedBirthday && !touchedBirthdate) {
    fields.push(`birthdate = birthday`);
  } else if (touchedBirthdate && !touchedBirthday) {
    fields.push(`birthday = birthdate`);
  }

  // also normalize existing species on any update to satisfy check constraint
  const hasSpeciesAssignment = fields.some(f => f.startsWith('species ='));
  if (!hasSpeciesAssignment) {
    fields.push('species = LOWER(species)');
  }

  const sql = `
    UPDATE pets
       SET ${fields.join(', ')}, updated_at = now()
     WHERE user_id = $${i}::uuid
       AND id      = $${i+1}::uuid
    RETURNING
      id, user_id AS "userId",
      name, species, breed,
      birthday, birthdate,
      sex,
      spayed_neutered AS "spayedNeutered",
      weight_kg,
      size, chew_strength,
      notes, avatar,
      allergies, dislikes, toy_prefs, food_prefs,
      traits,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;
  values.push(userId, petId);

  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}

export async function deletePetById(userId, petId) {
  const sql = `DELETE FROM pets WHERE user_id = $1 AND id = $2 RETURNING id;`;
  const { rows } = await pool.query(sql, [userId, petId]);
  return !!rows[0];
}

/* -------------------- Addresses -------------------- */
export async function getAddressesByUserId(userId) {
  const sql = `
    SELECT
      id,
      user_id AS "userId",
      label,
      name,
      phone,
      address1,
      address2,
      city,
      state,
      postal_code AS "postalCode",
      country,
      is_default_shipping AS "isDefaultShipping",
      is_default_billing  AS "isDefaultBilling",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM addresses
    WHERE user_id = $1
    ORDER BY is_default_shipping DESC, is_default_billing DESC, created_at DESC, id DESC;
  `;
  const { rows } = await pool.query(sql, [userId]);
  return rows;
}

export async function addAddress(userId, a) {
  // Normalize booleans
  const ship = !!a.isDefaultShipping;
  const bill = !!a.isDefaultBilling;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (ship) {
      await client.query(`UPDATE addresses SET is_default_shipping = FALSE WHERE user_id = $1 AND is_default_shipping = TRUE`, [userId]);
    }
    if (bill) {
      await client.query(`UPDATE addresses SET is_default_billing  = FALSE WHERE user_id = $1 AND is_default_billing  = TRUE`, [userId]);
    }

    const sql = `
      INSERT INTO addresses (
        user_id, label, name, phone,
        address1, address2, city, state, postal_code, country,
        is_default_shipping, is_default_billing
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      RETURNING
        id, user_id AS "userId", label, name, phone,
        address1, address2, city, state, postal_code AS "postalCode", country,
        is_default_shipping AS "isDefaultShipping", is_default_billing AS "isDefaultBilling",
        created_at AS "CreatedAt", updated_at AS "UpdatedAt";
    `;
    const vals = [
      userId,
      a.label ?? null,
      a.name ?? null,
      a.phone ?? null,
      a.address1,
      a.address2 ?? null,
      a.city,
      a.state,
      a.postalCode,
      a.country,
      ship,
      bill,
    ];
    const { rows } = await client.query(sql, vals);
    await client.query('COMMIT');
    return rows[0] || null;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function updateAddressById(userId, addressId, patch = {}) {
  const fields = [];
  const values = [];
  let i = 1;

  const map = {
    label: 'label',
    name: 'name',
    phone: 'phone',
    address1: 'address1',
    address2: 'address2',
    city: 'city',
    state: 'state',
    postalCode: 'postal_code',
    country: 'country',
  };
  for (const k of Object.keys(map)) {
    if (patch[k] !== undefined) {
      fields.push(`${map[k]} = $${i++}`);
      values.push(patch[k] ?? null);
    }
  }

  const setDefaultShipping = patch.isDefaultShipping === true;
  const setDefaultBilling  = patch.isDefaultBilling  === true;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (setDefaultShipping) {
      await client.query(`UPDATE addresses SET is_default_shipping = FALSE WHERE user_id = $1 AND is_default_shipping = TRUE`, [userId]);
      fields.push(`is_default_shipping = TRUE`);
    } else if (patch.isDefaultShipping === false) {
      fields.push(`is_default_shipping = FALSE`);
    }

    if (setDefaultBilling) {
      await client.query(`UPDATE addresses SET is_default_billing = FALSE WHERE user_id = $1 AND is_default_billing = TRUE`, [userId]);
      fields.push(`is_default_billing = TRUE`);
    } else if (patch.isDefaultBilling === false) {
      fields.push(`is_default_billing = FALSE`);
    }

    if (fields.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const sql = `
      UPDATE addresses
         SET ${fields.join(', ')}
       WHERE user_id = $${i++} AND id = $${i++}
       RETURNING
         id, user_id AS "userId", label, name, phone,
         address1, address2, city, state, postal_code AS "postalCode", country,
         is_default_shipping AS "isDefaultShipping", is_default_billing AS "isDefaultBilling",
         created_at AS "createdAt", updated_at AS "updatedAt";
    `;
    values.push(userId, addressId);
    const { rows } = await client.query(sql, values);
    await client.query('COMMIT');
    return rows[0] || null;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteAddressById(userId, addressId) {
  const sql = `DELETE FROM addresses WHERE user_id = $1 AND id = $2 RETURNING id`;
  const { rows } = await pool.query(sql, [userId, addressId]);
  return !!rows[0];
}

/* -------------------- Pet Journal -------------------- */
export async function getPetJournal(userId, petId) {
  const sql = `
    SELECT id,
           user_id AS "userId",
           pet_id  AS "petId",
           text,
           mood,
           tags,
           photo,
           created_at AS "CreatedAt"
      FROM pet_journal
     WHERE user_id = $1 AND pet_id = $2
     ORDER BY created_at DESC, id DESC;
  `;

  try {
    const { rows } = await pool.query(sql, [userId, petId]);
    return rows;
  } catch (e) {
    if (e?.code === '42P01') return [];
    throw e;
  }
}

export async function addPetJournalEntry(userId, petId, { text, mood = null, tags = [], photo = null } = {}) {
  if (!userId || !petId) throw new Error('addPetJournalEntry: userId and petId required');
  if (!text) throw new Error('addPetJournalEntry: text required');

  let tagsArray = [];
  if (Array.isArray(tags)) {
    tagsArray = tags.map(t => String(t).trim()).filter(Boolean);
  } else if (typeof tags === 'string') {
    tagsArray = tags.split(',').map(t => t.replace(/^#/, '').trim()).filter(Boolean);
  }

  const sql = `
    INSERT INTO pet_journal (user_id, pet_id, text, mood, tags, photo)
    VALUES ($1, $2, $3, $4, $5::text[], $6)
    RETURNING id,
              user_id AS "userId",
              pet_id  AS "petId",
              text, mood, tags, photo,
              created_at AS "createdAt";
  `;
  const params = [userId, petId, text, mood || null, tagsArray, photo || null];
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

export async function getPetJournalEntryById(userId, petId, entryId) {
  const sql = `
    SELECT id, user_id AS "userId", pet_id AS "petId",
           text, mood, tags, photo,
           created_at AS "createdAt", updated_at AS "updatedAt"
      FROM pet_journal
     WHERE user_id = $1 AND pet_id = $2 AND id = $3
     LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [userId, petId, entryId]);
  return rows[0] || null;
}

export async function updatePetJournalEntry(userId, petId, entryId, patch = {}) {
  const fields = [];
  const vals = [];
  let i = 1;

  if (patch.text !== undefined) { fields.push(`text = $${i++}`); vals.push(patch.text ?? ''); }
  if (patch.mood !== undefined) { fields.push(`mood = $${i++}`); vals.push(patch.mood ?? null); }

  if (patch.tags !== undefined) {
    const tags = normalizeTags(patch.tags);
    fields.push(`tags = $${i++}::text[]`);
    vals.push(tags);
  }

  if (patch.photo !== undefined) { // set to null on remove
    fields.push(`photo = $${i++}`);
    vals.push(patch.photo);
  }

  if (fields.length === 0) return null;

  const sql = `
    UPDATE pet_journal
       SET ${fields.join(', ')}, updated_at = NOW()
     WHERE user_id = $${i++} AND pet_id = $${i++} AND id = $${i++}
     RETURNING id, user_id AS "userId", pet_id AS "petId",
               text, mood, tags, photo,
               created_at AS "createdAt", updated_at AS "updatedAt";
  `;
  vals.push(userId, petId, entryId);
  const { rows } = await pool.query(sql, vals);
  return rows[0] || null;
}

export async function deletePetJournalEntry(userId, petId, entryId) {
  const sql = `DELETE FROM pet_journal WHERE user_id=$1 AND pet_id=$2 AND id=$3 RETURNING id;`;
  const { rows } = await pool.query(sql, [userId, petId, entryId]);
  return !!rows[0];
}

/* -------------------- Achievements / Wishlist / Activity -------------------- */
export async function addAchievement(userId, achievement) {
  if (!achievement) return false;
  const u = await getUserById(userId);
  const current = Array.isArray(u?.achievements) ? u.achievements : [];
  if (!current.includes(achievement)) current.push(achievement);
  const updated = await updateUser(userId, { achievements: current });
  return !!updated;
}

export async function updateWishlist(userId, wishlist = []) {
  const updated = await updateUser(userId, { wishlist });
  return updated;
}

export async function logActivity(userId, entry) {
  const u = await getUserById(userId);
  const log = Array.isArray(u?.activityLog) ? u.activityLog : [];
  log.push({ date: new Date().toISOString(), entry });
  const updated = await updateUser(userId, { activity_log: log });
  return updated;
}

/* -------------------- Health -------------------- */
export async function pingDb() {
  const { rows } = await pool.query('SELECT 1 AS ok;');
  return rows[0]?.ok === 1;
}

/* Optional default export for legacy imports */
export default {
  // users
  getUserByEmail,
  getUserById,
  ensureUser,
  ensureUserByEmail,
  createUser,
  getOrCreateUser,
  syncUserIfMissing,
  updateUser,

  // pets
  getPetsByUserId,
  addPet,
  updateUserPets,
  deletePet,
  updatePet,          // legacy: replace-all variant
  updatePetById,      // edit single pet (supports all fields)
  deletePetById,      // delete single pet

  // activity / wishlist / achievements
  addAchievement,
  updateWishlist,
  logActivity,

  // journals
  getPetJournal,
  addPetJournalEntry,
  updatePetJournalEntry,
  deletePetJournalEntry,
  getPetJournalEntryById,

  // addresses
  getAddressesByUserId,
  addAddress,
  updateAddressById,
  deleteAddressById,

  // health
  pingDb,
};
