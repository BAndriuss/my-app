-- Create tricks table
CREATE TABLE tricks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
    category TEXT NOT NULL CHECK (category IN ('flat', 'grind', 'manual', 'air', 'lip', 'grab')),
    points INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create tournament_types table
CREATE TABLE tournament_types (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    category TEXT NOT NULL,
    points_multiplier DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Modify tournaments table
ALTER TABLE tournaments
ADD COLUMN tournament_type_id UUID REFERENCES tournament_types(id),
ADD COLUMN trick_id UUID REFERENCES tricks(id),
ADD COLUMN points INTEGER DEFAULT 0,
ADD COLUMN is_automated BOOLEAN DEFAULT false;

-- Create events table
CREATE TABLE events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    spot_id UUID REFERENCES spots(id),
    media_url TEXT,
    admin_id UUID REFERENCES auth.users(id) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('upcoming', 'active', 'ended')) DEFAULT 'upcoming',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create skater_points table to track monthly points
CREATE TABLE skater_points (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, month, year)
);

-- Insert predefined tournament types
INSERT INTO tournament_types (name, frequency, category, points_multiplier, description) VALUES
('Trick of the Day', 'daily', 'flat', 1.0, 'Daily challenge to land a specific trick'),
('Grind of the Week', 'weekly', 'grind', 1.5, 'Weekly challenge for the best grind'),
('Park Line of the Week', 'weekly', 'park', 1.5, 'Weekly challenge for the best park line'),
('Flat Trick of the Week', 'weekly', 'flat', 1.5, 'Weekly challenge for the best flat ground trick'),
('Line of the Week', 'weekly', 'line', 1.5, 'Weekly challenge for the best street line'),
('Skater of the Month', 'monthly', 'overall', 2.0, 'Monthly award for the skater with most points');

-- Add some sample tricks
INSERT INTO tricks (name, difficulty, category, points) VALUES
('Kickflip', 2, 'flat', 20),
('Heelflip', 2, 'flat', 20),
('360 Flip', 3, 'flat', 30),
('Backside 50-50', 2, 'grind', 20),
('Frontside Boardslide', 2, 'grind', 20),
('Crooked Grind', 3, 'grind', 30),
('Manual', 1, 'manual', 10),
('Nose Manual', 2, 'manual', 20),
('360 Shove-it', 2, 'flat', 20),
('Varial Kickflip', 3, 'flat', 30),
('Pop Shove-it', 1, 'flat', 10),
('Ollie', 1, 'flat', 10),
('Frontside 180', 2, 'flat', 20),
('Backside 180', 2, 'flat', 20),
('Backside Tailslide', 3, 'grind', 30),
('Frontside Feeble', 3, 'grind', 30),
('Frontside Smith Grind', 3, 'grind', 30),
('Backside Lipslide', 3, 'grind', 30),
('Backside 5-0', 2, 'grind', 20),
('Frontside 5-0', 2, 'grind', 20);

-- Add RLS policies
ALTER TABLE tricks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE skater_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Tricks policies
CREATE POLICY "Tricks are viewable by everyone"
ON tricks FOR SELECT
TO authenticated
USING (true);

-- Tournament types policies
CREATE POLICY "Tournament types are viewable by everyone"
ON tournament_types FOR SELECT
TO authenticated
USING (true);

-- Skater points policies
CREATE POLICY "Users can view all skater points"
ON skater_points FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can only update their own points"
ON skater_points FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Events policies
CREATE POLICY "Events are viewable by everyone"
ON events FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can create events"
ON events FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
    )
);

CREATE POLICY "Only admins can update events"
ON events FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
    )
);

-- Function to get current tournament points value
CREATE OR REPLACE FUNCTION get_tournament_points(tournament_id UUID)
RETURNS INTEGER AS $$
DECLARE
    base_points INTEGER;
    multiplier DECIMAL(3,1);
BEGIN
    SELECT 
        t.points * tt.points_multiplier INTO base_points
    FROM tournaments tr
    JOIN tricks t ON tr.trick_id = t.id
    JOIN tournament_types tt ON tr.tournament_type_id = tt.id
    WHERE tr.id = tournament_id;
    
    RETURN base_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 