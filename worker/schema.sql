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

-- Raw fetched items (for debugging/reprocessing)
CREATE TABLE raw_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  title TEXT,
  link TEXT,
  content TEXT,
  published_at INTEGER,
  fetched_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (source_id) REFERENCES sources(id)
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

CREATE INDEX idx_digests_date ON digests(date);
CREATE INDEX idx_items_digest ON items(digest_id);
CREATE INDEX idx_items_position ON items(position);
CREATE INDEX idx_raw_items_fetched ON raw_items(fetched_at);
