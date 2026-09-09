CREATE TABLE IF NOT EXISTS archives (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  collections TEXT[] NOT NULL DEFAULT '{}',
  sell_date DATE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS archives_created_at_idx ON archives (created_at DESC);

-- Single-row working draft: lets a user Save mid-edit and resume later without
-- naming/archiving it. Distinct from `archives`, which is a deliberate, named,
-- permanent record.
CREATE TABLE IF NOT EXISTS current_session (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  snapshot JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
