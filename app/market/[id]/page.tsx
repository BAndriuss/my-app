'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import Navbar from '../../components/Navbar'
import Image from 'next/image'
import BuyButton from '../../components/BuyButton'
import FavoriteButton from '../../components/FavoriteButton'
import { Database } from '../../../types/supabase'
import { getRelativeTime, typeDescriptions, conditionDescriptions } from '../../../lib/utils'

type Item = Database['public']['Tables']['items']['Row']
interface Profile {
  id: string;
  username: string | null;
  balance: number | null;
  is_admin: boolean;
}

export default function ItemDetailPage() {
  const [item, setItem] = useState<Item | null>(null)
  const [seller, setSeller] = useState<Profile | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return

      const { data: { session } } = await supabase.auth.getSession()
      setUserId(session?.user?.id ?? null)

      // Fetch item
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single()

      if (itemError) {
        console.error('Error fetching item:', itemError)
        router.push('/market')
        return
      }

      setItem(itemData)

      // Fetch seller profile
      if (itemData.user_id) {
        const { data: sellerData, error: sellerError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', itemData.user_id)
          .single()

        if (!sellerError && sellerData) {
          setSeller(sellerData)
        }
      }

      // Check if user is admin
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single()
        
        setIsAdmin(profile?.is_admin ?? false)
      }
    }

    fetchData()
  }, [id, router])

  const handleDelete = async () => {
    if (!item || !window.confirm('Are you sure you want to delete this item?')) return

    setLoading(true)
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', item.id)

    setLoading(false)

    if (error) {
      console.error('Error deleting item:', error)
      alert('Failed to delete item')
      return
    }

    router.push('/market')
  }

  if (!item) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  const canDelete = isAdmin || userId === item.user_id

  return (
    <div className="min-h-screen bg-pattern-2">
      <Navbar />
      <main className="main-content">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="content-overlay p-8">
            <button
              onClick={() => router.back()}
              className="btn-primary bg-blue-500 hover:bg-blue-600 mb-6"
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
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h1 className="heading-1 mb-2">{item.title}</h1>
                    {seller && (
                      <p className="description-text text-gray-600">
                        Seller: <span className="font-cornerstone">{seller.username}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <FavoriteButton item={item} userId={userId} />
                    <p className="description-text text-gray-500">{getRelativeTime(item.created_at || '')}</p>
                  </div>
                </div>
                
                <p className="text-3xl font-cornerstone text-green-600">${item.price}</p>
                
                <div className="space-y-2 mb-6">
                  <span className="description-text px-2 py-1 bg-blue-100 text-blue-800 rounded-full mr-2">
                    {typeDescriptions[item.type]}
                  </span>
                  <span className="description-text px-2 py-1 bg-gray-100 text-gray-800 rounded-full">
                    {conditionDescriptions[item.condition]}
                  </span>
                </div>

                <div className="prose max-w-none">
                  <h3 className="heading-2">Description</h3>
                  <p className="description-text whitespace-pre-wrap">{item.description}</p>
                </div>

                <div className="flex flex-col gap-4 mt-8">
                  {item.user_id !== userId && !item.sold && (
                    <BuyButton 
                      item={item} 
                      onPurchaseComplete={() => router.push('/market')}
                    />
                  )}

                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      disabled={loading}
                      className="btn-danger w-full"
                    >
                      {loading ? 'Deleting...' : 'Delete Item'}
                    </button>
                  )}

                  {item.sold && (
                    <div className="text-red-600 font-semibold text-center p-4 bg-red-50 rounded-lg">
                      This item has been sold
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 