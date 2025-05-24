-- Function to test points awarding directly
CREATE OR REPLACE FUNCTION test_award_points(submission_id uuid)
RETURNS void AS $$
DECLARE
    submission_record RECORD;
    tournament_record RECORD;
    points_to_award int;
    current_points_record RECORD;
BEGIN
    -- Get submission details
    SELECT * INTO submission_record
    FROM tournament_submissions
    WHERE id = submission_id;

    IF submission_record IS NULL THEN
        RAISE EXCEPTION 'Submission not found: %', submission_id;
    END IF;

    RAISE NOTICE 'Processing submission: % for user: %', submission_id, submission_record.user_id;

    -- Get tournament details
    SELECT 
        COALESCE(tr.points, t.points) as points,
        t.tournament_type_id,
        tt.points_multiplier,
        tt.frequency
    INTO tournament_record
    FROM tournaments t
    LEFT JOIN tricks tr ON t.trick_id = tr.id
    JOIN tournament_types tt ON t.tournament_type_id = tt.id
    WHERE t.id = submission_record.tournament_id;

    IF tournament_record IS NULL THEN
        RAISE EXCEPTION 'Tournament not found for submission: %', submission_id;
    END IF;

    RAISE NOTICE 'Tournament details - Points: %, Multiplier: %, Frequency: %', 
        tournament_record.points, 
        tournament_record.points_multiplier,
        tournament_record.frequency;

    -- Get current points record if exists
    SELECT * INTO current_points_record
    FROM skater_points
    WHERE user_id = submission_record.user_id
    AND month = EXTRACT(MONTH FROM CURRENT_DATE)
    AND year = EXTRACT(YEAR FROM CURRENT_DATE);

    -- Calculate points
    points_to_award := tournament_record.points * tournament_record.points_multiplier;

    -- Calculate streak multiplier for daily tournaments
    IF tournament_record.frequency = 'daily' AND current_points_record IS NOT NULL THEN
        IF current_points_record.last_trick_date = CURRENT_DATE - INTERVAL '1 day' THEN
            points_to_award := points_to_award * (current_points_record.current_streak + 1);
            RAISE NOTICE 'Applying streak multiplier: x%', current_points_record.current_streak + 1;
        END IF;
    END IF;

    RAISE NOTICE 'Awarding % points to user %', points_to_award, submission_record.user_id;

    -- Directly update points
    INSERT INTO skater_points (
        user_id,
        points,
        month,
        year,
        current_streak,
        last_trick_date
    )
    VALUES (
        submission_record.user_id,
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

    -- Update submission
    UPDATE tournament_submissions
    SET points_awarded = true
    WHERE id = submission_id;

    -- Get final points record for logging
    SELECT * INTO current_points_record
    FROM skater_points
    WHERE user_id = submission_record.user_id
    AND month = EXTRACT(MONTH FROM CURRENT_DATE)
    AND year = EXTRACT(YEAR FROM CURRENT_DATE);

    RAISE NOTICE 'Successfully awarded points. New stats: Points: %, Streak: %, Last Trick Date: %',
        current_points_record.points,
        current_points_record.current_streak,
        current_points_record.last_trick_date;
END;
$$ LANGUAGE plpgsql;

-- Function to check trigger status
CREATE OR REPLACE FUNCTION check_trigger_status()
RETURNS TABLE (
    trigger_name text,
    trigger_table text,
    trigger_enabled boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tgname::text,
        tgrelid::regclass::text,
        tgenabled = 'O'
    FROM pg_trigger
    WHERE tgname LIKE '%award_points%';
END;
$$ LANGUAGE plpgsql;

-- Test the points calculation
CREATE OR REPLACE FUNCTION test_points_calculation(tournament_id uuid)
RETURNS int AS $$
DECLARE
    base_points int;
    multiplier int;
BEGIN
    SELECT 
        COALESCE(tr.points, t.points),
        tt.points_multiplier
    INTO base_points, multiplier
    FROM tournaments t
    LEFT JOIN tricks tr ON t.trick_id = tr.id
    JOIN tournament_types tt ON t.tournament_type_id = tt.id
    WHERE t.id = tournament_id;

    IF base_points IS NULL OR multiplier IS NULL THEN
        RAISE EXCEPTION 'Tournament not found or missing points/multiplier: %', tournament_id;
    END IF;

    RETURN base_points * multiplier;
END;
$$ LANGUAGE plpgsql; 