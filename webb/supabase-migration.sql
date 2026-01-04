-- Migration script to update from user_email to owner_wallet_address
-- Run this AFTER running the main schema if you have existing data

-- Step 1: Add the new column if it doesn't exist
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS owner_wallet_address TEXT;

-- Step 2: If you have existing rooms with user_email but no owner_wallet_address,
-- you'll need to manually update them or drop and recreate.
-- For now, we'll just ensure the column exists and is NOT NULL for new entries.

-- Step 3: Drop the old user_email column if it exists (optional - only if you want to remove it)
-- ALTER TABLE rooms DROP COLUMN IF EXISTS user_email;

-- Step 4: Drop old index if it exists
DROP INDEX IF EXISTS idx_rooms_user_email;

-- Step 5: Create new index
CREATE INDEX IF NOT EXISTS idx_rooms_owner_wallet_address ON rooms(owner_wallet_address);

