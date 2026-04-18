-- ─────────────────────────────────────────────────────────────────────────────
-- Ear Training System — Initial Schema
-- Run this in the Supabase SQL editor or via Supabase CLI migrations.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        varchar(6) UNIQUE NOT NULL,
  created_at  timestamptz DEFAULT now(),
  language    varchar(2) DEFAULT 'es'   -- 'es' | 'en'
);

-- ── sessions ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  started_at       timestamptz DEFAULT now(),
  ended_at         timestamptz,
  idm_start        float,
  idm_end          float,
  exercises_count  integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

-- ── exercises ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id         uuid REFERENCES users(id)    ON DELETE CASCADE NOT NULL,
  created_at      timestamptz DEFAULT now(),

  -- Sequence data
  tonic           varchar(3),        -- e.g. 'C', 'G', 'Bb'
  sequence        jsonb,             -- [{note:'C4', interval:'P5', direction:'ascending'}, ...]
  tempo           integer,           -- BPM

  -- IDM components
  idm             float,
  d_bar           float,             -- d̄
  s               integer,           -- melodic leaps count
  c               float,             -- melodic contour
  x               float,             -- chromaticism
  n_chunks        integer,           -- number of chunks
  d_density       float,             -- event density (D/D_ref)
  r               float,             -- rhythmic complexity
  h               integer,           -- allowed hearings

  -- Results
  auditions_used     integer,
  user_sequence      jsonb,          -- notes entered by user
  correct            boolean[],      -- correctness per note
  precision          float,          -- weighted precision 0–1
  response_time      float,          -- seconds
  consecutive_errors integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS exercises_user_id_idx    ON exercises(user_id);
CREATE INDEX IF NOT EXISTS exercises_session_id_idx ON exercises(session_id);

-- ── srs_items ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS srs_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  interval_type   varchar(4) NOT NULL,   -- 'm2','M2','m3','M3','P4','P5','P8','TT','m6','M6','m7','M7'
  direction       varchar(11) NOT NULL,  -- 'ascending' | 'descending' | 'harmonic'

  exposures       integer DEFAULT 0,
  correct_count   integer DEFAULT 0,
  wrong_count     integer DEFAULT 0,
  half_life       float   DEFAULT 1.0,   -- days
  last_seen       timestamptz,
  next_review     timestamptz,
  leitner_box     integer DEFAULT 1,     -- 1–5

  UNIQUE(user_id, interval_type, direction)
);

CREATE INDEX IF NOT EXISTS srs_items_user_id_idx ON srs_items(user_id);

-- ── Row-Level Security (optional but recommended) ────────────────────────────
-- Enable RLS and allow anon key to read/write its own rows.
-- Uncomment if you want RLS; adjust policies to your auth strategy.

-- ALTER TABLE users      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sessions   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE exercises  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE srs_items  ENABLE ROW LEVEL SECURITY;
