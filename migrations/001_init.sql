-- 001_init.sql — users + notes.
--
-- Phase 1 of the byebyenotes Postgres schema. Folders, images and table blocks
-- are deliberately NOT here yet; they get their own migration once designed.
--
-- Decisions baked in (see docs/superpowers/specs/):
--   * Postgres is the source of truth; the LZ-String URL hash becomes an
--     export/share serialization, not state. So no `hash` column.
--   * Identity is a passphrase. Notes FK to an opaque users.id, never to the
--     phrase itself, so the credential scheme can change without touching notes.
--   * blocks[] is stored as JSONB, mirroring the client model 1:1.
--   * Conflicts are last-write-wins, matching today's mergeRecents (app.js:444).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ── users ─────────────────────────────────────────────────────────────────────
-- A passphrase is the only credential: no email, no reset. That forces the
-- two-column split below, because Argon2 salts randomly and therefore cannot be
-- used in a WHERE clause.
--
--   lookup_key — deterministic HMAC-SHA256(server_pepper, passphrase). Finds the
--                row in one index hit. The pepper lives in an env var, NOT in the
--                database, so a stolen dump can't be brute-forced offline.
--   verifier   — argon2id hash. Slow on purpose; proves the phrase.
CREATE TABLE users (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_key   bytea       NOT NULL UNIQUE,
  verifier     text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,

  CONSTRAINT users_lookup_key_len CHECK (octet_length(lookup_key) = 32)
);

-- ── notes ─────────────────────────────────────────────────────────────────────
CREATE TABLE notes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- The client-generated note id (app.js:3027). Existing users have notes in
  -- localStorage keyed by this; carrying it lets a first-login migration upsert
  -- them idempotently instead of duplicating on every retry.
  client_nid   text        NOT NULL,

  blocks       jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Denormalized so rendering the sidebar doesn't parse JSONB per row
  -- (app.js:2015 calls noteTitle() for every visible note).
  title        text        NOT NULL DEFAULT 'untitled',

  -- Derived, but expressible as an IMMUTABLE expression — so the database
  -- maintains it and it cannot drift the way `title` can.
  block_count  int         GENERATED ALWAYS AS (jsonb_array_length(blocks)) STORED,

  -- Per-note presentation, mirroring collectState() (app.js:1497).
  theme        text,
  font         text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,

  -- Without this, a non-array slipping into `blocks` makes the generated column
  -- throw on EVERY write. Cheap guard against a whole class of 500s.
  CONSTRAINT notes_blocks_is_array CHECK (jsonb_typeof(blocks) = 'array'),

  -- Carries over MAX_BYTES from api/README.md, enforced by the database rather
  -- than by remembering to check it in each handler.
  CONSTRAINT notes_blocks_size     CHECK (octet_length(blocks::text) <= 400000),

  CONSTRAINT notes_client_nid_uniq UNIQUE (user_id, client_nid)
);

-- The query that runs constantly: this user's live notes, newest first.
-- Partial, so soft-deleted rows cost nothing in the hot path.
CREATE INDEX notes_user_recent_idx
  ON notes (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

-- ── updated_at ────────────────────────────────────────────────────────────────
-- Last-write-wins depends entirely on updated_at being truthful, so the database
-- sets it rather than trusting each caller to remember.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_touch_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
