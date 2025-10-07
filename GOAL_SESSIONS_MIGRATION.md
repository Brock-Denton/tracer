# Goal Sessions Table Migration

## Problem
The `goal_sessions` table doesn't exist in your Supabase database, causing HTTP 400 errors when trying to create goal sessions.

## Solution
Run the SQL migration to create the `goal_sessions` table.

## Steps

### 1. Run the Migration
Execute the SQL in `supabase-create-goal-sessions.sql` in your Supabase SQL Editor:

```sql
-- Create goal_sessions table
CREATE TABLE IF NOT EXISTS goal_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
```

### 2. Refresh the App
After running the migration:
1. Refresh the app in your browser
2. The default goal sessions should be created automatically
3. Check the `goal_sessions` table in Supabase to confirm entries were created

### 3. Test the Week View
Once goal sessions are created, test the Week view to see if the VisionGoals totals are now accurate.

## What This Does
- Creates the `goal_sessions` table with proper structure
- Sets up indexes for performance
- Enables Row Level Security
- Creates automatic goal sessions for existing goals
- Fixes the Week view VisionGoals calculation issue
