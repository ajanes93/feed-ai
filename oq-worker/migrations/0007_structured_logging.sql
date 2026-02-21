-- Structured log table for the OQ worker
-- Replaces scattered console.log/error/warn with DB-persisted, queryable logs
-- Schema matches shared Logger class: context stored in details JSON

CREATE TABLE IF NOT EXISTS oq_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,                               -- info, warn, error
  category TEXT NOT NULL,                            -- cron, fetch, score, external, admin, system
  message TEXT NOT NULL,
  details TEXT,                                      -- JSON: structured context (cronRunId, sourceId, etc.)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_level ON oq_logs (level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_category ON oq_logs (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_created ON oq_logs (created_at DESC);
