-- Create submission_likes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.submission_likes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    submission_id uuid REFERENCES public.tournament_submissions(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, submission_id)
);

-- Drop existing policies first
DROP POLICY IF EXISTS "View all submission likes" ON public.submission_likes;
DROP POLICY IF EXISTS "Users can like submissions" ON public.submission_likes;
DROP POLICY IF EXISTS "Users can unlike submissions" ON public.submission_likes;

-- Drop triggers first, then function
DROP TRIGGER IF EXISTS update_submission_likes_count_insert ON public.submission_likes;
DROP TRIGGER IF EXISTS update_submission_likes_count_delete ON public.submission_likes;
DROP FUNCTION IF EXISTS public.update_submission_likes_count() CASCADE;

-- Create or update function to update likes count with better handling
CREATE OR REPLACE FUNCTION public.update_submission_likes_count()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
BEGIN
    -- Get the current count first
    SELECT likes_count INTO current_count
    FROM public.tournament_submissions
    WHERE id = CASE 
        WHEN TG_OP = 'INSERT' THEN NEW.submission_id
        WHEN TG_OP = 'DELETE' THEN OLD.submission_id
    END;

    -- Set to 0 if null
    current_count := COALESCE(current_count, 0);

    IF TG_OP = 'INSERT' THEN
        UPDATE public.tournament_submissions
        SET likes_count = current_count + 1
        WHERE id = NEW.submission_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.tournament_submissions
        SET likes_count = GREATEST(0, current_count - 1)
        WHERE id = OLD.submission_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new triggers with explicit names and conditions
CREATE TRIGGER update_submission_likes_count_insert
    AFTER INSERT ON public.submission_likes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_submission_likes_count();

CREATE TRIGGER update_submission_likes_count_delete
    AFTER DELETE ON public.submission_likes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_submission_likes_count();

-- Enable Row Level Security (if not already enabled)
ALTER TABLE public.submission_likes ENABLE ROW LEVEL SECURITY;

-- Recreate policies
CREATE POLICY "View all submission likes" ON public.submission_likes
    FOR SELECT
    USING (true);

CREATE POLICY "Users can like submissions" ON public.submission_likes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Check if the tournament is not a daily tournament
        EXISTS (
            SELECT 1 
            FROM public.tournament_submissions ts
            JOIN public.tournaments t ON t.id = ts.tournament_id
            JOIN public.tournament_types tt ON tt.id = t.tournament_type_id
            WHERE ts.id = submission_id 
            AND tt.frequency != 'daily'
        )
        -- Prevent users from liking their own submissions
        AND NOT EXISTS (
            SELECT 1 
            FROM public.tournament_submissions ts
            WHERE ts.id = submission_id 
            AND ts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can unlike submissions" ON public.submission_likes
    FOR DELETE
    USING (user_id = auth.uid());

-- Add an index to improve performance
CREATE INDEX IF NOT EXISTS idx_submission_likes_submission_id ON public.submission_likes(submission_id);

-- Reset all likes counts to ensure accuracy
UPDATE public.tournament_submissions ts
SET likes_count = (
    SELECT COUNT(*)
    FROM public.submission_likes sl
    WHERE sl.submission_id = ts.id
); 