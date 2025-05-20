'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import Navbar from '../components/Navbar'
import RecentActivities from '../components/RecentActivities'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
      } else {
        setUserEmail(session.user.email ?? null)
        setLoading(false)
      }
    }

    getSession()
  }, [router])

  if (loading) return <p className="description-text text-center mt-10">Loading...</p>

  return (
    <div className="min-h-screen bg-pattern-1">
      <Navbar />
      <main className="main-content">
        <div className="max-w-4xl mx-auto px-8">
          <div className="content-overlay p-8">
            <div className="mb-8">
              <h1 className="heading-1 mb-4">WELCOME TO SKATEBOARDING COMMUNITY PLATFORM</h1>
              <p className="description-text mb-6">Logged in as: <span className="font-cornerstone">{userEmail}</span></p>
            </div>
            
            <RecentActivities />
          </div>
        </div>
      </main>
    </div>
  )
}
