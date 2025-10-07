-- Add user_id column to goal_sessions table if it doesn't exist
ALTER TABLE goal_sessions ADD COLUMN IF NOT EXISTS user_id UUID;

-- Update existing records to use the specific user_id you mentioned
UPDATE goal_sessions SET user_id = '54d45abf-11db-42d7-9c8e-22a57e761912' WHERE user_id IS NULL;

-- Make user_id NOT NULL after setting the values
ALTER TABLE goal_sessions ALTER COLUMN user_id SET NOT NULL;

-- Create index on user_id for better performance
CREATE INDEX IF NOT EXISTS idx_goal_sessions_user_id ON goal_sessions(user_id);

-- Add foreign key constraint to users table (if users table exists)
-- ALTER TABLE goal_sessions ADD CONSTRAINT fk_goal_sessions_user_id 
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
