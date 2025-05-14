'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import Navbar from '../../components/Navbar'
import Image from 'next/image'
import BuyButton from '../../components/BuyButton'
import { Database } from '../../../types/supabase'

type Item = Database['public']['Tables']['items']['Row']

export default function ItemDetailPage() {
  const [item, setItem] = useState<Item | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return

      const { data: { session } } = await supabase.auth.getSession()
      setUserId(session?.user?.id ?? null)

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching item:', error)
        router.push('/market')
        return
      }

      setItem(data)
    }

    fetchItem()
  }, [id, router])

  if (!item) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 text-blue-600 hover:text-blue-800"
        >
          ← Back to Market
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square w-full">
              <Image
                src={item.images[currentImageIndex]}
                alt={item.title || 'Item image'}
                fill
                className="object-cover rounded-lg"
              />
            </div>
            
            {item.images.length > 1 && (
              <div className="grid grid-cols-6 gap-2">
                {item.images.map((image, index) => (
                  <button
                    key={image}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`relative aspect-square w-full ${
                      currentImageIndex === index ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      className="object-cover rounded"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Item Details */}
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">{item.title}</h1>
            <p className="text-2xl text-green-600 font-bold">${item.price}</p>
            
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                {item.condition}
              </span>
              <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                {item.type}
              </span>
            </div>

            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold">Description</h3>
              <p className="whitespace-pre-wrap">{item.description}</p>
            </div>

            {item.user_id !== userId && !item.sold && (
              <div className="mt-8">
                <BuyButton 
                  item={item} 
                  onPurchaseComplete={() => router.push('/market')}
                />
              </div>
            )}

            {item.sold && (
              <div className="mt-8 text-red-600 font-semibold">
                This item has been sold
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
} 