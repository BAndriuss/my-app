'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Database } from '../../types/supabase'
import Image from 'next/image'

type Item = Database['public']['Tables']['items']['Row']

export default function EditItemModal({
  item,
  onClose,
  onUpdated,
}: {
  item: Item
  onClose: () => void
  onUpdated: () => void
}) {
  const [title, setTitle] = useState(item.title ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [price, setPrice] = useState(item.price)
  const [condition, setCondition] = useState(item.condition)
  const [type, setType] = useState(item.type)
  const [newImages, setNewImages] = useState<File[]>([])
  const [existingImages, setExistingImages] = useState(item.images)
  const [uploading, setUploading] = useState(false)

  const handleUpdate = async () => {
    setUploading(true)

    try {
      // Upload new images if any
      const newImageUrls = await Promise.all(
        newImages.map(async (file) => {
          const fileExt = file.name.split('.').pop()
          const filePath = `${item.user_id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from('item-images')
            .upload(filePath, file)

          if (uploadError) throw uploadError

          return supabase.storage
            .from('item-images')
            .getPublicUrl(filePath).data.publicUrl
        })
      )

      // Combine existing and new images
      const allImages = [...existingImages, ...newImageUrls]

      const { error } = await supabase
        .from('items')
        .update({
          title,
          description,
          price,
          condition,
          type,
          main_image_url: allImages[0], // First image is main image
          images: allImages,
        })
        .eq('id', item.id)

      if (error) throw error

      onUpdated()
      onClose()
    } catch (error) {
      console.error('Error:', error)
      alert('Error updating item. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-500 hover:text-black text-xl"
        >
          &times;
        </button>

        <h2 className="text-xl font-bold mb-4">Edit Item</h2>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 border rounded mb-3"
          placeholder="Item title"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 border rounded mb-3"
          placeholder="Item description"
        />

        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-full p-2 border rounded mb-3"
          placeholder="Price"
        />

        <select
          className="w-full p-2 border rounded mb-3"
          value={condition}
          onChange={(e) => setCondition(e.target.value as Item['condition'])}
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
          onChange={(e) => setType(e.target.value as Item['type'])}
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

        {/* Existing Images */}
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Current Images:</p>
          <div className="grid grid-cols-3 gap-2">
            {existingImages.map((imageUrl, index) => (
              <div key={imageUrl} className="relative">
                <Image
                  src={imageUrl}
                  alt={`Item image ${index + 1}`}
                  width={100}
                  height={100}
                  className="object-cover rounded"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-sm"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* New Images */}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setNewImages(Array.from(e.target.files || []))}
          className="w-full p-2 border rounded mb-4"
        />

        <button
          onClick={handleUpdate}
          disabled={uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded disabled:bg-blue-400"
        >
          {uploading ? 'Updating...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
