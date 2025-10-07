-- Basic goal_sessions table creation
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
