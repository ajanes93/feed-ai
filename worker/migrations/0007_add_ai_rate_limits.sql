CREATE TABLE ai_rate_limits (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_ai_rate_limits_lookup ON ai_rate_limits(fingerprint, created_at);
