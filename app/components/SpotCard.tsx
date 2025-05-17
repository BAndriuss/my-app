'use client'

import { useState } from 'react'
import Image from 'next/image'
import { supabase } from '../../lib/supabaseClient'

interface SpotCardProps {
  spot: {
    id: string
    title: string
    type: string
    image_url: string | null
    user_id: string
    latitude: number
    longitude: number
    is_approved: boolean
  }
  currentUserId: string | null
  onDelete: () => void
  onClick: () => void
  attendanceInfo: {
    active: number
    scheduled: number
    total: number
    isEmpty: boolean
  }
  userLocation: { lat: number; lng: number } | null
  isAdmin?: boolean
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m away`;
  } else {
    const km = meters / 1000;
    return `${km.toFixed(1)}km away`;
  }
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

export default function SpotCard({ 
  spot, 
  currentUserId, 
  onDelete, 
  onClick,
  attendanceInfo,
  userLocation,
  isAdmin
}: SpotCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 ${isAdmin && !spot.is_approved ? 'border-2 border-yellow-500' : ''}`}>
      <div className="relative h-48 cursor-pointer" onClick={onClick}>
        {spot.image_url ? (
          <Image
            src={spot.image_url}
            alt={spot.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400">No image available</span>
          </div>
        )}
        <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-sm">
          {spot.type}
        </div>
        {isAdmin && !spot.is_approved && (
          <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-sm font-semibold">
            Pending Approval
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start">
          <h3 className="font-cornerstone text-xl mb-2">{spot.title}</h3>
          {isAdmin && !spot.is_approved && (
            <span className="text-yellow-500 text-sm font-semibold">⚠️ Pending</span>
          )}
        </div>
        
        {userLocation && (
          <p className="text-gray-600 text-sm mb-2">
            📍 {formatDistance(getDistance(
              userLocation.lat,
              userLocation.lng,
              spot.latitude,
              spot.longitude
            ))}
          </p>
        )}

        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
            {attendanceInfo.active} Active
          </span>
          <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {attendanceInfo.scheduled} Scheduled
          </span>
        </div>
      </div>
    </div>
  )
} 