-- Add comments_url to store HN discussion URLs alongside article URLs
ALTER TABLE items ADD COLUMN comments_url TEXT;
ALTER TABLE raw_items ADD COLUMN comments_url TEXT;
