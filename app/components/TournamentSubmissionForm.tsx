'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface TournamentSubmissionFormProps {
  tournamentId: string;
  onClose: () => void;
  onSubmissionComplete: () => void;
}

interface TournamentType {
  frequency: string;
}

interface Tournament {
  tournament_types: TournamentType;
}

export default function TournamentSubmissionForm({
  tournamentId,
  onClose,
  onSubmissionComplete
}: TournamentSubmissionFormProps) {
  const [caption, setCaption] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasExistingSubmission, setHasExistingSubmission] = useState(false);

  useEffect(() => {
    const checkExistingSubmission = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if this is a trick of the day tournament
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('tournament_types!inner(frequency)')
          .eq('id', tournamentId)
          .single() as { data: Tournament | null };

        if (tournament?.tournament_types?.frequency === 'daily') {
          // Check for existing approved submission
          const { data: submissions } = await supabase
            .from('tournament_submissions')
            .select('id, status')
            .eq('tournament_id', tournamentId)
            .eq('user_id', user.id)
            .eq('status', 'approved');

          setHasExistingSubmission(Boolean(submissions?.length));
        }
      } catch (err) {
        console.error('Error checking existing submission:', err);
      }
    };

    checkExistingSubmission();
  }, [tournamentId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid video (MP4, MOV) or image (JPEG, PNG) file.');
      return;
    }

    // Check file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
      setError('File size must be less than 100MB.');
      return;
    }

    setMediaFile(file);
    setError(null);
  };

  const getMediaType = (mimeType: string): 'video' | 'image' => {
    return mimeType.startsWith('video/') ? 'video' : 'image';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to submit an entry.');
      }

      if (!mediaFile) {
        throw new Error('Please select a media file to upload.');
      }

      // Check for existing submission for trick of the day
      if (hasExistingSubmission) {
        throw new Error('You already have an approved submission for this trick of the day. You cannot submit another one.');
      }

      // Generate a unique filename with user ID as the first folder
      const fileExt = mediaFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload media file to tournament-media bucket
      const { error: uploadError } = await supabase.storage
        .from('tournament-media')
        .upload(fileName, mediaFile);

      if (uploadError) throw uploadError;

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('tournament-media')
        .getPublicUrl(fileName);

      // Create submission record in the database
      const { error: submissionError } = await supabase
        .from('tournament_submissions')
        .insert([
          {
            tournament_id: tournamentId,
            user_id: user.id,
            media_url: publicUrl,
            media_type: getMediaType(mediaFile.type),
            caption: caption,
            status: 'pending'
          }
        ]);

      if (submissionError) throw submissionError;

      onSubmissionComplete();
      onClose();

    } catch (err) {
      console.error('Error submitting entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit entry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="heading-2">SUBMIT ENTRY</h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              disabled={isLoading}
            >
              ✕
            </button>
          </div>

          {hasExistingSubmission ? (
            <div className="text-center py-8">
              <p className="description-text text-red-600 mb-4">
                You already have an approved submission for this trick of the day.
                You cannot submit another one.
              </p>
              <button
                onClick={onClose}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Media Upload */}
              <div>
                <label className="block font-cornerstone text-gray-700 mb-2">
                  MEDIA*
                </label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="video/mp4,video/quicktime,image/jpeg,image/png"
                    className="hidden"
                  />
                  {mediaFile ? (
                    <div className="space-y-2">
                      <p className="description-text text-green-600">
                        ✓ {mediaFile.name}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMediaFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="description-text mb-2">
                        Drop your video or image here, or click to browse
                      </p>
                      <p className="description-text text-sm text-gray-500">
                        Supported formats: MP4, MOV, JPEG, PNG (max 100MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="caption" className="block font-cornerstone text-gray-700 mb-2">
                  CAPTION
                </label>
                <textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full p-3 border rounded font-bebas text-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Tell us about your submission..."
                />
              </div>

              {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded description-text">
                  {error}
                </div>
              )}

              {isLoading && (
                <div className="text-center description-text">
                  Uploading your submission...
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !mediaFile}
                  className="btn-primary flex-1"
                >
                  {isLoading ? 'Submitting...' : 'Submit Entry'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
} 