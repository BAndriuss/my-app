'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Database } from '../../types/supabase'

type Item = Database['public']['Tables']['items']['Row']

interface BuyButtonProps {
  item: Item;
  onPurchaseComplete?: () => void;
}

export default function BuyButton({ item, onPurchaseComplete }: BuyButtonProps) {
  const [userId, setUserId] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [status, setStatus] = useState<string>('')
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user

      if (user) {
        setUserId(user.id)
        setIsOwner(user.id === item.user_id)
        const { data, error } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', user.id)
          .single()
        
        if (error) {
          console.error('Error fetching balance:', error)
          return
        }
        setBalance(data?.balance ?? null)
      }
    }
    getUser()
  }, [item.user_id])

  const handleBuy = async () => {
    if (!userId) {
      setStatus('❌ Please log in to make a purchase')
      return
    }

    if (isOwner) {
      setStatus('❌ You cannot buy your own item!')
      return
    }

    if (balance === null) {
      setStatus('❌ Could not verify balance')
      return
    }

    if (balance < item.price) {
      setStatus('❌ Not enough funds')
      return
    }

    setLoading(true)
    setStatus('Processing...')

    try {
      const { data: transactionResult, error: transactionError } = await supabase
        .rpc('purchase_item', {
          p_item_id: item.id,
          p_buyer_id: userId,
          p_amount: item.price
        })

      if (transactionError) {
        console.error('Transaction error:', transactionError)
        setStatus(`❌ ${transactionError.message || 'Purchase failed'}`)
        return
      }

      if (transactionResult) {
        setStatus('✅ Purchased!')
        setBalance(balance - item.price)
        onPurchaseComplete?.()
      } else {
        setStatus('❌ Purchase failed')
      }
    } catch (error) {
      console.error('Error during purchase:', error)
      setStatus(`❌ ${error instanceof Error ? error.message : 'Purchase failed'}`)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div>
      <button 
        onClick={handleBuy} 
        disabled={loading || !userId || isOwner}
        className="bg-black hover:bg-gray-800 text-white px-4 py-1 rounded w-full disabled:bg-gray-400"
      >
        {loading ? 'Processing...' : `Buy for $${item.price}`}
      </button>
      {status && <p className="text-sm mt-2 text-center text-blue-600">{status}</p>}
    </div>
  )
}