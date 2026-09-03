-- Schema V3 — Postgres (rode com: psql $DATABASE_URL -f migrate.sql)
CREATE TABLE IF NOT EXISTS analises (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ,
  status TEXT DEFAULT 'analisado',
  fonte TEXT,
  url TEXT,
  bairro TEXT,
  score INTEGER,
  veredito TEXT,
  origem TEXT,
  whatsapp TEXT,
  dados JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_analises_fonte ON analises(fonte);
CREATE INDEX IF NOT EXISTS idx_analises_status ON analises(status);
CREATE INDEX IF NOT EXISTS idx_analises_score ON analises(score);

CREATE TABLE IF NOT EXISTS watchlist (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  rotulo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS snapshots (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  medias JSONB NOT NULL DEFAULT '[]'
);
