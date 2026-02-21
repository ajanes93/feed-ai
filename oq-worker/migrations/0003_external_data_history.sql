-- Replace the key-value oq_external_data with a proper time-series table.
-- Every fetch is preserved for trend analysis and future features.

CREATE TABLE IF NOT EXISTS oq_external_data_history (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,                        -- "fred_labour", "swe_bench", "sanity_harness"
  value TEXT NOT NULL,                      -- JSON snapshot at time of fetch
  fetched_at TEXT DEFAULT (datetime('now'))  -- When this snapshot was captured
);

CREATE INDEX IF NOT EXISTS idx_edh_key_fetched
  ON oq_external_data_history (key, fetched_at DESC);

-- Migrate any existing data from the old table into history
INSERT INTO oq_external_data_history (id, key, value, fetched_at)
  SELECT lower(hex(randomblob(16))), key, value, updated_at
  FROM oq_external_data;

-- Drop the old key-value table
DROP TABLE IF EXISTS oq_external_data;
