'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Navbar from '../components/Navbar'
import Link from 'next/link'
import BuyButton from '../components/BuyButton'
import FavoriteButton from '../components/FavoriteButton'
//import DeleteButton from '../components/DeleteButton'
import EditItemModal from '../components/EditItemModal'
import { Database } from '../../types/supabase'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getRelativeTime, typeDescriptions, conditionDescriptions } from '../../lib/utils'

type Item = Database['public']['Tables']['items']['Row']

export default function MarketPage() {
  const [items, setItems] = useState<Item[]>([])
  const [favorites, setFavorites] = useState<Item[]>([])
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

  // Fetch favorites
  const fetchFavorites = async () => {
    if (!userId) return;
    
    const { data: favoritesData, error: favoritesError } = await supabase
      .from('favorites')
      .select('item_id');

    if (favoritesError || !favoritesData) return;

    const itemIds = favoritesData.map(f => f.item_id);
    
    if (itemIds.length === 0) {
      setFavorites([]);
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .in('id', itemIds);

    if (!itemsError && itemsData) {
      setFavorites(itemsData);
    }
  };

  // Update useEffect to include favorites subscription
  useEffect(() => {
    fetchItems();
    fetchFavorites();

    // Set up real-time subscription for items and favorites
    const itemsChannel = supabase
      .channel('market-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items'
        },
        () => {
          fetchItems();
          fetchFavorites();
        }
      )
      .subscribe();

    const favoritesChannel = supabase
      .channel('favorites-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorites'
        },
        () => {
          fetchFavorites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(favoritesChannel);
    };
  }, [userId]);

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
    <div className="min-h-screen bg-pattern-2">
      <Navbar />
      <main className="main-content">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="content-overlay">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h1 className="heading-1">MARKETPLACE</h1>
                <Link href="/market/upload">
                  <button className="btn-primary">
                    + Add Item
                  </button>
                </Link>
              </div>

              <div className="flex gap-8">
                {/* Filters Sidebar */}
                <div className="w-64 flex-shrink-0 space-y-4">
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 shadow-sm">
                    <input
                      type="text"
                      placeholder="Search items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-2 border rounded font-bebas text-base mb-4"
                    />
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block font-cornerstone text-gray-700 mb-1">
                          TYPE
                        </label>
                        <select
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          className="w-full p-2 border rounded font-bebas text-base"
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
                        <label className="block font-cornerstone text-gray-700 mb-1">
                          CONDITION
                        </label>
                        <select
                          value={filterCondition}
                          onChange={(e) => setFilterCondition(e.target.value)}
                          className="w-full p-2 border rounded font-bebas text-base"
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
                        <label className="block font-cornerstone text-gray-700 mb-1">
                          SORT BY
                        </label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                          className="w-full p-2 border rounded font-bebas text-base"
                        >
                          <option value="newest">Newest First</option>
                          <option value="price_low">Price: Low to High</option>
                          <option value="price_high">Price: High to Low</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1">
                  {/* Favorites Section */}
                  {userId && favorites.length > 0 && (
                    <div className="mb-8">
                      <h2 className="heading-2 mb-4">MY FAVORITES</h2>
                      <div className="h-[450px] overflow-y-auto pr-4">
                        <div className="grid grid-cols-3 gap-6 auto-rows-min">
                          {favorites.map((item) => (
                            <div
                              key={item.id}
                              className="bg-white/80 backdrop-blur-sm rounded-lg overflow-hidden hover:shadow-lg transition-shadow h-[450px] flex flex-col"
                            >
                              <div className="relative h-48">
                                <div 
                                  onClick={() => router.push(`/market/${item.id}`)}
                                  className="cursor-pointer"
                                >
                                  <div className="relative h-48">
                                    <Image
                                      src={item.main_image_url}
                                      alt={item.title ?? 'Item image'}
                                      fill
                                      className={`object-cover ${item.sold ? 'opacity-70' : ''}`}
                                    />
                                    {item.images.length > 1 && (
                                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 description-text text-white px-2 py-1 rounded">
                                        +{item.images.length - 1} more
                                      </div>
                                    )}
                                    {item.sold && (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-red-500 text-white px-6 py-2 rounded-full text-xl font-bold transform rotate-[-20deg] shadow-lg">
                                          SOLD
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Favorite button positioned absolutely */}
                                <div className="absolute top-2 right-2 z-10">
                                  <FavoriteButton item={item} userId={userId} />
                                </div>
                              </div>

                              <div className="p-4 flex flex-col flex-grow">
                                <div className="flex justify-between items-start mb-2">
                                  <p className="text-2xl font-cornerstone text-green-600">${item.price}</p>
                                  <div className="flex flex-col items-end">
                                    <p className="description-text text-gray-500">{getRelativeTime(item.created_at || '')}</p>
                                    {item.sold && (
                                      <p className="text-red-500 text-sm font-semibold">Item no longer available</p>
                                    )}
                                  </div>
                                </div>
                                <h2 className="card-title truncate">{item.title}</h2>
                                <div className="space-y-1 mb-4">
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

                                {/* Action buttons */}
                                <div className="mt-auto">
                                  {item.user_id === userId ? (
                                    !item.sold && (
                                      <button
                                        onClick={() => openModal(item)}
                                        className="btn-primary bg-yellow-500 hover:bg-yellow-600 w-full"
                                      >
                                        Edit
                                      </button>
                                    )
                                  ) : (
                                    !item.sold && <BuyButton item={item} onPurchaseComplete={fetchItems} />
                                  )}
                                  {item.sold && (
                                    <div className="text-center text-red-500 font-semibold py-2 bg-red-50 rounded">
                                      Sold
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Items Grid */}
                  <div>
                    <h2 className="heading-2 mb-4">ALL ITEMS</h2>
                    <div className="h-[800px] overflow-y-auto pr-4">
                      <div className="grid grid-cols-3 gap-6 auto-rows-min">
                        {filteredAndSortedItems.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white/80 backdrop-blur-sm rounded-lg overflow-hidden hover:shadow-lg transition-shadow h-[450px] flex flex-col"
                          >
                            <div className="relative h-48">
                              <div 
                                onClick={() => router.push(`/market/${item.id}`)}
                                className="cursor-pointer"
                              >
                                <div className="relative h-48">
                                  <Image
                                    src={item.main_image_url}
                                    alt={item.title ?? 'Item image'}
                                    fill
                                    className={`object-cover ${item.sold ? 'opacity-70' : ''}`}
                                  />
                                  {item.images.length > 1 && (
                                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 description-text text-white px-2 py-1 rounded">
                                      +{item.images.length - 1} more
                                    </div>
                                  )}
                                  {item.sold && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="bg-red-500 text-white px-6 py-2 rounded-full text-xl font-bold transform rotate-[-20deg] shadow-lg">
                                        SOLD
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Favorite button positioned absolutely */}
                              <div className="absolute top-2 right-2 z-10">
                                <FavoriteButton item={item} userId={userId} />
                              </div>
                            </div>

                            <div className="p-4 flex flex-col flex-grow">
                              <div className="flex justify-between items-start mb-2">
                                <p className="text-2xl font-cornerstone text-green-600">${item.price}</p>
                                <div className="flex flex-col items-end">
                                  <p className="description-text text-gray-500">{getRelativeTime(item.created_at || '')}</p>
                                  {item.sold && (
                                    <p className="text-red-500 text-sm font-semibold">Item no longer available</p>
                                  )}
                                </div>
                              </div>
                              <h2 className="card-title truncate">{item.title}</h2>
                              <div className="space-y-1 mb-4">
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

                              {/* Action buttons */}
                              <div className="mt-auto">
                                {item.user_id === userId ? (
                                  !item.sold && (
                                    <button
                                      onClick={() => openModal(item)}
                                      className="btn-primary bg-yellow-500 hover:bg-yellow-600 w-full"
                                    >
                                      Edit
                                    </button>
                                  )
                                ) : (
                                  !item.sold && <BuyButton item={item} onPurchaseComplete={fetchItems} />
                                )}
                                {item.sold && (
                                  <div className="text-center text-red-500 font-semibold py-2 bg-red-50 rounded">
                                    Sold
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {showModal && selectedItem && (
        <EditItemModal
          item={selectedItem}
          onClose={closeModal}
          onUpdated={() => {
            fetchItems();
            fetchFavorites();
          }}
        />
      )}
    </div>
  )
}
