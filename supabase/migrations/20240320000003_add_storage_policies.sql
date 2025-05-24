-- Create tournament-media bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('tournament-media', 'tournament-media', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for viewing tournament media (public access)
CREATE POLICY "Anyone can view tournament media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tournament-media');

-- Policy for uploading tournament media (authenticated users only)
CREATE POLICY "Authenticated users can upload tournament media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'tournament-media' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for updating own tournament media
CREATE POLICY "Users can update own tournament media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'tournament-media' 
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'tournament-media' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for deleting own tournament media
CREATE POLICY "Users can delete own tournament media"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'tournament-media' 
    AND (storage.foldername(name))[1] = auth.uid()::text
); 