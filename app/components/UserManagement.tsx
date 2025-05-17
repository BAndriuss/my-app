'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface User {
  id: string
  email: string
  username: string | null
  is_admin: boolean
  balance: number
}

interface UserManagementProps {
  currentUserId: string
}

export default function UserManagement({ currentUserId }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editedUser, setEditedUser] = useState<User | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const usersPerPage = 5
  const debounceTimeout = 300

  useEffect(() => {
    const searchUsers = async () => {
      setLoading(true)
      setError(null)

      try {
        let query = supabase
          .from('profiles')
          .select('*')
          
        if (searchQuery) {
          query = query.ilike('username', `%${searchQuery}%`)
        }

        const { data, error } = await query
          .order('username')
          .range((currentPage - 1) * usersPerPage, currentPage * usersPerPage - 1)

        if (error) throw error

        setUsers(data || [])
      } catch (err) {
        console.error('Error fetching users:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(searchUsers, debounceTimeout)
    return () => clearTimeout(timeoutId)
  }, [searchQuery, currentPage])

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editedUser) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Check if username is taken by another user
      if (editedUser.username) {
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', editedUser.username)
          .neq('id', editedUser.id)
          .single()

        if (existingUser) {
          throw new Error('Username is already taken')
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: editedUser.username,
          email: editedUser.email,
          balance: editedUser.balance,
          is_admin: editedUser.is_admin
        })
        .eq('id', editedUser.id)

      if (updateError) throw updateError

      setSuccess('User updated successfully')
      setEditMode(false)
      
      // Update users list
      setUsers(users.map(user => 
        user.id === editedUser.id ? editedUser : user
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search users by username..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setCurrentPage(1) // Reset to first page on new search
          }}
          className="w-full p-2 border rounded"
        />
      </div>

      {error && (
        <div className="mb-4 text-red-500">{error}</div>
      )}

      {success && (
        <div className="mb-4 text-green-500">{success}</div>
      )}

      <div className="grid gap-4">
        {users.map(user => (
          <div 
            key={user.id}
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => {
              setSelectedUser(user)
              setEditedUser(user)
              setEditMode(true)
            }}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{user.username || 'No username'}</h3>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
              <span className={user.is_admin ? 'text-green-600' : 'text-gray-600'}>
                {user.is_admin ? 'Admin' : 'User'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span>Page {currentPage}</span>
        <button
          onClick={() => setCurrentPage(p => p + 1)}
          disabled={users.length < usersPerPage}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Edit Modal */}
      {editMode && editedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit User</h2>
            <form onSubmit={handleUpdateUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={editedUser.username || ''}
                  onChange={(e) => setEditedUser({ ...editedUser, username: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={editedUser.email || ''}
                  onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Balance
                </label>
                <input
                  type="number"
                  value={editedUser.balance}
                  onChange={(e) => setEditedUser({ ...editedUser, balance: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 border rounded"
                  step="0.01"
                  min="0"
                />
              </div>

              {editedUser.id !== currentUserId && (
                <div className="mb-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editedUser.is_admin}
                      onChange={(e) => setEditedUser({ ...editedUser, is_admin: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Admin Status</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false)
                    setEditedUser(null)
                  }}
                  className="px-4 py-2 bg-gray-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
} 