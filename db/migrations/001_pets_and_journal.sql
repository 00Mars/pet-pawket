-- db/migrations/001_pets_and_journal.sql
-- Idempotent + schema-aware migration for Pets and Pet Journals.
-- - Doesn’t fail on existing data (NOT VALID checks)
-- - Matches pet_journal_entries.pet_id type to pets.id (uuid vs int)

-- 0) Ensure pets table exists (only if missing). We assume UUID ids if we must create it.
DO $$
BEGIN
  IF to_regclass('public.pets') IS NULL THEN
    CREATE TABLE pets (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL
    );
  END IF;
END$$;

-- 1) Add/align columns on pets (kept NULLable for safe backfill)
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS customer_email   TEXT,
  ADD COLUMN IF NOT EXISTS species          TEXT,
  ADD COLUMN IF NOT EXISTS breed            TEXT,
  ADD COLUMN IF NOT EXISTS sex              TEXT,
  ADD COLUMN IF NOT EXISTS spayed_neutered  BOOLEAN,
  ADD COLUMN IF NOT EXISTS birthdate        DATE,
  ADD COLUMN IF NOT EXISTS weight_kg        NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS size             TEXT,
  ADD COLUMN IF NOT EXISTS chew_strength    INTEGER,
  ADD COLUMN IF NOT EXISTS allergies        TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS dislikes         TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS toy_prefs        TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS food_prefs       TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();

-- 1a) Species CHECK constraint (NOT VALID so existing rows won’t break)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'pets' AND column_name = 'species')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pets_species_check') THEN
    ALTER TABLE pets
      ADD CONSTRAINT pets_species_check
      CHECK (species IN ('dog','cat','bird','fish','reptile','small')) NOT VALID;
  END IF;
END$$;

-- 1b) Index on customer_email if column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'pets' AND column_name = 'customer_email') THEN
    CREATE INDEX IF NOT EXISTS idx_pets_customer ON pets(customer_email);
  END IF;
END$$;

-- 2) Create pet_journal_entries with pet_id type matching pets.id
DO $$
DECLARE
  pk_type TEXT;
BEGIN
  IF to_regclass('public.pet_journal_entries') IS NULL THEN
    SELECT data_type
      INTO pk_type
      FROM information_schema.columns
     WHERE table_name = 'pets' AND column_name = 'id';

    -- Normalize some variants
    IF pk_type IS NULL THEN
      pk_type := 'uuid';  -- safe default
    ELSIF pk_type = 'integer' THEN
      pk_type := 'integer';
    ELSIF pk_type = 'bigint' THEN
      pk_type := 'bigint';
    ELSIF pk_type = 'uuid' THEN
      pk_type := 'uuid';
    ELSE
      pk_type := 'uuid';
    END IF;

    EXECUTE format($SQL$
      CREATE TABLE pet_journal_entries (
        id BIGSERIAL PRIMARY KEY,
        pet_id %I NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        ts TIMESTAMPTZ NOT NULL DEFAULT now(),
        type TEXT NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb,
        source TEXT,
        created_by TEXT
      )
    $SQL$, pk_type);
  END IF;
END$$;

-- 2a) Constrain journal types (NOT VALID so old rows won’t break this)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pet_journal_entries_type_check') THEN
    ALTER TABLE pet_journal_entries
      ADD CONSTRAINT pet_journal_entries_type_check
      CHECK (type IN (
        'meal','treat','poop','walk','mood','note','purchase',
        'weight','allergy_reaction','measurement','like','dislike'
      )) NOT VALID;
  END IF;
END$$;

-- 2b) Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_journal_pet         ON pet_journal_entries(pet_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_journal_type        ON pet_journal_entries(type);
CREATE INDEX IF NOT EXISTS idx_journal_payload_gin ON pet_journal_entries USING GIN (payload);