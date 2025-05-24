'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { isAdmin } from '../../lib/adminUtils'
import UserManagement from './UserManagement'

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdminUser, setIsAdminUser] = useState(false)

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
      } catch (err) {
        console.error('Error in admin dashboard:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    checkAdminAndLoadData()
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-500">{error}</div>
  if (!isAdminUser) return <div>Unauthorized: Admin access required</div>
  if (!currentUserId) return <div>No user session found</div>

  return (
    <div>
      <UserManagement currentUserId={currentUserId} />
    </div>
  )
} 