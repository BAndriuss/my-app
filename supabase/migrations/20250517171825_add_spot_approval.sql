-- Enable RLS on spots table if not already enabled
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;

-- Add is_approved column to spots table
ALTER TABLE spots ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- Update existing spots to be approved (since they were created before this feature)
UPDATE spots SET is_approved = true WHERE is_approved IS NULL;

-- Make is_approved non-nullable
ALTER TABLE spots ALTER COLUMN is_approved SET NOT NULL;

-- Create policy to allow admins to update spots
CREATE POLICY "Admins can update any spot"
ON spots
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Create policy to allow all users to view spots
CREATE POLICY "Anyone can view spots"
ON spots
FOR SELECT
USING (true);
