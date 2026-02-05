-- Add comment summary fields to digest items
ALTER TABLE items ADD COLUMN comment_summary TEXT;
ALTER TABLE items ADD COLUMN comment_count INTEGER;
ALTER TABLE items ADD COLUMN comment_score INTEGER;
ALTER TABLE items ADD COLUMN comment_summary_source TEXT;
