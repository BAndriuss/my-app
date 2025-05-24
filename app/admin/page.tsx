'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Navbar from '../components/Navbar'
import AdminDashboard from '../components/AdminDashboard'
import PendingSpots from '../components/PendingSpots'
import TrickSubmissionApproval from '../components/TrickSubmissionApproval'

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState<'spots' | 'tricks'>('spots')
  const [pendingCounts, setPendingCounts] = useState({
    spots: 0,
    tricks: 0
  })

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('Not authenticated')
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single()

        if (!profile?.is_admin) {
          throw new Error('Not authorized')
        }

        setIsAdmin(true)
        setLoading(false)
      } catch (err) {
        console.error('Error checking admin access:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [])

  const fetchPendingCounts = async () => {
    try {
      // Get pending spots count
      const { count: spotsCount } = await supabase
        .from('spots')
        .select('*', { count: 'exact', head: true })
        .eq('is_approved', false)

      // Get pending tricks count
      const { count: tricksCount } = await supabase
        .from('tournament_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      setPendingCounts({
        spots: spotsCount || 0,
        tricks: tricksCount || 0
      })
    } catch (err) {
      console.error('Error fetching pending counts:', err)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchPendingCounts()
    }
  }, [isAdmin])

  if (loading) {
    return (
      <div className="min-h-screen bg-pattern-1">
        <Navbar />
        <main className="main-content">
          <div className="flex justify-center items-center h-full">
            <div className="text-xl">Loading...</div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !isAdmin) {
    return (
      <div className="min-h-screen bg-pattern-1">
        <Navbar />
        <main className="main-content">
          <div className="flex justify-center items-center h-[calc(100vh-80px)]">
            <div className="text-center">
              <h1 className="heading-1 mb-4">Access Denied</h1>
              <p className="description-text">You do not have permission to access this page.</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pattern-1">
      <Navbar />
      <main className="main-content">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="content-overlay p-8">
            <h1 className="heading-1 mb-8">ADMIN DASHBOARD</h1>

            {/* Submissions Section */}
            <div className="mb-8">
              <h2 className="heading-2 mb-6">SUBMISSIONS</h2>
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div 
                  className={`p-6 rounded-lg cursor-pointer transition-colors ${
                    activeTab === 'spots' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveTab('spots')}
                >
                  <h3 className="font-cornerstone text-lg mb-2">SPOTS SUBMISSIONS</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{pendingCounts.spots}</span>
                    <span className="text-sm opacity-80">pending approval</span>
                  </div>
                </div>

                <div 
                  className={`p-6 rounded-lg cursor-pointer transition-colors ${
                    activeTab === 'tricks' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveTab('tricks')}
                >
                  <h3 className="font-cornerstone text-lg mb-2">TRICK SUBMISSIONS</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{pendingCounts.tricks}</span>
                    <span className="text-sm opacity-80">pending approval</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6">
                {activeTab === 'spots' ? (
                  <PendingSpots onSpotApproved={fetchPendingCounts} />
                ) : (
                  <TrickSubmissionApproval onSubmissionUpdate={fetchPendingCounts} />
                )}
              </div>
            </div>

            {/* User Management Section */}
            <div>
              <h2 className="heading-2 mb-6">USER MANAGEMENT</h2>
              <div className="bg-white rounded-lg p-6">
                <AdminDashboard />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 