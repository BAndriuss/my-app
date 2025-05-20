'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

export default function SetupUsername() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Check if user already has a username
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single()

      if (profile?.username) {
        // User already has a username, redirect to dashboard
        router.push('/dashboard')
        return
      }

      setUserId(session.user.id)
      setLoading(false)
    }

    checkSession()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username.trim()) {
      setError('Username is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Check if username is already taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .single()

      if (existingUser) {
        setError('Username is already taken')
        setLoading(false)
        return
      }

      // Update the profile with the new username
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username: username.trim() })
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }

      // Redirect to dashboard after successful username setup
      router.push('/dashboard')
    } catch (err) {
      console.error('Error setting username:', err)
      setError('Failed to set username. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-pattern-1 flex items-center justify-center">
        <div className="content-overlay p-8 max-w-md w-full">
          <p className="text-center description-text">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pattern-1 flex items-center justify-center">
      <div className="content-overlay p-8 max-w-md w-full">
        <h1 className="heading-1 mb-6 text-center">CHOOSE YOUR USERNAME</h1>
        <p className="description-text mb-8 text-center">
          Pick a unique username for your account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full p-3 border rounded font-bebas text-lg"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-red-500 description-text text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? 'Setting up...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
} 