-- Cache pre-digested article summaries per date so predigest and score can run independently
CREATE TABLE IF NOT EXISTS oq_predigest_cache (
  date TEXT PRIMARY KEY,
  pillar_data TEXT NOT NULL,       -- JSON: Record<pillar, string>
  article_count INTEGER NOT NULL,
  pre_digest_partial INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
