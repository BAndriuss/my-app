'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import Navbar from '../../components/Navbar'

export default function PurchasesPage() {
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    const fetchPurchases = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) return

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('buyer_id', userId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setItems(data)
      }
    }

    fetchPurchases()
  }, [])

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto mt-10 px-4">
        <h1 className="text-2xl font-bold mb-6">🧾 My Purchases</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {items.length === 0 && (
            <p className="text-gray-500 col-span-full text-center">You haven't bought anything yet.</p>
          )}
          {items.map(item => (
            <div key={item.id} className="border rounded p-4 shadow">
              <img src={item.image_url} alt={item.title} className="h-40 w-full object-cover rounded mb-2" />
              <h2 className="font-semibold">{item.title}</h2>
              <p className="text-sm text-gray-600">{item.description}</p>
              <p className="text-green-600 font-bold">${item.price}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
