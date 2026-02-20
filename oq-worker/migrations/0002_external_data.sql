-- Key-value store for external data sources (SanityHarness, SWE-bench, FRED)
CREATE TABLE IF NOT EXISTS oq_external_data (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
