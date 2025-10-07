-- Add exclude_from_goals column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS exclude_from_goals BOOLEAN DEFAULT FALSE;


