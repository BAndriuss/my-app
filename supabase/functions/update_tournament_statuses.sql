CREATE OR REPLACE FUNCTION update_tournament_statuses()
RETURNS void AS $$
BEGIN
    -- Update to 'active' if start_date has passed and end_date hasn't
    UPDATE tournaments
    SET status = 'active'
    WHERE start_date <= CURRENT_TIMESTAMP
    AND end_date > CURRENT_TIMESTAMP
    AND status = 'upcoming';

    -- Update to 'ended' if end_date has passed
    UPDATE tournaments
    SET status = 'ended'
    WHERE end_date <= CURRENT_TIMESTAMP
    AND status = 'active';

    -- For ended tournaments, update winner if not already set
    UPDATE tournaments t
    SET winner_id = s.user_id
    FROM (
        SELECT 
            tournament_id,
            user_id,
            ROW_NUMBER() OVER (PARTITION BY tournament_id ORDER BY likes_count DESC) as rank
        FROM tournament_submissions
    ) s
    WHERE t.id = s.tournament_id
    AND s.rank = 1
    AND t.status = 'ended'
    AND t.winner_id IS NULL;

    -- Update skater points for newly ended tournaments
    INSERT INTO skater_points (user_id, points, month, year)
    SELECT 
        t.winner_id,
        get_tournament_points(t.id),
        EXTRACT(MONTH FROM t.end_date),
        EXTRACT(YEAR FROM t.end_date)
    FROM tournaments t
    WHERE t.status = 'ended'
    AND t.winner_id IS NOT NULL
    AND t.points_awarded = false
    ON CONFLICT (user_id, month, year)
    DO UPDATE SET points = skater_points.points + EXCLUDED.points;

    -- Mark points as awarded
    UPDATE tournaments
    SET points_awarded = true
    WHERE status = 'ended'
    AND winner_id IS NOT NULL
    AND points_awarded = false;
END;
$$ LANGUAGE plpgsql; 