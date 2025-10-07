# Exclude From Goals Feature - Migration Instructions

## What This Feature Does
Allows you to mark categories (like "Sleep") to be excluded from the 100% goal calculation, so they don't throw off your goal percentages.

## Before Testing - Run Database Migration

### Step 1: Run the SQL Migration on Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase-add-exclude-from-goals.sql`:
   ```sql
   ALTER TABLE categories ADD COLUMN IF NOT EXISTS exclude_from_goals BOOLEAN DEFAULT FALSE;
   ```
4. Click **Run** to execute the migration
5. You should see "Success. No rows returned"

### Step 2: Test the Feature

1. Refresh your app at `http://192.168.4.25:3000`
2. Go to the **Time** page
3. Click the **pencil icon** (edit mode button) at the top
4. Click the **pencil icon** on any category (like Sleep) to edit it
5. You should see a new checkbox: **"Exclude from 100% goal calculation"**
6. Check the box and click **Save**
7. Now that category's goal percentage won't count toward the 100% total

## How It Works

- Categories with "Exclude from Goals" checked will still track time normally
- They just won't be included when calculating if your goals add up to 100%
- **Share %** for excluded categories shows their percentage of ALL time
- **Share %** for included categories shows their percentage of only included time
- Perfect for Sleep, Commute, or other categories that shouldn't count toward your productive time goals

## Fixed Issue
- ✅ Share percentages now correctly exclude marked categories from the 100% calculation
- ✅ Excluded categories show their raw percentage of all time
- ✅ Included categories show their percentage of only included time

## Testing Checklist

- [ ] Migration runs successfully on Supabase
- [ ] Checkbox appears in category editor
- [ ] Checking the box saves correctly
- [ ] Excluded categories don't count toward 100% goal validation
- [ ] Can still add/edit goal percentages for excluded categories
- [ ] Non-excluded categories still validate properly (must sum to ≤100%)

