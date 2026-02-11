-- Track which raw_items have been summarized for incremental digest builds
ALTER TABLE raw_items ADD COLUMN summarized_at INTEGER;
