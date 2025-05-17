'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Navbar from '../components/Navbar'
import Link from 'next/link'

interface Profile {
  username: string | null
  balance: number
}

export default function AccountPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [amount, setAmount] = useState<number>(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let channel = supabase.channel('profile-changes')

    const fetchProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('balance, username')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      if (data) {
        console.log('Fetched profile data:', data)
        setBalance(data.balance)
        setUsername(data.username)
      }
    }

    const setupSubscription = async (userId: string) => {
      channel = supabase
        .channel('profile-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            console.log('Received realtime update:', payload)
            const newData = payload.new as Profile
            if (newData) {
              setBalance(newData.balance)
              setUsername(newData.username)
            }
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status)
        })
    }

    const initializeAccount = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user

      if (user) {
        console.log('User session found:', user.id)
        setUserId(user.id)
        await fetchProfile(user.id)
        await setupSubscription(user.id)
      }
    }

    initializeAccount()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  const addFunds = async () => {
    if (!userId || amount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ balance: (balance || 0) + amount })
        .eq('id', userId)
        .select('balance')
        .single()

      if (error) throw error

      if (data) {
        setBalance(data.balance)
        setAmount(0)
        setSuccess(`Successfully added $${amount.toFixed(2)} to your balance`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while adding funds')
    } finally {
      setLoading(false)
    }
  }

  const presetAmounts = [10, 20, 50, 100]

  return (
    <div className="min-h-screen bg-pattern-1">
      <Navbar />

      <div className="max-w-lg mx-auto mt-20 content-overlay p-8">
        <h1 className="heading-1 mb-4">👤 MY ACCOUNT</h1>
        {username && (
          <p className="description-text mb-4">
            Username: <span className="font-cornerstone">{username}</span>
          </p>
        )}
        <p className="description-text mb-6">
          Wallet balance: <span className="font-cornerstone">${balance?.toFixed(2) ?? '...'}</span>
        </p>

        <div className="mb-4">
          <div className="flex gap-4 justify-center mb-4">
            {presetAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt)}
                className={`btn-primary ${
                  amount === amt
                    ? 'bg-blue-500'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full p-2 border rounded font-bebas text-base"
              placeholder="Enter custom amount"
              min="0"
              step="0.01"
            />
            <button
              onClick={addFunds}
              disabled={loading}
              className="btn-primary bg-green-500 hover:bg-green-600 disabled:bg-gray-400"
            >
              {loading ? 'Adding...' : 'Add Funds'}
            </button>
          </div>
        </div>

        {error && (
          <div className="description-text text-red-500 mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="description-text text-green-500 mb-4">
            {success}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Link href="/myaccount/purchases">
            <button className="btn-primary bg-black hover:bg-gray-800 w-full">
              🧾 MY PURCHASES
            </button>
          </Link>
          <Link href="/myaccount/sold">
            <button className="btn-primary bg-black hover:bg-gray-800 w-full">
              💼 MY SOLD ITEMS
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
