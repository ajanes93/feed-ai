-- Add date column to raw_items for daily grouping
ALTER TABLE raw_items ADD COLUMN date TEXT;

-- Index for querying today's raw items
CREATE INDEX IF NOT EXISTS idx_raw_items_date ON raw_items(date);

-- Unique constraint to avoid storing duplicate articles
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_items_source_link ON raw_items(source_id, link);
