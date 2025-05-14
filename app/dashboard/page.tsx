'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import Navbar from '../components/Navbar'


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

  if (loading) return <p className="text-center mt-10">Loading...</p>

  return (
    <>
      <Navbar />
      <div className="max-w-2xl mx-auto mt-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Welcome to your Dashboard 🎉</h1>
        <p className="text-lg mb-6">Logged in as: <strong>{userEmail}</strong></p>
        <button
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          onClick={async () => {
            await supabase.auth.signOut()
            router.push('/login')
          }}
        >
          Logout
        </button>
      </div>
    </>
  )
}
