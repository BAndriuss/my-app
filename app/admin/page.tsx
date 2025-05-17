'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { isAdmin } from '../../lib/adminUtils'
import Navbar from '../components/Navbar'
import AdminDashboard from '../components/AdminDashboard'

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        const adminStatus = await isAdmin(session.user.id)
        if (!adminStatus) {
          router.push('/dashboard')
          return
        }

        setLoading(false)
      } catch (err) {
        console.error('Error checking admin access:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [router])

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

  if (error) {
    return (
      <div className="min-h-screen bg-pattern-1">
        <Navbar />
        <main className="main-content">
          <div className="flex justify-center items-center h-full">
            <div className="text-red-500">{error}</div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pattern-1">
      <Navbar />
      <main className="main-content">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="content-overlay">
            <AdminDashboard />
          </div>
        </div>
      </main>
    </div>
  )
} 