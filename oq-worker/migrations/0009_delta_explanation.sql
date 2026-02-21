-- Add delta_explanation column to store AI-generated explanation of what drove the score change
ALTER TABLE oq_scores ADD COLUMN delta_explanation TEXT;
