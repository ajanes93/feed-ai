-- Operational audit tables for cron runs, fetch errors, and admin actions
-- Essential for proving data completeness and tracking manual interventions

-- Record every cron execution attempt
CREATE TABLE IF NOT EXISTS oq_cron_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  fetch_status TEXT NOT NULL DEFAULT 'pending',    -- pending, success, failed
  fetch_articles INTEGER DEFAULT 0,
  fetch_errors TEXT,                                -- JSON array of error strings
  score_status TEXT NOT NULL DEFAULT 'pending',     -- pending, success, failed, skipped
  score_result TEXT,                                -- JSON: {score, delta} or error
  external_fetch_status TEXT,                       -- JSON: {sanity: ok/failed, swe: ok/failed, fred: ok/failed}
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_started ON oq_cron_runs (started_at DESC);

-- Persist feed fetch/parse errors for source health monitoring
CREATE TABLE IF NOT EXISTS oq_fetch_errors (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  error_type TEXT NOT NULL,                         -- http_error, parse_error, timeout
  error_message TEXT NOT NULL,
  http_status INTEGER,
  attempted_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fetch_errors_source ON oq_fetch_errors (source_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_fetch_errors_at ON oq_fetch_errors (attempted_at DESC);

-- Audit log for all admin endpoint calls
CREATE TABLE IF NOT EXISTS oq_admin_actions (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,                             -- fetch, score, fetch-sanity, fetch-swebench, fetch-fred
  endpoint TEXT NOT NULL,
  result_status INTEGER NOT NULL,                   -- HTTP status code
  result_summary TEXT,                              -- Brief JSON result
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_at ON oq_admin_actions (created_at DESC);

-- Track data completeness on each score
ALTER TABLE oq_scores ADD COLUMN data_quality_flags TEXT;
