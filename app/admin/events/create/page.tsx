'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import Navbar from '../../../components/Navbar';

interface Spot {
  id: string;
  name: string;
  address: string;
}

export default function CreateEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSpot, setSelectedSpot] = useState<string>('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminAndLoadSpots = async () => {
      try {
        // Check if user is admin
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        if (!profile?.is_admin) {
          router.push('/tournaments');
          return;
        }

        // Load spots
        const { data: spotsData, error: spotsError } = await supabase
          .from('spots')
          .select('id, name, address')
          .order('name');

        if (spotsError) throw spotsError;
        setSpots(spotsData || []);

      } catch (err) {
        console.error('Error:', err);
        setError('Failed to load spots.');
      }
    };

    checkAdminAndLoadSpots();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let mediaUrl = null;
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('event-media')
          .upload(fileName, mediaFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
      }

      const { error: eventError } = await supabase
        .from('events')
        .insert([
          {
            title,
            description,
            start_date: startDate,
            end_date: endDate,
            spot_id: selectedSpot || null,
            media_url: mediaUrl,
            admin_id: user.id,
            status: new Date(startDate) <= new Date() ? 'active' : 'upcoming'
          }
        ]);

      if (eventError) throw eventError;

      router.push('/events');

    } catch (err) {
      console.error('Error creating event:', err);
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pattern-1">
      <Navbar />
      <main className="main-content">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="content-overlay p-8">
            <h1 className="heading-1 mb-6">CREATE NEW EVENT</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="title" className="block font-cornerstone text-gray-700 mb-2">
                  TITLE*
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 border rounded font-bebas text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block font-cornerstone text-gray-700 mb-2">
                  DESCRIPTION
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 border rounded font-bebas text-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="startDate" className="block font-cornerstone text-gray-700 mb-2">
                    START DATE*
                  </label>
                  <input
                    type="datetime-local"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-3 border rounded font-bebas text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block font-cornerstone text-gray-700 mb-2">
                    END DATE*
                  </label>
                  <input
                    type="datetime-local"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-3 border rounded font-bebas text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="spot" className="block font-cornerstone text-gray-700 mb-2">
                  SPOT
                </label>
                <select
                  id="spot"
                  value={selectedSpot}
                  onChange={(e) => setSelectedSpot(e.target.value)}
                  className="w-full p-3 border rounded font-bebas text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a spot (optional)</option>
                  {spots.map((spot) => (
                    <option key={spot.id} value={spot.id}>
                      {spot.name} - {spot.address}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-cornerstone text-gray-700 mb-2">
                  EVENT IMAGE
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                  className="w-full p-3 border rounded font-bebas text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded description-text">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full"
              >
                {isLoading ? 'Creating...' : 'Create Event'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
} 