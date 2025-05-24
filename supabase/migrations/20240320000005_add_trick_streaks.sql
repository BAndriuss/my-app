-- Create trick_streaks table to track user streaks
CREATE TABLE trick_streaks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak int DEFAULT 1,
    last_trick_date date DEFAULT CURRENT_DATE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create unique constraint to ensure one streak record per user
CREATE UNIQUE INDEX one_streak_per_user ON trick_streaks (user_id);

-- Create function to update streak
CREATE OR REPLACE FUNCTION update_trick_streak()
RETURNS TRIGGER AS $$
DECLARE
    last_approved_date date;
    streak_record RECORD;
BEGIN
    -- Only proceed if this is an approval
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Get or create streak record
        SELECT * INTO streak_record 
        FROM trick_streaks 
        WHERE user_id = NEW.user_id;
        
        IF NOT FOUND THEN
            -- First time approval, create streak record
            INSERT INTO trick_streaks (user_id, current_streak, last_trick_date)
            VALUES (NEW.user_id, 1, CURRENT_DATE)
            RETURNING * INTO streak_record;
        ELSE
            -- Check if this is a consecutive day
            IF streak_record.last_trick_date = CURRENT_DATE - INTERVAL '1 day' THEN
                -- Increment streak
                UPDATE trick_streaks
                SET current_streak = current_streak + 1,
                    last_trick_date = CURRENT_DATE,
                    updated_at = now()
                WHERE user_id = NEW.user_id;
            ELSIF streak_record.last_trick_date < CURRENT_DATE - INTERVAL '1 day' THEN
                -- Streak broken, reset to 1
                UPDATE trick_streaks
                SET current_streak = 1,
                    last_trick_date = CURRENT_DATE,
                    updated_at = now()
                WHERE user_id = NEW.user_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for streak updates
CREATE TRIGGER update_trick_streak_on_approval
    BEFORE UPDATE ON tournament_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_trick_streak();

-- Add streak columns to skater_points table if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'skater_points' AND column_name = 'current_streak') THEN
        ALTER TABLE skater_points ADD COLUMN current_streak int DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'skater_points' AND column_name = 'last_trick_date') THEN
        ALTER TABLE skater_points ADD COLUMN last_trick_date date DEFAULT NULL;
    END IF;
END $$;

-- Enable RLS on skater_points table
ALTER TABLE skater_points ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own points" ON skater_points;
DROP POLICY IF EXISTS "Admins can view all points" ON skater_points;
DROP POLICY IF EXISTS "Admins can insert/update points" ON skater_points;

-- Create policies for skater_points table
CREATE POLICY "Users can view their own points"
ON skater_points
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all points"
ON skater_points
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

CREATE POLICY "Admins can insert/update points"
ON skater_points
FOR ALL
TO authenticated
USING (
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

-- Create function to update streak and award points
CREATE OR REPLACE FUNCTION award_points_on_approval()
RETURNS TRIGGER AS $$
DECLARE
    streak_record RECORD;
    points_to_award int;
    tournament_record RECORD;
BEGIN
    -- Debug logging
    RAISE NOTICE 'Starting award_points_on_approval for submission %', NEW.id;
    RAISE NOTICE 'Status: %, Points Awarded: %', NEW.status, NEW.points_awarded;

    -- Only proceed if status changed to approved and points haven't been awarded yet
    IF NEW.status = 'approved' AND NEW.points_awarded = false THEN
        -- Get tournament info with all necessary details
        SELECT 
            COALESCE(tr.points, t.points) as points,
            t.tournament_type_id,
            tt.points_multiplier,
            tt.frequency,
            EXTRACT(MONTH FROM CURRENT_DATE) as current_month,
            EXTRACT(YEAR FROM CURRENT_DATE) as current_year
        INTO tournament_record
        FROM tournaments t
        LEFT JOIN tricks tr ON t.trick_id = tr.id
        JOIN tournament_types tt ON t.tournament_type_id = tt.id
        WHERE t.id = NEW.tournament_id;

        -- Debug logging
        RAISE NOTICE 'Tournament info - Points: %, Multiplier: %, Frequency: %', 
            tournament_record.points, 
            tournament_record.points_multiplier, 
            tournament_record.frequency;

        -- Get or create skater_points record and handle streak
        INSERT INTO skater_points (
            user_id, 
            points,
            month, 
            year, 
            current_streak,
            last_trick_date
        )
        VALUES (
            NEW.user_id,
            tournament_record.points * tournament_record.points_multiplier, -- Set initial points
            tournament_record.current_month,
            tournament_record.current_year,
            1,
            CURRENT_DATE
        )
        ON CONFLICT (user_id, month, year) 
        DO UPDATE SET 
            points = 
                CASE 
                    WHEN tournament_record.frequency = 'daily' THEN
                        CASE
                            WHEN skater_points.last_trick_date = CURRENT_DATE - INTERVAL '1 day' 
                            THEN skater_points.points + (tournament_record.points * tournament_record.points_multiplier * (skater_points.current_streak + 1))
                            WHEN skater_points.last_trick_date = CURRENT_DATE
                            THEN skater_points.points -- Don't add points if already submitted today
                            ELSE skater_points.points + (tournament_record.points * tournament_record.points_multiplier)
                        END
                    ELSE skater_points.points + (tournament_record.points * tournament_record.points_multiplier)
                END,
            last_trick_date = 
                CASE 
                    WHEN tournament_record.frequency = 'daily' AND 
                         (skater_points.last_trick_date IS NULL OR 
                          skater_points.last_trick_date < CURRENT_DATE)
                    THEN CURRENT_DATE
                    ELSE skater_points.last_trick_date
                END,
            current_streak = 
                CASE
                    WHEN tournament_record.frequency = 'daily' THEN
                        CASE
                            WHEN skater_points.last_trick_date = CURRENT_DATE - INTERVAL '1 day' 
                            THEN skater_points.current_streak + 1
                            WHEN skater_points.last_trick_date = CURRENT_DATE
                            THEN skater_points.current_streak -- Keep current streak if already submitted today
                            ELSE 1
                        END
                    ELSE skater_points.current_streak
                END
        RETURNING * INTO streak_record;

        -- Debug logging
        RAISE NOTICE 'Updated points record - Points: %, Streak: %, Last Trick Date: %',
            streak_record.points,
            streak_record.current_streak,
            streak_record.last_trick_date;

        -- Mark points as awarded
        NEW.points_awarded := true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Make sure we have the trigger
DROP TRIGGER IF EXISTS award_points_on_approval_trigger ON tournament_submissions;
CREATE TRIGGER award_points_on_approval_trigger
    BEFORE UPDATE ON tournament_submissions
    FOR EACH ROW
    EXECUTE FUNCTION award_points_on_approval(); 