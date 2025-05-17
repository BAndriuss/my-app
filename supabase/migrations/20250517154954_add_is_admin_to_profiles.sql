-- Add is_admin column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Update existing profiles to have is_admin set to false
UPDATE profiles SET is_admin = false WHERE is_admin IS NULL;

-- Make is_admin non-nullable
ALTER TABLE profiles ALTER COLUMN is_admin SET NOT NULL;
