'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import Navbar from '../../components/Navbar'
import { Database } from '../../../types/supabase'
import { typeDescriptions, conditionDescriptions } from '../../../lib/utils'

type ItemType = Database['public']['Tables']['items']['Insert']

export default function UploadItemPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [condition, setCondition] = useState<ItemType['condition']>('good')
  const [type, setType] = useState<ItemType['type']>('other')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
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

  // Handle image preview
  useEffect(() => {
    const urls = imageFiles.map(file => URL.createObjectURL(file))
    setImagePreviewUrls(urls)

    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [imageFiles])

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
    <div className="min-h-screen bg-pattern-2">
      <Navbar />
      <main className="main-content">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="content-overlay p-8">
            <button
              onClick={() => router.back()}
              className="btn-primary bg-blue-500 hover:bg-blue-600 mb-6"
            >
              ← Back to Market
            </button>

            <h1 className="heading-1 mb-6">ADD NEW ITEM</h1>

            <div className="space-y-6">
              <div>
                <label className="block font-cornerstone text-gray-700 mb-2">TITLE</label>
                <input
                  type="text"
                  placeholder="Enter item title"
                  className="w-full p-3 border rounded-lg font-bebas text-lg bg-white/80"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-cornerstone text-gray-700 mb-2">DESCRIPTION</label>
                <textarea
                  placeholder="Enter item description"
                  className="w-full p-3 border rounded-lg font-bebas text-lg bg-white/80"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-cornerstone text-gray-700 mb-2">PRICE</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full p-3 pl-8 border rounded-lg font-bebas text-lg bg-white/80"
                    value={price}
                    min="0"
                    step="0.01"
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <label className="block font-cornerstone text-gray-700 mb-2">CONDITION</label>
                <select
                  className="w-full p-3 border rounded-lg font-bebas text-lg bg-white/80"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as ItemType['condition'])}
                >
                  {Object.entries(conditionDescriptions).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-cornerstone text-gray-700 mb-2">TYPE</label>
                <select
                  className="w-full p-3 border rounded-lg font-bebas text-lg bg-white/80"
                  value={type}
                  onChange={(e) => setType(e.target.value as ItemType['type'])}
                >
                  {Object.entries(typeDescriptions).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-cornerstone text-gray-700 mb-2">IMAGES</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
                  className="w-full p-3 border rounded-lg font-bebas text-lg bg-white/80"
                />
                <p className="description-text text-gray-500 mt-1">Upload up to 5 images (max 5MB each)</p>

                {imagePreviewUrls.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 mt-4">
                    {imagePreviewUrls.map((url, index) => (
                      <div key={url} className="relative aspect-square">
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading}
                className="btn-primary w-full py-4 text-lg"
              >
                {uploading ? 'Uploading...' : 'List Item for Sale'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
