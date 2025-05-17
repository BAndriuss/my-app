'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import Navbar from '../../components/Navbar'
import { Database } from '../../../types/supabase'
import Image from 'next/image'
import Link from 'next/link'
import FavoriteButton from '../../components/FavoriteButton'
import { getRelativeTime, typeDescriptions, conditionDescriptions } from '../../../lib/utils'

type Item = Database['public']['Tables']['items']['Row']

export default function FavoritesPage() {
  const [items, setItems] = useState<Item[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchFavorites = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) return
      setUserId(userId)

      // First get favorite item IDs
      const { data: favorites } = await supabase
        .from('favorites')
        .select('item_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (favorites && favorites.length > 0) {
        // Then fetch the actual items
        const { data: items } = await supabase
          .from('items')
          .select('*')
          .in('id', favorites.map(f => f.item_id))

        if (items) {
          setItems(items)
        }
      } else {
        setItems([])
      }
    }

    fetchFavorites()

    // Set up real-time subscription for favorites
    const channel = supabase
      .channel('favorites-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorites'
        },
        () => {
          fetchFavorites()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="min-h-screen bg-pattern-2">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="content-overlay p-8 mb-8">
          <h1 className="heading-1 mb-6">⭐ MY FAVORITES</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.length === 0 && (
            <div className="content-overlay p-8 col-span-full">
              <p className="description-text text-gray-500 text-center">No favorite items yet.</p>
            </div>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="content-overlay overflow-hidden hover:shadow-lg transition-shadow duration-200"
            >
              <div className="relative">
                <Link href={`/market/${item.id}`}>
                  <div className="cursor-pointer">
                    <div className="relative h-48">
                      <Image
                        src={item.main_image_url}
                        alt={item.title ?? 'Item image'}
                        fill
                        className="object-cover"
                      />
                      {item.images.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 description-text text-white px-2 py-1 rounded">
                          +{item.images.length - 1} more
                        </div>
                      )}
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

                {/* Favorite button positioned absolutely */}
                <div className="absolute top-2 right-2 z-10">
                  <FavoriteButton item={item} userId={userId} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 