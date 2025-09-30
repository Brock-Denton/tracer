-- Add time tracking columns to goals table
ALTER TABLE goals ADD COLUMN IF NOT EXISTS total_seconds INTEGER DEFAULT 0;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS last_start_time TIMESTAMP WITH TIME ZONE;

-- Create goal_sessions table to track individual time sessions for goals
CREATE TABLE IF NOT EXISTS goal_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE goal_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for goal_sessions
CREATE POLICY "Users can view all goal sessions" ON goal_sessions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert goal sessions" ON goal_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update goal sessions" ON goal_sessions
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete goal sessions" ON goal_sessions
  FOR DELETE USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_goal_sessions_goal_id ON goal_sessions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_sessions_start_time ON goal_sessions(start_time);

-- Create trigger for goal_sessions
CREATE TRIGGER update_goal_sessions_updated_at BEFORE UPDATE ON goal_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
