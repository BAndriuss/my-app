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
  const [imageUrl, setImageUrl] = useState('') // later: image upload logic

  const handleSave = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
  
    if (!user) {
      console.error('User not logged in!');
      return;
    }
  
    const { error } = await supabase.from('spots').insert([
      {
        user_id: user.id,
        title,
        type,
        latitude,
        longitude,
        image_url: imageUrl || null,
      },
    ]);
  
    if (!error) {
      onAdded();    // <-- THIS must happen before onClose
      onClose();
    } else {
      console.error('Error adding spot:', error);
    }
  };

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

        {/* Optional photo URL for now */}
        <input
          type="text"
          placeholder="Image URL (optional)"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />

        <button
          onClick={handleSave}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold"
        >
          Save Spot
        </button>
      </div>
    </div>
  )
}
