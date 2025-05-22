'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Image from 'next/image'
import Link from 'next/link'
import Slider from 'react-slick'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import { getRelativeTime, typeDescriptions, conditionDescriptions } from '../../lib/utils'

interface MarketItem {
  id: string
  title: string
  description: string
  price: number
  condition: string
  type: string
  images: string
  main_image_url: string
  sold: boolean
  created_at: string
  user_id: string
  buyer_id: string | null
}

interface SkateSpot {
  id: string
  title: string
  type: string
  image_url: string | null
  latitude: number
  longitude: number
  created_at: string
  is_approved: boolean
  user_id: string
}

export default function RecentActivities() {
  const [marketItems, setMarketItems] = useState<MarketItem[]>([])
  const [skateSpots, setSkateSpots] = useState<SkateSpot[]>([])
  const [spotAttendances, setSpotAttendances] = useState<{[key: string]: any[]}>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carouselSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    pauseOnHover: true,
    responsive: [
      {
        breakpoint: 1280,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        }
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1
        }
      }
    ]
  }

  const fetchSpotAttendances = async () => {
    try {
      const { data, error } = await supabase
        .from('spot_attendances')
        .select('*')
      
      if (error) throw error

      const attendancesBySpot: {[key: string]: any[]} = {}
      data?.forEach(attendance => {
        if (!attendancesBySpot[attendance.spot_id]) {
          attendancesBySpot[attendance.spot_id] = []
        }
        attendancesBySpot[attendance.spot_id].push(attendance)
      })

      setSpotAttendances(attendancesBySpot)
    } catch (error) {
      console.error('Error fetching spot attendances:', error)
    }
  }

  const getSpotAttendanceInfo = (spotId: string) => {
    const attendances = spotAttendances[spotId] || []
    const now = new Date()
    
    const activeAttendances = attendances.filter(a => {
      const startTime = new Date(a.start_time)
      const durationInMs = (a.duration_minutes < 1 ? 0.5 : a.duration_minutes) * 60 * 1000
      const endTime = new Date(startTime.getTime() + durationInMs)
      return now >= startTime && now <= endTime
    })

    const scheduledAttendances = attendances.filter(a => {
      const startTime = new Date(a.start_time)
      return now < startTime
    })

    return {
      active: activeAttendances.length,
      scheduled: scheduledAttendances.length,
      total: activeAttendances.length + scheduledAttendances.length
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    return `${months}mo ago`
  }

  useEffect(() => {
    let isMounted = true

    const fetchMarketItems = async () => {
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5)

        if (error) throw error
        if (isMounted) {
          setMarketItems(data || [])
        }
      } catch (error) {
        console.error('Error fetching market items:', error)
        if (isMounted) {
          setError('Failed to load market items')
        }
      }
    }

    const fetchSkateSpots = async () => {
      try {
        const { data, error } = await supabase
          .from('spots')
          .select('*')
          .eq('is_approved', true)
          .order('created_at', { ascending: false })
          .limit(5)

        if (error) throw error
        if (isMounted) {
          setSkateSpots(data || [])
          await fetchSpotAttendances()
        }
      } catch (error) {
        console.error('Error fetching skate spots:', error)
        if (isMounted) {
          setError('Failed to load skate spots')
        }
      }
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      await Promise.all([fetchMarketItems(), fetchSkateSpots()])
      if (isMounted) {
        setLoading(false)
      }
    }

    fetchData()

    const marketSubscription = supabase
      .channel('market_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'items' },
        () => fetchMarketItems()
      )
      .subscribe()

    const spotsSubscription = supabase
      .channel('spots_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'spots' },
        () => fetchSkateSpots()
      )
      .subscribe()

    const attendancesSubscription = supabase
      .channel('attendances_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'spot_attendances' },
        () => fetchSpotAttendances()
      )
      .subscribe()

    return () => {
      isMounted = false
      marketSubscription.unsubscribe()
      spotsSubscription.unsubscribe()
      attendancesSubscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return <div className="text-center font-cornerstone">Loading recent activities...</div>
  }

  if (error) {
    return <div className="text-center text-red-500 font-cornerstone">{error}</div>
  }

  return (
    <div className="space-y-12">
      {/* Market Items Section */}
      <section>
        <h2 className="heading-2 mb-8">NEWEST IN MARKET </h2>
        {marketItems.length === 0 ? (
          <p className="text-center text-gray-500 font-cornerstone">No items in market yet</p>
        ) : (
          <div className="px-4">
            <Slider {...carouselSettings}>
              {marketItems.map((item) => (
                <div key={item.id} className="px-2">
                  <Link href={`/market/${item.id}`}>
                    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow h-[400px] flex flex-col">
                      <div className="relative w-full h-48 flex-shrink-0">
                        {item.main_image_url ? (
                          <>
                            <Image
                              src={item.main_image_url}
                              alt={item.title}
                              fill
                              className={`object-cover rounded-t-lg ${item.sold ? 'opacity-70' : ''}`}
                            />
                            {item.sold && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-red-500 text-white px-6 py-2 rounded-full text-xl font-bold transform rotate-[-20deg] shadow-lg">
                                  SOLD
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full bg-gray-200 rounded-t-lg flex items-center justify-center">
                            <span className="text-gray-400">No image</span>
                          </div>
                        )}
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
                </div>
              ))}
            </Slider>
          </div>
        )}
      </section>

      {/* Skate Spots Section */}
      <section>
        <h2 className="heading-2 mb-8">POPULAR SPOTS </h2>
        {skateSpots.length === 0 ? (
          <p className="text-center text-gray-500 font-cornerstone">No approved spots yet</p>
        ) : (
          <div className="px-4">
            <Slider {...carouselSettings}>
              {skateSpots.map((spot) => (
                <div key={spot.id} className="px-2">
                  <Link href={`/spots/${spot.id}`}>
                    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow h-[350px] flex flex-col">
                      <div className="relative w-full h-48 flex-shrink-0">
                        {spot.image_url ? (
                          <Image
                            src={spot.image_url}
                            alt={spot.title}
                            fill
                            className="object-cover rounded-t-lg"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 rounded-t-lg flex items-center justify-center">
                            <span className="text-gray-400">No image</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex flex-col flex-grow">
                        <h3 className="font-cornerstone text-lg truncate">{spot.title}</h3>
                        <div className="mt-auto">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-gray-600">{spot.type}</p>
                            <p className="text-sm text-gray-500">
                              {formatTimeAgo(spot.created_at)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                              {getSpotAttendanceInfo(spot.id).active} Active
                            </span>
                            <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {getSpotAttendanceInfo(spot.id).scheduled} Scheduled
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </Slider>
          </div>
        )}
      </section>

      <style jsx global>{`
        .slick-track {
          display: flex !important;
          align-items: stretch;
          margin-left: 0;
          margin-right: 0;
          padding-bottom: 40px;
        }
        .slick-slide {
          height: inherit !important;
          display: flex !important;
          align-items: stretch;
          > div {
            width: 100%;
            display: flex;
          }
        }
        .slick-dots {
          bottom: 0px;
        }
        .slick-dots li button:before {
          font-size: 12px;
          color: #4B5563;
        }
        .slick-dots li.slick-active button:before {
          color: #3B82F6;
        }
        .slick-prev,
        .slick-next {
          width: 30px;
          height: 30px;
          z-index: 1;
        }
        .slick-prev {
          left: -35px;
        }
        .slick-next {
          right: -35px;
        }
        .slick-prev:before,
        .slick-next:before {
          font-size: 30px;
          color: #3B82F6;
        }
        @media (max-width: 640px) {
          .slick-prev {
            left: -25px;
          }
          .slick-next {
            right: -25px;
          }
        }
      `}</style>
    </div>
  )
} 