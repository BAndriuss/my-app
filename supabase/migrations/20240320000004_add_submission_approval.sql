-- Add status column to tournament_submissions
ALTER TABLE tournament_submissions
ADD COLUMN status text NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add admin_feedback column for optional feedback on rejection
ALTER TABLE tournament_submissions
ADD COLUMN admin_feedback text;

-- Add points_awarded column to track if points were given
ALTER TABLE tournament_submissions
ADD COLUMN points_awarded boolean DEFAULT false;

-- Drop any existing constraints and indexes
DROP INDEX IF EXISTS one_submission_per_trick_of_day;
DROP INDEX IF EXISTS one_approved_submission_per_trick_of_day;
ALTER TABLE tournament_submissions DROP CONSTRAINT IF EXISTS tournament_submissions_tournament_id_user_id_key;
ALTER TABLE tournament_submissions DROP CONSTRAINT IF EXISTS tournament_submissions_pkey CASCADE;
ALTER TABLE tournament_submissions ADD PRIMARY KEY (id);

-- Create unique constraint for trick of the day submissions
-- This will only prevent multiple approved submissions
CREATE UNIQUE INDEX one_approved_submission_per_trick_of_day
ON tournament_submissions (user_id, tournament_id)
WHERE status = 'approved';

-- Create function to award points when submission is approved
CREATE OR REPLACE FUNCTION award_points_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to approved and points haven't been awarded yet
  IF NEW.status = 'approved' AND NEW.points_awarded = false THEN
    -- Get tournament and trick details
    WITH tournament_info AS (
      SELECT 
        t.points,
        tt.points_multiplier,
        EXTRACT(MONTH FROM CURRENT_DATE) as current_month,
        EXTRACT(YEAR FROM CURRENT_DATE) as current_year
      FROM tournaments t
      JOIN tournament_types tt ON t.tournament_type_id = tt.id
      WHERE t.id = NEW.tournament_id
    )
    INSERT INTO skater_points (user_id, points, month, year)
    SELECT 
      NEW.user_id,
      ti.points * ti.points_multiplier,
      ti.current_month,
      ti.current_year
    FROM tournament_info ti
    ON CONFLICT (user_id, month, year) 
    DO UPDATE SET points = skater_points.points + EXCLUDED.points;

    -- Mark points as awarded
    NEW.points_awarded := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for points awarding
CREATE TRIGGER award_points_on_submission_approval
  BEFORE UPDATE ON tournament_submissions
  FOR EACH ROW
  EXECUTE FUNCTION award_points_on_approval();

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Admins can update submission status" ON tournament_submissions;

-- Add RLS policies for admin approval
CREATE POLICY "Admins can update submission status"
ON tournament_submissions
FOR UPDATE
TO authenticated
USING (
  -- Allow if user is admin
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = true
  )
); 