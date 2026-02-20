-- Seed 7 days of historical data for the trend chart
-- Run once before launch: npx wrangler d1 execute one-question --file=scripts/seed-history.sql

INSERT OR IGNORE INTO oq_scores (id, date, score, score_technical, score_economic, delta, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, capability_gap, prompt_hash) VALUES
  (hex(randomblob(16)), '2026-02-13', 28, 22, 34, 0, 'Seed data — live tracking begins 2026-02-20.', '[]', '{"capability":0,"labour_market":0,"sentiment":0,"industry":0,"barriers":0}', '[]', 'partial', 0, NULL, 'seed'),
  (hex(randomblob(16)), '2026-02-14', 29, 23, 35, 1, 'Seed data — live tracking begins 2026-02-20.', '[]', '{"capability":0,"labour_market":0,"sentiment":0,"industry":0,"barriers":0}', '[]', 'partial', 0, NULL, 'seed'),
  (hex(randomblob(16)), '2026-02-15', 29, 23, 35, 0, 'Seed data — live tracking begins 2026-02-20.', '[]', '{"capability":0,"labour_market":0,"sentiment":0,"industry":0,"barriers":0}', '[]', 'partial', 0, NULL, 'seed'),
  (hex(randomblob(16)), '2026-02-16', 30, 24, 36, 1, 'Seed data — live tracking begins 2026-02-20.', '[]', '{"capability":0,"labour_market":0,"sentiment":0,"industry":0,"barriers":0}', '[]', 'partial', 0, NULL, 'seed'),
  (hex(randomblob(16)), '2026-02-17', 31, 24, 37, 1, 'Seed data — live tracking begins 2026-02-20.', '[]', '{"capability":0,"labour_market":0,"sentiment":0,"industry":0,"barriers":0}', '[]', 'partial', 0, NULL, 'seed'),
  (hex(randomblob(16)), '2026-02-18', 31, 25, 37, 0, 'Seed data — live tracking begins 2026-02-20.', '[]', '{"capability":0,"labour_market":0,"sentiment":0,"industry":0,"barriers":0}', '[]', 'partial', 0, NULL, 'seed'),
  (hex(randomblob(16)), '2026-02-19', 32, 25, 38, 1, 'Seed data — live tracking begins 2026-02-20.', '[]', '{"capability":0,"labour_market":0,"sentiment":0,"industry":0,"barriers":0}', '[]', 'partial', 0, NULL, 'seed');
