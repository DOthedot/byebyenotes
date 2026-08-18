-- 002_folders_prefs.sql — the rest of what a note actually needs.
--
-- 001 modelled a note's *content* (blocks, title, theme, font). Everything the
-- sidebar tree and the settings panel depend on was deliberately left out. This
-- migration closes that gap, so a note can round-trip through Postgres with no
-- loss against what localStorage holds today.
--
-- Mapped against the client's two stores:
--
--   bbn.recent entry  { nid, hash, folder, title, renamed, blockCount, langs, t }
--     nid        -> notes.client_nid    (001)
--     hash       -> NOT STORED. 001's premise is that Postgres owns the state and
--                   the LZ-String hash is a serialization of it, so the client
--                   re-encodes it from `blocks` on load rather than the server
--                   persisting a second copy that can drift.
--     folder     -> notes.folder        (here)
--     title      -> notes.title         (001)
--     renamed    -> notes.title_pinned  (here)
--     blockCount -> notes.block_count   (001, generated)
--     langs      -> NOT STORED. Derivable from blocks; a column would just be a
--                   second thing to keep in step.
--     t          -> notes.updated_at    (001)
--
--   bbn.prefs  { theme, font, t, sidebar{...}, folders[], tabs[], ... }
--     theme/font -> also on notes (001), because a shared note carries the
--                   sender's look; user_prefs holds *your* default.
--     folders[]  -> folders table       (here)
--     everything else -> user_prefs.prefs jsonb (here)

BEGIN;

-- ── notes.folder ──────────────────────────────────────────────────────────────
-- A '/'-joined path, exactly the string the client keeps on each snapshot
-- (app.js assignFolder). NULL means the top level.
--
-- Deliberately not a foreign key to `folders`. The client derives the tree from
-- notes AND the explicit folder list (buildTreeRows), so a note may sit in a path
-- that has no folders row — that is normal, not corruption. An FK would also turn
-- every folder rename into a cascade problem on a path-shaped key.
ALTER TABLE notes ADD COLUMN folder text;

-- Folder paths arrive from a browser and are untrusted. app.js caps depth at
-- FOLDER_MAX_DEPTH = 12 because deeper input blew the stack inside renderSidebar;
-- the same cap belongs here, so a bad row can never reach a second client.
ALTER TABLE notes ADD CONSTRAINT notes_folder_shape CHECK (
  folder IS NULL OR (
    folder ~ '^[^/[:space:]][^/]*(/[^/[:space:]][^/]*)*$'
    AND char_length(folder) <= 512
    AND array_length(string_to_array(folder, '/'), 1) <= 12
  )
);

-- "this user's notes in this folder", the sidebar's other hot query.
CREATE INDEX notes_user_folder_idx
  ON notes (user_id, folder)
  WHERE deleted_at IS NULL;

-- ── notes.title_pinned ────────────────────────────────────────────────────────
-- The client's `renamed` flag. False means `title` is derived from the first
-- meaningful line and should be re-derived on every save; true means the user
-- named it and editing the body must not silently rename it back.
ALTER TABLE notes ADD COLUMN title_pinned boolean NOT NULL DEFAULT false;

-- ── delta-sync index ──────────────────────────────────────────────────────────
-- 001's notes_user_recent_idx is partial on `deleted_at IS NULL`, so it cannot
-- serve "everything that changed since X" — the query that has to return
-- tombstones, or a delete on one device never reaches the other. Hence a second,
-- unfiltered index rather than widening the first (the hot path should keep
-- skipping dead rows).
CREATE INDEX notes_user_updated_idx ON notes (user_id, updated_at DESC);

-- ── folders ───────────────────────────────────────────────────────────────────
-- Only folders the user explicitly created. A folder that merely contains notes
-- needs no row — it is implied by notes.folder. This table exists so an EMPTY
-- folder is a real, persistent thing rather than a shape that vanishes the moment
-- its last note moves out (app.js loadFolders/saveFolders keeps the same list).
CREATE TABLE folders (
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Soft delete, for the same reason notes have it: without a tombstone, a folder
  -- deleted on this laptop is simply absent from its list, and the next pull from
  -- the phone — which still has it — reads that absence as "nothing to say" and
  -- puts it straight back.
  deleted_at timestamptz,

  PRIMARY KEY (user_id, path),

  CONSTRAINT folders_path_shape CHECK (
    path ~ '^[^/[:space:]][^/]*(/[^/[:space:]][^/]*)*$'
    AND char_length(path) <= 512
    AND array_length(string_to_array(path, '/'), 1) <= 12
  )
);

CREATE INDEX folders_user_updated_idx ON folders (user_id, updated_at DESC);

-- ── user_prefs ────────────────────────────────────────────────────────────────
-- Kept out of `users` on purpose. `users` is a credential row: it is read on every
-- request and written almost never. Prefs are the opposite — a theme toggle writes
-- immediately (app.js savePrefs calls pushNow, not the debounce). Mixing the two
-- would put a hot write on the row that authentication depends on.
--
-- The payload stays jsonb because the client's prefs bag is open-ended (hint
-- dismissals, tab list, save_before_new, sidebar geometry). Promoting fields to
-- columns as they stabilise is a later migration; guessing now would be churn.
CREATE TABLE user_prefs (
  user_id    uuid        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  prefs      jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- The sidebar wallpaper, when the user uploaded their own, is a base64 data URI
  -- of up to ~120KB (app.js pickSidebarImage downscales to 640px JPEG and caps it).
  -- It lives in its own column so the small, hot prefs blob can be read and written
  -- without dragging the image along on every theme change. Postgres TOASTs a value
  -- this size out of line, so updating `prefs` does not rewrite it either.
  sidebar_image text,

  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_prefs_is_object   CHECK (jsonb_typeof(prefs) = 'object'),
  -- Small on purpose: this is settings, not content. The image has its own budget.
  CONSTRAINT user_prefs_size        CHECK (octet_length(prefs::text) <= 32768),
  CONSTRAINT user_prefs_image_size  CHECK (sidebar_image IS NULL OR octet_length(sidebar_image) <= 200000)
);

-- ── updated_at ────────────────────────────────────────────────────────────────
-- Same reasoning as 001: last-write-wins is only as trustworthy as the timestamp,
-- so the database sets it. touch_updated_at() already exists from 001.
CREATE TRIGGER folders_touch_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER user_prefs_touch_updated_at
  BEFORE UPDATE ON user_prefs
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
