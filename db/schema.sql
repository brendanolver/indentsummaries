CREATE TABLE IF NOT EXISTS archives (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  collections TEXT[] NOT NULL DEFAULT '{}',
  sell_date DATE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS archives_created_at_idx ON archives (created_at DESC);
