-- Data integrity improvements: linkage, attribution, indexes, validation
-- Makes every score fully auditable and reproducible

-- 1. Article-to-score linkage: which articles informed each score
CREATE TABLE IF NOT EXISTS oq_score_articles (
  score_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  PRIMARY KEY (score_id, article_id)
);

-- 2. Add score attribution to AI usage (which score this call was for)
-- SQLite doesn't support ADD COLUMN with NOT NULL without default, so nullable
ALTER TABLE oq_ai_usage ADD COLUMN score_id TEXT;

-- 3. Add external data snapshot and decay audit fields to scores
ALTER TABLE oq_scores ADD COLUMN external_data TEXT;
ALTER TABLE oq_scores ADD COLUMN is_decay INTEGER NOT NULL DEFAULT 0;

-- 4. Indexes on hot query paths
CREATE INDEX IF NOT EXISTS idx_articles_fetched_at ON oq_articles (fetched_at);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON oq_articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source ON oq_articles (source);
CREATE INDEX IF NOT EXISTS idx_articles_pillar ON oq_articles (pillar);
CREATE INDEX IF NOT EXISTS idx_scores_date ON oq_scores (date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON oq_ai_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_score ON oq_ai_usage (score_id);
CREATE INDEX IF NOT EXISTS idx_score_articles_score ON oq_score_articles (score_id);
CREATE INDEX IF NOT EXISTS idx_score_articles_article ON oq_score_articles (article_id);
