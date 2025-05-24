-- Add foreign key relationships for tournament submissions and likes

-- First, create the submission_likes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.submission_likes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(submission_id, user_id)
);

-- Drop existing constraints if they exist
ALTER TABLE public.tournament_submissions 
    DROP CONSTRAINT IF EXISTS fk_tournament_submissions_user;

ALTER TABLE public.submission_likes 
    DROP CONSTRAINT IF EXISTS fk_submission_likes_submission;

ALTER TABLE public.submission_likes 
    DROP CONSTRAINT IF EXISTS fk_submission_likes_user;

-- Add foreign key from tournament_submissions.user_id to profiles.id
ALTER TABLE public.tournament_submissions
ADD CONSTRAINT fk_tournament_submissions_user
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Add foreign key from submission_likes.submission_id to tournament_submissions.id
ALTER TABLE public.submission_likes
ADD CONSTRAINT fk_submission_likes_submission
FOREIGN KEY (submission_id) REFERENCES public.tournament_submissions(id)
ON DELETE CASCADE;

-- Add foreign key from submission_likes.user_id to profiles.id
ALTER TABLE public.submission_likes
ADD CONSTRAINT fk_submission_likes_user
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Add likes_count column to tournament_submissions if it doesn't exist
ALTER TABLE public.tournament_submissions
ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;

-- Create a function to update likes_count
CREATE OR REPLACE FUNCTION public.update_submission_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.tournament_submissions
        SET likes_count = COALESCE(likes_count, 0) + 1
        WHERE id = NEW.submission_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.tournament_submissions
        SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
        WHERE id = OLD.submission_id;
    END IF;
    RETURN NULL;
END;
$function$;

-- Create trigger for likes count
DROP TRIGGER IF EXISTS update_submission_likes_count ON public.submission_likes;
CREATE TRIGGER update_submission_likes_count
    AFTER INSERT OR DELETE ON public.submission_likes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_submission_likes_count(); 