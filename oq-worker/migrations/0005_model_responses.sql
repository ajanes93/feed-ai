-- Per-model responses for full transparency and auditability
-- Each row is one model's complete response for one day's score
CREATE TABLE IF NOT EXISTS oq_model_responses (
  id TEXT PRIMARY KEY,
  score_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  raw_response TEXT NOT NULL,           -- Exact text returned by the model
  pillar_scores TEXT NOT NULL,          -- JSON: {"capability": 2.3, ...}
  technical_delta REAL NOT NULL,
  economic_delta REAL NOT NULL,
  suggested_delta REAL NOT NULL,
  analysis TEXT NOT NULL,               -- Model's own analysis text
  top_signals TEXT NOT NULL,            -- JSON array of signals
  capability_gap_note TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_model_resp_score ON oq_model_responses (score_id);
CREATE INDEX IF NOT EXISTS idx_model_resp_model ON oq_model_responses (model);
CREATE INDEX IF NOT EXISTS idx_model_resp_created ON oq_model_responses (created_at DESC);
