-- First, let's check what columns exist in the goals table
-- This will help us understand the correct foreign key reference

-- Create goal_sessions table (without foreign key constraints initially)
CREATE TABLE IF NOT EXISTS goal_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_id UUID NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraints after table creation
-- (We'll add these once we confirm the correct column names)
-- ALTER TABLE goal_sessions ADD CONSTRAINT fk_goal_sessions_user_id 
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE goal_sessions ADD CONSTRAINT fk_goal_sessions_goal_id 
--   FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_goal_sessions_user_id ON goal_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_sessions_goal_id ON goal_sessions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_sessions_start_time ON goal_sessions(start_time);

-- Enable Row Level Security (RLS)
ALTER TABLE goal_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to ensure users can only access their own goal sessions
CREATE POLICY "Users can only access their own goal sessions" ON goal_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_goal_sessions_updated_at 
  BEFORE UPDATE ON goal_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
