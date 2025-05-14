'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import Navbar from '../../components/Navbar'
import { Database } from '../../../types/supabase'

type ItemType = Database['public']['Tables']['items']['Insert']

export default function UploadItemPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [condition, setCondition] = useState<ItemType['condition']>('good')
  const [type, setType] = useState<ItemType['type']>('other')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUserId(session?.user?.id ?? null)
    }

    fetchUser()
  }, [])

  const handleUpload = async () => {
    // Check authentication
    if (!userId) {
      alert('Please sign in to upload items')
      return
    }

    // Validate form fields
    if (!title.trim()) {
      alert('Please enter a title')
      return
    }

    if (!description.trim()) {
      alert('Please enter a description')
      return
    }

    if (!price || price <= 0) {
      alert('Please enter a valid price greater than 0')
      return
    }

    if (imageFiles.length === 0) {
      alert('Please upload at least one image')
      return
    }

    if (imageFiles.length > 5) {
      alert('Maximum 5 images allowed')
      return
    }

    // Validate image files
    for (const file of imageFiles) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Images must be less than 5MB each')
        return
      }
      
      if (!file.type.startsWith('image/')) {
        alert('Please upload only image files')
        return
      }
    }

    setUploading(true)

    try {
      // Upload all images
      const imageUrls = await Promise.all(
        imageFiles.map(async (file) => {
          const fileExt = file.name.split('.').pop()
          const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from('item-images')
            .upload(filePath, file)

          if (uploadError) {
            throw uploadError
          }

          return supabase.storage
            .from('item-images')
            .getPublicUrl(filePath).data.publicUrl
        })
      )

      // Save item in database
      const { error } = await supabase.from('items').insert([
        {
          user_id: userId,
          title: title.trim(),
          description: description.trim(),
          price: Number(price),
          condition,
          type,
          main_image_url: imageUrls[0],
          images: imageUrls,
        },
      ])

      if (error) throw error

      router.push('/market')
    } catch (error) {
      console.error('Error:', error)
      alert('Error uploading item. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Navbar />
      <div className="max-w-xl mx-auto mt-10 p-6 shadow rounded border">
        <h2 className="text-xl font-bold mb-4">Upload Item</h2>

        <input
          type="text"
          placeholder="Item title"
          className="w-full p-2 border rounded mb-3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          placeholder="Item description"
          className="w-full p-2 border rounded mb-3"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="number"
          placeholder="Price"
          className="w-full p-2 border rounded mb-3"
          value={price}
          min="0"
          step="0.01"
          onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
        />

        <select
          className="w-full p-2 border rounded mb-3"
          value={condition}
          onChange={(e) => setCondition(e.target.value as ItemType['condition'])}
        >
          <option value="new">New</option>
          <option value="like_new">Like New</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
        </select>

        <select
          className="w-full p-2 border rounded mb-3"
          value={type}
          onChange={(e) => setType(e.target.value as ItemType['type'])}
        >
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

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
          className="w-full p-2 border rounded mb-4"
        />

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded disabled:bg-blue-400"
        >
          {uploading ? 'Uploading...' : 'Upload Item'}
        </button>
      </div>
    </>
  )
}
