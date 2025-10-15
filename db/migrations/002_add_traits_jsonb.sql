BEGIN;

ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS traits JSONB;

UPDATE pets SET traits = '{}'::jsonb WHERE traits IS NULL;

ALTER TABLE pets
  ALTER COLUMN traits SET DEFAULT '{}'::jsonb,
  ALTER COLUMN traits SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pets_traits_gin ON pets USING GIN (traits);

COMMIT;