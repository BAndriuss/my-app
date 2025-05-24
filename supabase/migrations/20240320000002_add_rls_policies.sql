-- Enable RLS on tables
ALTER TABLE public.tournament_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_likes ENABLE ROW LEVEL SECURITY;

-- Policy for viewing tournament submissions (anyone can view)
CREATE POLICY "Anyone can view tournament submissions"
ON public.tournament_submissions
FOR SELECT
USING (true);

-- Policy for creating tournament submissions (authenticated users only)
CREATE POLICY "Authenticated users can create tournament submissions"
ON public.tournament_submissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy for updating own tournament submissions
CREATE POLICY "Users can update own tournament submissions"
ON public.tournament_submissions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for deleting own tournament submissions
CREATE POLICY "Users can delete own tournament submissions"
ON public.tournament_submissions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy for viewing submission likes (anyone can view)
CREATE POLICY "Anyone can view submission likes"
ON public.submission_likes
FOR SELECT
USING (true);

-- Policy for creating submission likes (authenticated users only)
CREATE POLICY "Authenticated users can create submission likes"
ON public.submission_likes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy for deleting own submission likes
CREATE POLICY "Users can delete own submission likes"
ON public.submission_likes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id); 