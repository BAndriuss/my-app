'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Navbar from '../components/Navbar'
import Link from 'next/link'
import BuyButton from '../components/BuyButton'
//import DeleteButton from '../components/DeleteButton'
import EditItemModal from '../components/EditItemModal'
import { Database } from '../../types/supabase'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

type Item = Database['public']['Tables']['items']['Row']

export default function MarketPage() {
  const [items, setItems] = useState<Item[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCondition, setFilterCondition] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high'>('newest')
  const router = useRouter()

  // Fetch logged in user ID
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUserId(session?.user?.id ?? null)
    }

    getUser()
  }, [])

  // Fetch marketplace items
  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('sold', false)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setItems(data)
    }
  }

  useEffect(() => {
    fetchItems()

    // Set up real-time subscription for items
    const channel = supabase
      .channel('market-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items'
        },
        () => {
          fetchItems()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const openModal = (item: Item) => {
    setSelectedItem(item)
    setShowModal(true)
  }

  const closeModal = () => {
    setSelectedItem(null)
    setShowModal(false)
  }

  // Filter and sort items
  const filteredAndSortedItems = items
    .filter(item => {
      const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = filterType === 'all' || item.type === filterType
      const matchesCondition = filterCondition === 'all' || item.condition === filterCondition
      return matchesSearch && matchesType && matchesCondition
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price_low':
          return a.price - b.price
        case 'price_high':
          return b.price - a.price
        default: // 'newest'
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
    })

  return (
    <>
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <Link href="/market/upload">
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
              + Add Item
            </button>
          </Link>
        </div>

        <div className="flex gap-8">
          {/* Filters Sidebar */}
          <div className="w-64 flex-shrink-0 space-y-4">
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 border rounded"
            />
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="all">All Types</option>
                  <option value="board">Board</option>
                  <option value="wheels">Wheels</option>
                  <option value="trucks">Trucks</option>
                  <option value="bearings">Bearings</option>
                  <option value="griptape">Griptape</option>
                  <option value="hardware">Hardware</option>
                  <option value="tools">Tools</option>
                  <option value="accessories">Accessories</option>
                  <option value="clothing">Clothing</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition
                </label>
                <select
                  value={filterCondition}
                  onChange={(e) => setFilterCondition(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="all">All Conditions</option>
                  <option value="new">New</option>
                  <option value="like_new">Like New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="w-full p-2 border rounded"
                >
                  <option value="newest">Newest First</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Items Grid */}
          <div className="flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedItems.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
                >
                  <div 
                    onClick={() => router.push(`/market/${item.id}`)}
                    className="cursor-pointer"
                  >
                    <div className="relative h-48">
                      <Image
                        src={item.main_image_url}
                        alt={item.title ?? 'Item image'}
                        fill
                        className="object-cover"
                      />
                      {item.images.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                          +{item.images.length - 1} more
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <h2 className="text-lg font-semibold mb-1">{item.title}</h2>
                      <div className="flex justify-between items-center">
                        <p className="text-green-600 font-bold">${item.price}</p>
                        <div className="flex gap-2">
                          <span className="text-sm px-2 py-1 bg-gray-100 rounded">{item.type}</span>
                          <span className="text-sm px-2 py-1 bg-gray-100 rounded">{item.condition}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {item.user_id === userId ? (
                    !item.sold && (
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => openModal(item)}
                          className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm"
                        >
                          Edit
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="px-4 pb-4">
                      <BuyButton item={item} onPurchaseComplete={fetchItems} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && selectedItem && (
        <EditItemModal
          item={selectedItem}
          onClose={closeModal}
          onUpdated={fetchItems}
        />
      )}
    </>
  )
}
