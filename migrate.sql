-- Schema V4 — idempotente (rode com: psql $DATABASE_URL -f migrate.sql)
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
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
CREATE INDEX IF NOT EXISTS idx_analises_created_at ON analises(created_at DESC);

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

-- E1 distribuição
CREATE TABLE IF NOT EXISTS equipe (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meta (
  chave TEXT PRIMARY KEY,
  valor JSONB
);

INSERT INTO schema_migrations (version) VALUES (4) ON CONFLICT (version) DO NOTHING;

-- V5 autenticação individual
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'corretor' CHECK (role IN ('admin','gestor','corretor')),
  password_hash TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usuarios_email_ativo ON usuarios(email) WHERE ativo = true;
INSERT INTO schema_migrations (version) VALUES (5) ON CONFLICT (version) DO NOTHING;

-- V6 fila persistente de tarefas e recuperação após reinício
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','completed','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_claim ON jobs(state, run_at, created_at);
INSERT INTO schema_migrations (version) VALUES (6) ON CONFLICT (version) DO NOTHING;

-- V7 entidades normalizadas (compatível com analises durante a migração)
CREATE TABLE IF NOT EXISTS imoveis (
  id TEXT PRIMARY KEY,
  titulo TEXT,
  tipo TEXT,
  finalidade TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  preco NUMERIC,
  area NUMERIC,
  quartos INTEGER,
  banheiros INTEGER,
  vagas INTEGER,
  status TEXT NOT NULL DEFAULT 'ativo',
  dados JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_imoveis_bairro ON imoveis(bairro);
CREATE INDEX IF NOT EXISTS idx_imoveis_status ON imoveis(status);

CREATE TABLE IF NOT EXISTS anuncios (
  id TEXT PRIMARY KEY,
  imovel_id TEXT NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
  fonte TEXT,
  url TEXT,
  identificador_externo TEXT,
  disponivel BOOLEAN NOT NULL DEFAULT true,
  preco NUMERIC,
  publicado_em TIMESTAMPTZ,
  ultimo_coletado_em TIMESTAMPTZ,
  dados JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE (fonte, identificador_externo),
  UNIQUE (url)
);
CREATE INDEX IF NOT EXISTS idx_anuncios_imovel ON anuncios(imovel_id);
CREATE INDEX IF NOT EXISTS idx_anuncios_fonte ON anuncios(fonte);

CREATE TABLE IF NOT EXISTS contatos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  whatsapp TEXT,
  preferencias JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  dados JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_contatos_whatsapp ON contatos(whatsapp);
CREATE INDEX IF NOT EXISTS idx_contatos_email ON contatos(email);

CREATE TABLE IF NOT EXISTS oportunidades (
  id TEXT PRIMARY KEY,
  contato_id TEXT NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  imovel_id TEXT REFERENCES imoveis(id) ON DELETE SET NULL,
  responsavel_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  etapa TEXT NOT NULL DEFAULT 'novo',
  prioridade TEXT NOT NULL DEFAULT 'normal',
  origem TEXT,
  proxima_acao_em TIMESTAMPTZ,
  dados JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_oportunidades_etapa ON oportunidades(etapa);
CREATE INDEX IF NOT EXISTS idx_oportunidades_contato ON oportunidades(contato_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_imovel ON oportunidades(imovel_id);

-- Backfill idempotente: uma análise antiga vira imóvel e seu anúncio de origem.
INSERT INTO imoveis (id, titulo, bairro, preco, area, dados, created_at, updated_at)
SELECT id, COALESCE(dados->>'titulo', dados->'extracao'->>'tipo', 'Imóvel analisado'), bairro,
       NULLIF(COALESCE(dados->'extracao'->>'preco', dados->>'preco'), '')::numeric,
       NULLIF(COALESCE(dados->'extracao'->>'area', dados->>'area'), '')::numeric,
       dados, created_at, updated_at
FROM analises
ON CONFLICT (id) DO NOTHING;
INSERT INTO anuncios (id, imovel_id, fonte, url, preco, ultimo_coletado_em, dados, created_at, updated_at)
SELECT md5(id || ':anuncio'), id, fonte, url,
       NULLIF(COALESCE(dados->'extracao'->>'preco', dados->>'preco'), '')::numeric,
       created_at, dados, created_at, updated_at
FROM analises
WHERE url IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO schema_migrations (version) VALUES (7) ON CONFLICT (version) DO NOTHING;
