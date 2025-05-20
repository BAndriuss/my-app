'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import Navbar from '../../components/Navbar'
import Image from 'next/image'
import Link from 'next/link'
import { getRelativeTime, typeDescriptions, conditionDescriptions } from '../../../lib/utils'
import { Database } from '../../../types/supabase'

type Item = Database['public']['Tables']['items']['Row']

export default function PurchasesPage() {
  const [items, setItems] = useState<Item[]>([])

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

  // Calculate summary statistics
  const totalSpent = items.reduce((sum, item) => sum + item.price, 0)
  const itemCount = items.length

  return (
    <div className="min-h-screen bg-pattern-1">
      <Navbar />
      <main className="main-content">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="content-overlay p-8">
            <h1 className="heading-1 mb-6">🧾 MY PURCHASES</h1>

            {/* Summary Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-sm">
                <h3 className="font-cornerstone text-lg mb-2">TOTAL ITEMS BOUGHT</h3>
                <p className="text-3xl font-cornerstone text-blue-600">{itemCount}</p>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-sm">
                <h3 className="font-cornerstone text-lg mb-2">TOTAL SPENT</h3>
                <p className="text-3xl font-cornerstone text-green-600">${totalSpent.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {items.length === 0 && (
                <p className="description-text col-span-full text-center">You haven't bought anything yet.</p>
              )}
              {items.map(item => (
                <Link key={item.id} href={`/market/${item.id}`}>
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200">
                    <div className="relative h-48">
                      <Image
                        src={item.main_image_url}
                        alt={item.title ?? 'Item image'}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-2xl font-cornerstone text-green-600">${item.price}</p>
                        <p className="description-text text-gray-500">{getRelativeTime(item.created_at || '')}</p>
                      </div>
                      <h2 className="card-title">{item.title}</h2>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="description-text px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                            {typeDescriptions[item.type]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="description-text px-2 py-1 bg-gray-100 text-gray-800 rounded-full">
                            {conditionDescriptions[item.condition]}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
