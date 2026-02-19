-- One Question: "Will AI replace software engineers?" score tracker
-- Articles fetched from RSS sources, grouped by pillar
CREATE TABLE IF NOT EXISTS oq_articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL,
  pillar TEXT NOT NULL,
  summary TEXT,
  published_at TEXT NOT NULL,
  fetched_at TEXT DEFAULT (datetime('now'))
);

-- Daily consensus scores from multi-model AI analysis
CREATE TABLE IF NOT EXISTS oq_scores (
  id TEXT PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,
  score INTEGER NOT NULL,
  score_technical INTEGER NOT NULL,
  score_economic INTEGER NOT NULL,
  delta REAL NOT NULL,
  analysis TEXT NOT NULL,
  signals TEXT NOT NULL,
  pillar_scores TEXT NOT NULL,
  model_scores TEXT NOT NULL,
  model_agreement TEXT NOT NULL,
  model_spread REAL NOT NULL,
  capability_gap TEXT,
  prompt_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Email subscribers for future newsletter
CREATE TABLE IF NOT EXISTS oq_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Prompt version tracking for auditability
CREATE TABLE IF NOT EXISTS oq_prompt_versions (
  id TEXT PRIMARY KEY,
  hash TEXT UNIQUE NOT NULL,
  prompt_text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
