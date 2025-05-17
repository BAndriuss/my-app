-- Enable RLS on spots table if not already enabled
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Users can delete their own spots" ON spots;

-- Create new delete policy that allows both owners and admins to delete spots
CREATE POLICY "Users can delete their own spots or admins can delete any spot"
ON spots
FOR DELETE
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);
