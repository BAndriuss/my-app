'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface Profile {
  id: string
  username: string | null
  email: string | null
  balance: number
  is_admin: boolean
}

interface EditProfileFormProps {
  userId: string
  isAdmin: boolean
  onProfileUpdated?: () => void
}

export default function EditProfileForm({ userId, isAdmin, onProfileUpdated }: EditProfileFormProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editableUserId, setEditableUserId] = useState<string>(userId)
  const [users, setUsers] = useState<Profile[]>([])

  useEffect(() => {
    if (isAdmin) {
      // Fetch all users for admin
      const fetchUsers = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('username')

        if (error) {
          console.error('Error fetching users:', error)
          return
        }

        if (data) {
          setUsers(data)
        }
      }
      fetchUsers()
    }
  }, [isAdmin])

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', editableUserId)
        .single()

      if (error) {
        setError('Error fetching profile')
        setLoading(false)
        return
      }

      setProfile(data)
      setLoading(false)
    }

    fetchProfile()
  }, [editableUserId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (!profile) return

    try {
      // Check if username is taken by another user
      if (profile.username) {
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', profile.username)
          .neq('id', editableUserId)
          .single()

        if (existingUser) {
          throw new Error('Username is already taken')
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: profile.username,
          email: profile.email
        })
        .eq('id', editableUserId)

      if (updateError) throw updateError

      setSuccess('Profile updated successfully')
      onProfileUpdated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>
  if (!profile) return <div>Profile not found</div>

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
      {isAdmin && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select User to Edit
          </label>
          <select
            className="w-full p-2 border rounded"
            value={editableUserId}
            onChange={(e) => setEditableUserId(e.target.value)}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username || user.email || 'Unnamed User'}
              </option>
            ))}
          </select>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <input
            type="text"
            value={profile.username || ''}
            onChange={(e) => setProfile({ ...profile, username: e.target.value })}
            className="w-full p-2 border rounded"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            type="email"
            value={profile.email || ''}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            className="w-full p-2 border rounded"
          />
        </div>

        {error && (
          <div className="mb-4 text-red-500">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 text-green-500">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
} 