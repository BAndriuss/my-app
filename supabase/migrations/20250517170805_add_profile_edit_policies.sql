-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create new update policy that allows both owners and admins to update profiles
CREATE POLICY "Users can update own profile or admins can update any profile"
ON profiles
FOR UPDATE
USING (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);
