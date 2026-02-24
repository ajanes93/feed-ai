-- Add labour_note for software vs. general job posting divergence commentary
ALTER TABLE oq_scores ADD COLUMN labour_note TEXT;
ALTER TABLE oq_model_responses ADD COLUMN labour_note TEXT;
