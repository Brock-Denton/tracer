-- Create users table (simple username-based)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  goal_pct INTEGER CHECK (goal_pct >= 0 AND goal_pct <= 100),
  icon TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  exclude_from_goals BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vision_photos table
CREATE TABLE IF NOT EXISTS vision_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  src TEXT NOT NULL,
  alt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_photos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users (anyone can read, insert their own)
CREATE POLICY "Anyone can view users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert users" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update themselves" ON users
  FOR UPDATE USING (true);

-- Create RLS policies for categories (no auth required for simplicity)
CREATE POLICY "Users can view all categories" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Users can insert categories" ON categories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update categories" ON categories
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete categories" ON categories
  FOR DELETE USING (true);

-- Create RLS policies for sessions
CREATE POLICY "Users can view all sessions" ON sessions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert sessions" ON sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update sessions" ON sessions
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete sessions" ON sessions
  FOR DELETE USING (true);

-- Create RLS policies for goals
CREATE POLICY "Users can view all goals" ON goals
  FOR SELECT USING (true);

CREATE POLICY "Users can insert goals" ON goals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update goals" ON goals
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete goals" ON goals
  FOR DELETE USING (true);

-- Create RLS policies for vision_photos
CREATE POLICY "Users can view all vision photos" ON vision_photos
  FOR SELECT USING (true);

CREATE POLICY "Users can insert vision photos" ON vision_photos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update vision photos" ON vision_photos
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete vision photos" ON vision_photos
  FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_category_id ON sessions(category_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_category_id ON goals(category_id);
CREATE INDEX IF NOT EXISTS idx_vision_photos_user_id ON vision_photos(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vision_photos_updated_at BEFORE UPDATE ON vision_photos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
