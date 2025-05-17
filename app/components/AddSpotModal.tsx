'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function AddSpotModal({
  latitude,
  longitude,
  onClose,
  onAdded,
}: {
  latitude: number
  longitude: number
  onClose: () => void
  onAdded: () => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('skatepark')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const uploadImage = async (file: File) => {
    try {
      if (!file) {
        throw new Error('No file selected')
      }

      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size too large. Please select an image under 5MB.')
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file.')
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase()
      // Only allow certain file types
      if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt || '')) {
        throw new Error('Please select a valid image file (jpg, jpeg, png, gif, or webp).')
      }

      // Create a unique file name with spots/ prefix to keep spot images organized
      const fileName = `spots/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

      const { error: uploadError, data } = await supabase.storage
        .from('item-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw new Error('Error uploading image. Please try again.')
      }

      if (!data) {
        throw new Error('No upload data returned')
      }

      const { data: urlData } = supabase.storage
        .from('item-images')
        .getPublicUrl(data.path)

      if (!urlData.publicUrl) {
        throw new Error('Could not get public URL')
      }

      return urlData.publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      alert(error instanceof Error ? error.message : 'Error uploading image')
      throw error
    }
  }

  const handleSave = async () => {
    try {
      setUploading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user

      if (!user) {
        console.error('User not logged in!')
        return
      }

      let imageUrl = null
      if (file) {
        imageUrl = await uploadImage(file)
      }

      const { error } = await supabase.from('spots').insert([
        {
          user_id: user.id,
          title,
          type,
          latitude,
          longitude,
          image_url: imageUrl,
        },
      ])

      if (error) throw error

      onAdded()
      onClose()
    } catch (error) {
      console.error('Error saving spot:', error)
      alert('Error saving spot. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-500 hover:text-black text-xl"
        >
          &times;
        </button>

        <h2 className="text-2xl font-bold mb-4">Add New Spot</h2>

        <input
          type="text"
          placeholder="Spot Name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 mb-3 border rounded"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full p-2 mb-3 border rounded"
        >
          <option value="skatepark">🛹 Skatepark</option>
          <option value="rail">➖ Rail</option>
          <option value="stairs">🪜 Stairs</option>
          <option value="ledge">🔲 Ledge</option>
          <option value="flatbar">➖ Flatbar</option>
        </select>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Spot Photo
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full p-2 border rounded"
          />
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {file.name}
            </p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold disabled:bg-blue-300"
        >
          {uploading ? 'Saving...' : 'Save Spot'}
        </button>
      </div>
    </div>
  )
}
