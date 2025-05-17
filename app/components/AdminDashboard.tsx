'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { isAdmin } from '../../lib/adminUtils'
import UserManagement from './UserManagement'
import PendingSpots from './PendingSpots'

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [pendingSpotCount, setPendingSpotCount] = useState(0)

  const updatePendingSpotCount = async () => {
    const { count } = await supabase
      .from('spots')
      .select('*', { count: 'exact', head: true })
      .eq('is_approved', false)

    setPendingSpotCount(count || 0)
  }

  useEffect(() => {
    const checkAdminAndLoadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) {
          throw new Error('No session found')
        }

        setCurrentUserId(session.user.id)
        const adminStatus = await isAdmin(session.user.id)
        setIsAdminUser(adminStatus)

        if (!adminStatus) {
          throw new Error('Unauthorized: Admin access required')
        }

        await updatePendingSpotCount()
      } catch (err) {
        console.error('Error in admin dashboard:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    checkAdminAndLoadData()

    // Set up real-time subscription for pending spots count
    const channel = supabase
      .channel('pending-spots-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spots',
        },
        updatePendingSpotCount
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-500">{error}</div>
  if (!isAdminUser) return <div>Unauthorized: Admin access required</div>
  if (!currentUserId) return <div>No user session found</div>

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-2xl font-semibold">Pending Spots</h2>
          <span className="bg-red-500 text-white px-2 py-1 rounded-full text-sm">
            {pendingSpotCount}
          </span>
        </div>
        <PendingSpots onSpotApproved={updatePendingSpotCount} />
      </div>

      <hr className="my-8 border-t-4 border-gray-300" />
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">User Management</h2>
        <UserManagement currentUserId={currentUserId} />
      </div>
    </div>
  )
} 