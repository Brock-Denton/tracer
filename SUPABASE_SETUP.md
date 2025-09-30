# Supabase Integration Setup

This project now includes Supabase integration for persistent data storage. Follow these steps to set up your Supabase project:

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your project URL and anon key from the project settings

## 2. Set Up Environment Variables

Create a `.env.local` file in your project root with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. Set Up Database Schema

Run the SQL commands from `supabase-schema.sql` in your Supabase SQL editor:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase-schema.sql`
4. Execute the SQL to create all tables, policies, and indexes

## 4. Enable Authentication

1. Go to Authentication > Settings in your Supabase dashboard
2. Configure your authentication settings (email/password is already set up)
3. Optionally configure email templates and other auth settings

## 5. Data Migration

The app includes automatic migration from localStorage to Supabase:

- When a user logs in for the first time, the app will check for existing localStorage data
- If found, it will automatically migrate the data to Supabase
- The localStorage data will be cleared after successful migration

## Database Schema

The database includes these tables:

### Categories
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to auth.users)
- `name` (Text)
- `color` (Text)
- `goal_pct` (Integer, 0-100)
- `icon` (Text, optional)
- `parent_id` (UUID, Foreign Key to categories, optional)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Sessions
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to auth.users)
- `category_id` (UUID, Foreign Key to categories)
- `start_time` (Timestamp)
- `end_time` (Timestamp, optional)
- `duration_seconds` (Integer, optional)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Goals
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to auth.users)
- `category_id` (UUID, Foreign Key to categories)
- `text` (Text)
- `completed` (Boolean)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Vision Photos
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to auth.users)
- `src` (Text)
- `alt` (Text)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

## Features

- **Row Level Security (RLS)**: All data is automatically filtered by user
- **Real-time Updates**: Changes sync across devices in real-time
- **Automatic Timestamps**: Created and updated timestamps are managed automatically
- **Data Migration**: Seamless migration from localStorage to Supabase
- **Type Safety**: Full TypeScript support with generated types

## Usage

The integration is handled through the `DataService` class in `lib/dataService.ts`. All CRUD operations are available for each data type, with automatic user filtering and real-time subscriptions.

## Security

- All tables have Row Level Security enabled
- Users can only access their own data
- All operations are automatically filtered by the authenticated user
- No data leakage between users is possible
