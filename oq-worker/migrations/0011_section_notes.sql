-- Add per-section dynamic notes from scorer output
-- These store AI-generated interpretations for SanityHarness and Economic sections
ALTER TABLE oq_scores ADD COLUMN sanity_harness_note TEXT;
ALTER TABLE oq_scores ADD COLUMN economic_note TEXT;

-- Add corresponding columns to model_responses for per-model transparency
ALTER TABLE oq_model_responses ADD COLUMN sanity_harness_note TEXT;
ALTER TABLE oq_model_responses ADD COLUMN economic_note TEXT;

-- Enhance prompt_versions with audit trail fields
ALTER TABLE oq_prompt_versions ADD COLUMN first_used TEXT;
ALTER TABLE oq_prompt_versions ADD COLUMN last_used TEXT;
ALTER TABLE oq_prompt_versions ADD COLUMN change_summary TEXT;

-- Funding events extracted from RSS articles by the scoring pipeline
CREATE TABLE IF NOT EXISTS oq_funding_events (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  amount TEXT,
  round TEXT,
  valuation TEXT,
  source_url TEXT,
  date TEXT,
  relevance TEXT,
  extracted_from_article_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_funding_events_date ON oq_funding_events (date DESC);
CREATE INDEX IF NOT EXISTS idx_funding_events_company ON oq_funding_events (company);
