-- Simple goal_sessions table creation (without foreign keys initially)
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_goal_sessions_user_id ON goal_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_sessions_goal_id ON goal_sessions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_sessions_start_time ON goal_sessions(start_time);

-- Enable RLS
ALTER TABLE goal_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (using user_id directly since we don't know the exact auth setup)
CREATE POLICY "Users can only access their own goal sessions" ON goal_sessions
  FOR ALL USING (user_id = (SELECT id FROM users WHERE username = current_setting('app.current_user', true)));

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
