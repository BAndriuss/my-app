'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import DeleteButton from './DeleteButton'
import ApproveButton from './ApproveButton'

interface Spot {
  id: string
  user_id: string
  title: string
  type: string
  latitude: number
  longitude: number
  image_url: string | null
  is_approved: boolean
}

interface PendingSpotsProps {
  onSpotApproved?: () => void
}

export default function PendingSpots({ onSpotApproved }: PendingSpotsProps) {
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const spotsPerPage = 5

  const fetchPendingSpots = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('spots')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false })

      if (error) throw error

      setSpots(data || [])
    } catch (err) {
      console.error('Error fetching pending spots:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPendingSpots()

    // Set up real-time subscription for spots
    const channel = supabase
      .channel('pending-spots-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spots'
        },
        (payload) => {
          console.log('Spot change detected:', payload);
          fetchPendingSpots();
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  const approveSpot = async (spotId: string) => {
    try {
      setError(null);
      setSuccess(null);
      console.log('Attempting to approve spot:', spotId);

      const { data, error } = await supabase
        .from('spots')
        .update({ is_approved: true })
        .eq('id', spotId)
        .select();

      console.log('Approval response:', { data, error });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      // Update local state
      setSpots(prevSpots => prevSpots.filter(spot => spot.id !== spotId));
      setSuccess('Spot approved successfully');
      
      // Notify parent component
      if (onSpotApproved) {
        console.log('Calling onSpotApproved callback');
        onSpotApproved();
      }

      // If we're on a page with no spots after deletion, go back one page
      const remainingSpots = spots.length - 1;
      const maxPage = Math.ceil(remainingSpots / spotsPerPage);
      if (currentPage > maxPage && currentPage > 1) {
        setCurrentPage(maxPage);
      }
    } catch (err) {
      console.error('Error approving spot:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while approving the spot');
    }
  };

  const deleteSpot = async (spotId: string) => {
    try {
      const { error } = await supabase
        .from('spots')
        .delete()
        .eq('id', spotId)

      if (error) throw error

      // Update local state
      setSpots(prevSpots => prevSpots.filter(spot => spot.id !== spotId));
      setSuccess('Spot deleted successfully');

      // If we're on a page with no spots after deletion, go back one page
      const remainingSpots = spots.length - 1;
      const maxPage = Math.ceil(remainingSpots / spotsPerPage);
      if (currentPage > maxPage && currentPage > 1) {
        setCurrentPage(maxPage);
      }

      // Notify parent component
      if (onSpotApproved) {
        onSpotApproved();
      }
    } catch (err) {
      console.error('Error deleting spot:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  if (loading) return <div>Loading...</div>

  // Calculate pagination
  const totalPages = Math.ceil(spots.length / spotsPerPage)
  const startIndex = (currentPage - 1) * spotsPerPage
  const paginatedSpots = spots.slice(startIndex, startIndex + spotsPerPage)

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-red-500 mb-4">{error}</div>
      )}

      {success && (
        <div className="text-green-500 mb-4">{success}</div>
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

      {paginatedSpots.length === 0 ? (
        <div className="text-gray-500">No pending spots to approve</div>
      ) : (
        paginatedSpots.map(spot => (
          <div
            key={spot.id}
            className="bg-white p-4 rounded-lg shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{spot.title}</h3>
                <p className="text-gray-600">Type: {spot.type}</p>
                <p className="text-gray-600">
                  Location: {spot.latitude.toFixed(6)}, {spot.longitude.toFixed(6)}
                </p>
                {spot.image_url && (
                  <img
                    src={spot.image_url}
                    alt={spot.title}
                    className="mt-2 w-32 h-32 object-cover rounded"
                  />
                )}
              </div>
              <div className="flex space-x-4">
                <ApproveButton
                  onApprove={() => approveSpot(spot.id)}
                  itemName="spot"
                />
                <DeleteButton
                  onDelete={() => deleteSpot(spot.id)}
                  itemName="spot"
                />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
} 