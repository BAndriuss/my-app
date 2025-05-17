'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Database } from '../../types/supabase'

type Item = Database['public']['Tables']['items']['Row']

interface FavoriteButtonProps {
  item: Item
  userId: string | null
}

export default function FavoriteButton({ item, userId }: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkIfFavorite = async () => {
      if (!userId) {
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('item_id', item.id)
        .single()

      if (!error && data) {
        setIsFavorite(true)
      }
      setIsLoading(false)
    }

    checkIfFavorite()
  }, [userId, item.id])

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault() // Prevent the card click event
    e.stopPropagation() // Stop event bubbling

    if (!userId) {
      alert('Please sign in to favorite items')
      return
    }

    setIsLoading(true)

    if (isFavorite) {
      // Remove from favorites
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('item_id', item.id)

      if (!error) {
        setIsFavorite(false)
      }
    } else {
      // Add to favorites
      const { error } = await supabase
        .from('favorites')
        .insert([
          {
            user_id: userId,
            item_id: item.id
          }
        ])

      if (!error) {
        setIsFavorite(true)
      }
    }

    setIsLoading(false)
  }

  return (
    <button
      onClick={toggleFavorite}
      disabled={isLoading}
      className={`
        w-10 h-10 flex items-center justify-center
        rounded-lg bg-white bg-opacity-80 backdrop-blur-sm
        shadow-sm hover:bg-opacity-100
        transition-all duration-200 ease-in-out
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        group
      `}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <svg
        className={`w-6 h-6 transition-all duration-200 ease-in-out
          ${isFavorite 
            ? 'text-red-500 fill-red-500 group-hover:text-red-600 group-hover:fill-red-600' 
            : 'text-gray-500 fill-transparent group-hover:text-red-500'
          }`}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
    </button>
  )
} 