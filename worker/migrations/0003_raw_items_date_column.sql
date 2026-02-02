-- Recreate raw_items without FK constraint (sources table is not populated;
-- source config lives in code) and add date column + unique index.

DROP INDEX IF EXISTS idx_raw_items_fetched;

CREATE TABLE raw_items_new (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  title TEXT,
  link TEXT,
  content TEXT,
  published_at INTEGER,
  fetched_at INTEGER DEFAULT (unixepoch()),
  date TEXT
);

INSERT INTO raw_items_new SELECT id, source_id, title, link, content, published_at, fetched_at, NULL FROM raw_items;
DROP TABLE raw_items;
ALTER TABLE raw_items_new RENAME TO raw_items;

CREATE INDEX idx_raw_items_fetched ON raw_items(fetched_at);
CREATE INDEX idx_raw_items_date ON raw_items(date);
CREATE UNIQUE INDEX idx_raw_items_source_link ON raw_items(source_id, link);
