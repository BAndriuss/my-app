-- Drop existing function and trigger
DROP TRIGGER IF EXISTS award_points_on_approval_trigger ON tournament_submissions;
DROP TRIGGER IF EXISTS award_points_on_submission_approval ON tournament_submissions;
DROP FUNCTION IF EXISTS award_points_on_approval();

-- Create the fixed points awarding function
CREATE OR REPLACE FUNCTION award_points_on_approval()
RETURNS TRIGGER AS $$
DECLARE
    points_to_award int;
    tournament_record RECORD;
    current_points_record RECORD;
BEGIN
    -- Only proceed if status changed from pending to approved
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
        RAISE NOTICE 'Processing points for submission % (user: %)', NEW.id, NEW.user_id;

        -- Get tournament info
        SELECT 
            COALESCE(tr.points, t.points) as base_points,
            tt.points_multiplier,
            tt.frequency
        INTO tournament_record
        FROM tournaments t
        LEFT JOIN tricks tr ON t.trick_id = tr.id
        JOIN tournament_types tt ON t.tournament_type_id = tt.id
        WHERE t.id = NEW.tournament_id;

        RAISE NOTICE 'Tournament info - Base Points: %, Multiplier: %, Frequency: %', 
            tournament_record.base_points, 
            tournament_record.points_multiplier,
            tournament_record.frequency;

        -- Get current points record if exists
        SELECT * INTO current_points_record
        FROM skater_points
        WHERE user_id = NEW.user_id
        AND month = EXTRACT(MONTH FROM CURRENT_DATE)
        AND year = EXTRACT(YEAR FROM CURRENT_DATE);

        -- Calculate base points
        points_to_award := tournament_record.base_points * tournament_record.points_multiplier;

        -- Calculate streak multiplier for daily tournaments
        IF tournament_record.frequency = 'daily' AND current_points_record IS NOT NULL THEN
            IF current_points_record.last_trick_date = CURRENT_DATE - INTERVAL '1 day' THEN
                points_to_award := points_to_award * (current_points_record.current_streak + 1);
                RAISE NOTICE 'Applying streak multiplier: x%', current_points_record.current_streak + 1;
            END IF;
        END IF;

        RAISE NOTICE 'Awarding % points to user %', points_to_award, NEW.user_id;

        -- Update or create points record
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
            points_to_award,
            EXTRACT(MONTH FROM CURRENT_DATE),
            EXTRACT(YEAR FROM CURRENT_DATE),
            CASE 
                WHEN tournament_record.frequency = 'daily' THEN
                    CASE
                        WHEN current_points_record IS NULL THEN 1
                        WHEN current_points_record.last_trick_date = CURRENT_DATE - INTERVAL '1 day' 
                        THEN current_points_record.current_streak + 1
                        WHEN current_points_record.last_trick_date = CURRENT_DATE 
                        THEN current_points_record.current_streak
                        ELSE 1
                    END
                ELSE 1
            END,
            CURRENT_DATE
        )
        ON CONFLICT (user_id, month, year) 
        DO UPDATE SET 
            points = 
                CASE 
                    WHEN tournament_record.frequency = 'daily' 
                    AND skater_points.last_trick_date = CURRENT_DATE - INTERVAL '1 day' 
                    THEN skater_points.points + points_to_award
                    WHEN tournament_record.frequency = 'daily' 
                    AND skater_points.last_trick_date = CURRENT_DATE 
                    THEN skater_points.points
                    ELSE skater_points.points + points_to_award
                END,
            current_streak = 
                CASE 
                    WHEN tournament_record.frequency = 'daily' THEN
                        CASE
                            WHEN skater_points.last_trick_date = CURRENT_DATE - INTERVAL '1 day' 
                            THEN skater_points.current_streak + 1
                            WHEN skater_points.last_trick_date = CURRENT_DATE 
                            THEN skater_points.current_streak
                            ELSE 1
                        END
                    ELSE skater_points.current_streak
                END,
            last_trick_date = CURRENT_DATE;

        -- Get final points record for logging
        SELECT * INTO current_points_record
        FROM skater_points
        WHERE user_id = NEW.user_id
        AND month = EXTRACT(MONTH FROM CURRENT_DATE)
        AND year = EXTRACT(YEAR FROM CURRENT_DATE);

        RAISE NOTICE 'Successfully awarded points. New stats: Points: %, Streak: %, Last Trick Date: %',
            current_points_record.points,
            current_points_record.current_streak,
            current_points_record.last_trick_date;

        -- Mark points as awarded
        NEW.points_awarded := true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER award_points_on_approval_trigger
    BEFORE UPDATE ON tournament_submissions
    FOR EACH ROW
    EXECUTE FUNCTION award_points_on_approval();

-- Reset points for testing
UPDATE tournament_submissions SET points_awarded = false WHERE status = 'approved';
UPDATE skater_points SET points = 0, current_streak = 1; 