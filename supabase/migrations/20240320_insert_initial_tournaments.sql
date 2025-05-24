-- Insert daily tournament
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
ORDER BY RANDOM()
LIMIT 1;

-- Insert weekly tournaments (one for each category)
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
    date_trunc('week', CURRENT_DATE) as start_date,
    date_trunc('week', CURRENT_DATE) + INTERVAL '6 days' as end_date,
    'active' as status,
    true as is_automated,
    (SELECT id FROM profiles WHERE is_admin = true LIMIT 1) as admin_id
FROM tournament_types tt
WHERE tt.frequency = 'weekly';

-- Insert monthly tournament
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
    (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day') as end_date,
    'active' as status,
    true as is_automated,
    (SELECT id FROM profiles WHERE is_admin = true LIMIT 1) as admin_id
FROM tournament_types tt
WHERE tt.frequency = 'monthly'; 