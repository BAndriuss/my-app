'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Image from 'next/image';
import ApproveButton from './ApproveButton';
import DeleteButton from './DeleteButton';

interface TrickSubmission {
  id: string;
  media_url: string;
  media_type: string;
  caption: string;
  created_at: string;
  status: string;
  tournament: {
    title: string;
    points: number;
    tournament_types: {
      points_multiplier: number;
    };
  };
  profiles: {
    username: string;
  };
}

interface MediaModalProps {
  mediaUrl: string;
  mediaType: string;
  onClose: () => void;
}

interface FeedbackModalProps {
  onClose: () => void;
  onSubmit: (feedback: string) => void;
  username: string;
}

interface TrickSubmissionApprovalProps {
  onSubmissionUpdate: () => void;
}

function MediaModal({ mediaUrl, mediaType, onClose }: MediaModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}>
      <div className="max-w-4xl w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <button 
            onClick={onClose}
            className="absolute -top-10 right-0 text-white hover:text-gray-300"
          >
            Close
          </button>
          {mediaType === 'video' ? (
            <video
              src={mediaUrl}
              controls
              className="w-full rounded-lg"
              autoPlay
            />
          ) : (
            <img
              src={mediaUrl}
              alt="Submission"
              className="w-full rounded-lg"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbackModal({ onClose, onSubmit, username }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(feedback);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
        <h3 className="text-xl font-semibold mb-4">Provide Feedback for {username}</h3>
        <form onSubmit={handleSubmit}>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full h-32 p-2 border rounded-lg mb-4 resize-none"
            placeholder="Explain why the trick submission was rejected..."
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Submit Feedback
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TrickSubmissionApproval({ onSubmissionUpdate }: TrickSubmissionApprovalProps) {
  const [submissions, setSubmissions] = useState<TrickSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFeedbackModal, setShowFeedbackModal] = useState<{ id: string; username: string } | null>(null);
  const submissionsPerPage = 5;

  useEffect(() => {
    fetchSubmissions();

    // Set up real-time subscription for submissions
    const channel = supabase
      .channel('trick-submissions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_submissions'
        },
        () => {
          fetchSubmissions();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('tournament_submissions')
        .select(`
          *,
          tournament:tournaments(
            title,
            points,
            tournament_types(points_multiplier)
          ),
          profiles(username)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (submissionId: string) => {
    try {
      setError(null);
      setSuccess(null);
      console.log('Starting approval process for submission:', submissionId);

      // First, get the current submission state
      const { data: currentSubmission, error: fetchError } = await supabase
        .from('tournament_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

      if (fetchError) {
        console.error('Error fetching current submission:', fetchError);
        throw fetchError;
      }

      console.log('Current submission state:', currentSubmission);

      // Update the submission - only change status
      const { data: updatedSubmission, error } = await supabase
        .from('tournament_submissions')
        .update({ status: 'approved' })
        .eq('id', submissionId)
        .select()
        .single();

      if (error) {
        console.error('Error updating submission:', error);
        throw error;
      }

      console.log('Updated submission:', updatedSubmission);

      // Check if points were awarded by querying skater_points
      const { data: pointsData, error: pointsError } = await supabase
        .from('skater_points')
        .select('*')
        .eq('user_id', currentSubmission.user_id)
        .single();

      console.log('Current points data:', pointsData);

      if (error) throw error;
      setSuccess('Submission approved successfully');
      await fetchSubmissions();
      onSubmissionUpdate();

      // If we're on a page with no submissions after approval, go back one page
      const remainingSubmissions = submissions.length - 1;
      const maxPage = Math.ceil(remainingSubmissions / submissionsPerPage);
      if (currentPage > maxPage && currentPage > 1) {
        setCurrentPage(maxPage);
      }
    } catch (err) {
      console.error('Error approving submission:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve submission');
    }
  };

  const handleReject = async (submissionId: string, username: string) => {
    setShowFeedbackModal({ id: submissionId, username });
  };

  const submitRejection = async (feedback: string) => {
    if (!showFeedbackModal) return;

    try {
      setError(null);
      setSuccess(null);

      const { error } = await supabase
        .from('tournament_submissions')
        .update({ 
          status: 'rejected',
          admin_feedback: feedback
        })
        .eq('id', showFeedbackModal.id);

      if (error) throw error;
      setSuccess('Submission rejected successfully');
      await fetchSubmissions();
      onSubmissionUpdate();

      // If we're on a page with no submissions after rejection, go back one page
      const remainingSubmissions = submissions.length - 1;
      const maxPage = Math.ceil(remainingSubmissions / submissionsPerPage);
      if (currentPage > maxPage && currentPage > 1) {
        setCurrentPage(maxPage);
      }
    } catch (err) {
      console.error('Error rejecting submission:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject submission');
    } finally {
      setShowFeedbackModal(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading submissions...</div>;
  }

  // Calculate pagination
  const totalPages = Math.ceil(submissions.length / submissionsPerPage);
  const startIndex = (currentPage - 1) * submissionsPerPage;
  const paginatedSubmissions = submissions.slice(startIndex, startIndex + submissionsPerPage);

  if (submissions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="description-text">No pending submissions to review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-red-500 mb-4">{error}</div>
      )}

      {success && (
        <div className="text-green-500 mb-4">{success}</div>
      )}

      {selectedMedia && (
        <MediaModal 
          mediaUrl={selectedMedia.url}
          mediaType={selectedMedia.type}
          onClose={() => setSelectedMedia(null)}
        />
      )}

      <div className="flex justify-end items-center mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-1">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {paginatedSubmissions.map((submission) => (
        <div key={submission.id} className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Image
                  src="/profile.png"
                  alt={submission.profiles.username}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
                <h3 className="font-semibold text-lg">{submission.profiles.username}</h3>
              </div>
              <p className="text-gray-600">Tournament: {submission.tournament.title}</p>
              <p className="text-gray-600">
                Points: {submission.tournament.points * submission.tournament.tournament_types.points_multiplier}
              </p>
              {submission.caption && (
                <p className="text-gray-600 mt-2">{submission.caption}</p>
              )}
              <div 
                className="cursor-pointer mt-2"
                onClick={() => setSelectedMedia({ url: submission.media_url, type: submission.media_type })}
              >
                {submission.media_type === 'video' ? (
                  <div className="relative w-32 h-32 group">
                    <video
                      src={submission.media_url}
                      className="absolute inset-0 w-full h-full object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg group-hover:bg-opacity-50 transition-all duration-200">
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-32 h-32 group">
                    <img
                      src={submission.media_url}
                      alt="Submission"
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg">
                      <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all duration-200" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex space-x-4">
              <ApproveButton
                onApprove={() => handleApprove(submission.id)}
                itemName="submission"
              />
              <DeleteButton
                onDelete={() => handleReject(submission.id, submission.profiles.username)}
                itemName="submission"
              />
            </div>
          </div>
        </div>
      ))}

      {showFeedbackModal && (
        <FeedbackModal
          onClose={() => setShowFeedbackModal(null)}
          onSubmit={submitRejection}
          username={showFeedbackModal.username}
        />
      )}
    </div>
  );
} 