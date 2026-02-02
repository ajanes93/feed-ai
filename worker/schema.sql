-- Sources to monitor
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'rss', 'reddit', 'github', 'hn'
  url TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'ai', 'jobs', 'dev', 'competitors'
  active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Daily digests
CREATE TABLE digests (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,  -- '2026-01-29'
  item_count INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Digest items
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  digest_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  why_it_matters TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_at TEXT,
  position INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (digest_id) REFERENCES digests(id)
);

-- Raw fetched items (accumulated throughout the day)
CREATE TABLE raw_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  title TEXT,
  link TEXT,
  content TEXT,
  published_at INTEGER,
  fetched_at INTEGER DEFAULT (unixepoch()),
  date TEXT
);

-- Source health tracking
CREATE TABLE IF NOT EXISTS source_health (
  source_id TEXT PRIMARY KEY,
  last_success_at INTEGER,
  last_error_at INTEGER,
  last_error TEXT,
  item_count INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0
);

-- AI usage tracking per digest generation
CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,       -- 'gemini' or 'anthropic'
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  latency_ms INTEGER,
  was_fallback INTEGER DEFAULT 0,
  error TEXT,
  status TEXT NOT NULL,         -- 'success', 'rate_limited', 'error'
  created_at INTEGER DEFAULT (unixepoch())
);

-- General error/event log
CREATE TABLE IF NOT EXISTS error_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,          -- 'info', 'warn', 'error'
  category TEXT NOT NULL,       -- 'ai', 'fetch', 'parse', 'general', 'digest', 'summarizer'
  message TEXT NOT NULL,
  details TEXT,                 -- JSON blob for extra context
  source_id TEXT,
  digest_id TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_ai_usage_created ON ai_usage(created_at);
CREATE INDEX idx_error_logs_created ON error_logs(created_at);
CREATE INDEX idx_error_logs_category ON error_logs(category);
CREATE INDEX idx_error_logs_level ON error_logs(level);

CREATE INDEX idx_digests_date ON digests(date);
CREATE INDEX idx_items_digest ON items(digest_id);
CREATE INDEX idx_items_position ON items(position);
CREATE INDEX idx_raw_items_fetched ON raw_items(fetched_at);
CREATE INDEX idx_raw_items_date ON raw_items(date);
CREATE UNIQUE INDEX idx_raw_items_source_link ON raw_items(source_id, link);
