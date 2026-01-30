-- Source health tracking for P4-1 / P4-2
CREATE TABLE IF NOT EXISTS source_health (
  source_id TEXT PRIMARY KEY,
  last_success_at INTEGER,
  last_error_at INTEGER,
  last_error TEXT,
  item_count INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0
);
