CREATE OR REPLACE FUNCTION update_expired_tournaments()
RETURNS void AS $$
BEGIN
    -- Update daily tournament if expired
    WITH expired_daily AS (
        SELECT id 
        FROM tournaments t
        WHERE t.tournament_types.frequency = 'daily'
        AND t.end_date <= CURRENT_TIMESTAMP
    )
    INSERT INTO tournaments (
        tournament_type_id,
        trick_id,
        title,
        tournament_type,
        frequency,
        start_date,
        end_date,
        status,
        is_automated,
        admin_id
    )
    SELECT 
        tt.id as tournament_type_id,
        t.id as trick_id,
        CONCAT('Daily Challenge: ', t.name, ' (', t.category, ')') as title,
        'daily' as tournament_type,
        tt.frequency,
        CURRENT_DATE as start_date,
        CURRENT_DATE + INTERVAL '1 day' as end_date,
        'active' as status,
        true as is_automated,
        (SELECT id FROM profiles WHERE is_admin = true LIMIT 1) as admin_id
    FROM tournament_types tt
    CROSS JOIN tricks t
    WHERE tt.frequency = 'daily'
    AND EXISTS (SELECT 1 FROM expired_daily)
    ORDER BY RANDOM()
    LIMIT 1;

    -- Update weekly tournaments if expired
    WITH expired_weekly AS (
        SELECT id 
        FROM tournaments t
        WHERE t.tournament_types.frequency = 'weekly'
        AND t.end_date <= CURRENT_TIMESTAMP
    )
    INSERT INTO tournaments (
        tournament_type_id,
        title,
        tournament_type,
        frequency,
        start_date,
        end_date,
        status,
        is_automated,
        admin_id
    )
    SELECT 
        tt.id as tournament_type_id,
        tt.name as title,
        'weekly' as tournament_type,
        tt.frequency,
        date_trunc('week', CURRENT_DATE) + INTERVAL '1 day' as start_date,
        date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' + INTERVAL '23 hours 59 minutes 59 seconds' as end_date,
        'active' as status,
        true as is_automated,
        (SELECT id FROM profiles WHERE is_admin = true LIMIT 1) as admin_id
    FROM tournament_types tt
    WHERE tt.frequency = 'weekly'
    AND EXISTS (SELECT 1 FROM expired_weekly);

    -- Update monthly tournament if expired
    WITH expired_monthly AS (
        SELECT id 
        FROM tournaments t
        WHERE t.tournament_types.frequency = 'monthly'
        AND t.end_date <= CURRENT_TIMESTAMP
    )
    INSERT INTO tournaments (
        tournament_type_id,
        title,
        tournament_type,
        frequency,
        start_date,
        end_date,
        status,
        is_automated,
        admin_id
    )
    SELECT 
        tt.id as tournament_type_id,
        tt.name as title,
        'monthly' as tournament_type,
        tt.frequency,
        date_trunc('month', CURRENT_DATE) as start_date,
        (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 second') as end_date,
        'active' as status,
        true as is_automated,
        (SELECT id FROM profiles WHERE is_admin = true LIMIT 1) as admin_id
    FROM tournament_types tt
    WHERE tt.frequency = 'monthly'
    AND EXISTS (SELECT 1 FROM expired_monthly);

    -- Update tournament statuses
    PERFORM update_tournament_statuses();
END;
$$ LANGUAGE plpgsql; 