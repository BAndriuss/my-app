'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Map, { MapProvider, Source, Layer } from 'react-map-gl/maplibre';
import { supabase } from '../../lib/supabaseClient';
import maplibregl from 'maplibre-gl';
import AddSpotModal from './AddSpotModal';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Feature } from 'geojson';
import SpotList from '../components/Spotlist';
import AttendButton from './AttendButton'
import SpotAttendance from './SpotAttendance'
import DeleteButton from './DeleteButton';
import CommentSection from './CommentSection';

// 🌍 ADD THIS FUNCTION
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

interface Spot {
  id: string;
  user_id: string;
  title: string;
  type: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  is_approved: boolean;
  created_at: string;
}

export default function MyMap() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [clickedLatLng, setClickedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [hoveredSpot, setHoveredSpot] = useState<Spot | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [spotAddress, setSpotAddress] = useState<string>('');
  const mapRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filterDistance, setFilterDistance] = useState('')
  const [filterType, setFilterType] = useState('all');
  const [filterAttendance, setFilterAttendance] = useState('all');
  const [spotAttendances, setSpotAttendances] = useState<{[key: string]: any[]}>({});
  const [filterCity, setFilterCity] = useState('all');
  const [cities, setCities] = useState<string[]>([]);
  const [spotAddresses, setSpotAddresses] = useState<Record<string, { address: string; city: string }>>({});
  const [cityCoordinates, setCityCoordinates] = useState<Record<string, { lat: number; lng: number }>>({});
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  const attendanceFilters = [
    { value: 'all', label: 'All Spots' },
    { value: 'active', label: 'Currently Active' },
    { value: 'scheduled', label: 'Has Scheduled' },
    { value: 'popular', label: '3+ People' },
    { value: 'empty', label: 'No Attendees' }
  ];

  const fetchSpotAttendances = async () => {
    const { data, error } = await supabase
      .from('spot_attendances')
      .select('*');

    if (!error && data) {
      const attendancesBySpot: Record<string, any[]> = {};
      
      data.forEach(attendance => {
        if (!attendancesBySpot[attendance.spot_id]) {
          attendancesBySpot[attendance.spot_id] = [];
        }
        attendancesBySpot[attendance.spot_id].push(attendance);
      });

      console.log('Updated attendances:', attendancesBySpot); // Debug log
      setSpotAttendances(attendancesBySpot);
    } else {
      console.error('Error fetching attendances:', error);
    }
  };

  const getSpotAttendanceStatus = (spotId: string) => {
    const attendances = spotAttendances[spotId] || [];
    const now = new Date();
    
    const activeAttendances = attendances.filter(a => {
      const startTime = new Date(a.start_time);
      const durationInMs = (a.duration_minutes < 1 ? 0.5 : a.duration_minutes) * 60 * 1000;
      const endTime = new Date(startTime.getTime() + durationInMs);
      return now >= startTime && now <= endTime;
    });

    const scheduledAttendances = attendances.filter(a => {
      const startTime = new Date(a.start_time);
      return now < startTime;
    });

    const total = activeAttendances.length + scheduledAttendances.length;

    return {
      hasActive: activeAttendances.length > 0,
      hasScheduled: scheduledAttendances.length > 0,
      totalCount: total,
      isEmpty: total === 0,
      activeCount: activeAttendances.length,
      scheduledCount: scheduledAttendances.length
    };
  };

  // Add this helper function for delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const getAddress = async (lat: number, lon: number, retryCount = 0): Promise<{ address: string; city: string }> => {
    try {
      // Try to get from localStorage cache first
      const cacheKey = `address_${lat}_${lon}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Add exponential backoff delay based on retry count
      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await delay(backoffDelay);

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`,
          {
            headers: {
              'User-Agent': 'SkateSpotApp/1.0',
              'Accept-Language': 'en'
            },
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (response.status === 429) { // Rate limit hit
          if (retryCount < 3) {
            console.log(`Rate limited, retry ${retryCount + 1} in ${backoffDelay}ms`);
            await delay(backoffDelay);
            return getAddress(lat, lon, retryCount + 1);
          }
          throw new Error('Rate limit exceeded after retries');
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        if (data.address) {
          const result = {
            address: data.display_name,
            city: data.address.city || data.address.town || data.address.village || 'Unknown'
          };
          
          // Cache the result
          localStorage.setItem(cacheKey, JSON.stringify(result));
          return result;
        }

        return {
          address: 'Address not found',
          city: 'Unknown'
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      console.error('Error fetching address:', error);
      
      // Retry on network errors, timeouts, or rate limits
      if (retryCount < 3 && (
        error instanceof TypeError || 
        error.name === 'AbortError' ||
        (error.message && (
          error.message.includes('rate limit') ||
          error.message.includes('network') ||
          error.message.includes('timeout')
        ))
      )) {
        console.log(`Retrying address fetch (${retryCount + 1}/3)`);
        await delay(Math.min(1000 * Math.pow(2, retryCount), 10000));
        return getAddress(lat, lon, retryCount + 1);
      }

      return {
        address: 'Error fetching address',
        city: 'Unknown'
      };
    }
  };

  // Calculate average coordinates for each city
  const calculateCityCoordinates = (spots: Spot[], addresses: Record<string, { address: string; city: string }>) => {
    const citySpots: Record<string, { totalLat: number; totalLng: number; count: number }> = {};

    spots.forEach(spot => {
      const city = addresses[spot.id]?.city;
      if (city) {
        if (!citySpots[city]) {
          citySpots[city] = { totalLat: 0, totalLng: 0, count: 0 };
        }
        citySpots[city].totalLat += spot.latitude;
        citySpots[city].totalLng += spot.longitude;
        citySpots[city].count += 1;
      }
    });

    const coordinates: Record<string, { lat: number; lng: number }> = {};
    Object.entries(citySpots).forEach(([city, data]) => {
      coordinates[city] = {
        lat: data.totalLat / data.count,
        lng: data.totalLng / data.count
      };
    });

    return coordinates;
  };

  const fetchSpots = async () => {
    try {
      // For admin users, fetch all spots. For non-admin users, only fetch approved spots
      const { data, error } = await supabase
        .from('spots')
        .select('*');

      if (error) {
        console.error('Error fetching spots:', error);
        return;
      }

      // Filter spots based on admin status
      const filteredData = isAdmin ? data : data.filter((spot: Spot) => spot.is_approved);
      setSpots(filteredData);
      
      const addresses: Record<string, { address: string; city: string }> = {};
      const citiesSet = new Set<string>();
      
      // Process spots in smaller batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < filteredData.length; i += batchSize) {
        const batch = filteredData.slice(i, i + batchSize);
        
        // Process each batch
        await Promise.all(
          batch.map(async (spot) => {
            try {
              const addressInfo = await getAddress(spot.latitude, spot.longitude);
              addresses[spot.id] = addressInfo;
              citiesSet.add(addressInfo.city);
            } catch (error) {
              console.error(`Error fetching address for spot ${spot.id}:`, error);
              addresses[spot.id] = { address: 'Error fetching address', city: 'Unknown' };
            }
          })
        );

        // Add a delay between batches
        if (i + batchSize < filteredData.length) {
          await delay(1000); // 1 second delay between batches
        }
      }
      
      setSpotAddresses(addresses);
      setCities(Array.from(citiesSet).sort());

      // Calculate and store city coordinates
      const coordinates = calculateCityCoordinates(filteredData, addresses);
      setCityCoordinates(coordinates);
    } catch (error) {
      console.error('Error in fetchSpots:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingAddresses(true);
      try {
        await fetchSpots();
        await fetchSpotAttendances();
      } finally {
        setIsLoadingAddresses(false);
      }
    };
    loadData();

    // Set up real-time subscription for attendance changes
    const attendanceChannel = supabase
      .channel('spot-attendances-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spot_attendances'
        },
        async (payload) => {
          console.log('Attendance change detected:', payload);
          await fetchSpotAttendances();
        }
      )
      .subscribe();

    // Set up real-time subscription for spot changes
    const spotsChannel = supabase
      .channel('spots-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spots'
        },
        async (payload) => {
          console.log('Spot change detected:', payload);
          await fetchSpots();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(spotsChannel);
    };
  }, [isAdmin]);

  const filteredSpots = spots.filter((spot) => {
    // For non-admin users, only show approved spots
    if (!isAdmin && !spot.is_approved) {
      return false;
    }

    const matchesSearch =
      spot.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spot.type.toLowerCase().includes(searchQuery.toLowerCase());
  
    const matchesType =
      filterType === 'all' || spot.type === filterType;

    const matchesCity =
      filterCity === 'all' || 
      (spotAddresses[spot.id]?.city === filterCity);

    const attendanceStatus = getSpotAttendanceStatus(spot.id);
    const matchesAttendance = 
      filterAttendance === 'all' ||
      (filterAttendance === 'active' && attendanceStatus.activeCount > 0) ||
      (filterAttendance === 'scheduled' && attendanceStatus.scheduledCount > 0) ||
      (filterAttendance === 'popular' && attendanceStatus.totalCount >= 3) ||
      (filterAttendance === 'empty' && attendanceStatus.totalCount === 0);
  
    return matchesSearch && matchesType && matchesAttendance && matchesCity;
  });
  
  const sortedSpots = userLocation
    ? [...filteredSpots].sort((a, b) => {
        const distA = getDistanceFromLatLonInMeters(userLocation.lat, userLocation.lng, a.latitude, a.longitude);
        const distB = getDistanceFromLatLonInMeters(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
        return distA - distB;
      })
    : filteredSpots;
  
  // 🛑 NOW: Apply distance filter
  const visibleSpots = sortedSpots.filter((spot) => {
    if (!userLocation || !filterDistance || filterDistance === 'all') return true;
    
    const distance = getDistanceFromLatLonInMeters(
      userLocation.lat,
      userLocation.lng,
      spot.latitude,
      spot.longitude
    );
  
    return distance <= parseInt(filterDistance); // only show within distance
  });



  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
  
    const map = mapRef.current;
    let zoomLevel = 14; // default zoom
  
    if (filterDistance === '500') zoomLevel = 16;
    else if (filterDistance === '1000') zoomLevel = 15;
    else if (filterDistance === '5000') zoomLevel = 12;
    else if (filterDistance === '10000') zoomLevel = 10;
  
    map.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: zoomLevel,
      duration: 1000,
    });
  }, [filterDistance, userLocation]);




  const addMarkers = (map: any) => {
    document.querySelectorAll('.marker').forEach((marker) => marker.remove());
    


    visibleSpots.forEach((spot) => {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundImage = `url(/${spot.type}.png)`;
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.backgroundSize = 'cover';
      el.style.borderRadius = '50%';
      el.style.cursor = 'pointer';

      el.addEventListener('mouseenter', () => {
        setHoveredSpot(spot);
      });
      el.addEventListener('mouseleave', () => {
        setHoveredSpot(null);
      });
      el.addEventListener('click', () => {
        setSelectedSpot(spot);
      });

      new maplibregl.Marker({ element: el })
        .setLngLat([spot.longitude, spot.latitude])
        .addTo(map);
    });
  };

  const handleMapLoad = (e: any) => {
    const map = e.target;
    mapRef.current = map;
    addMarkers(map);
  };

  useEffect(() => {
    if (mapRef.current) {
      addMarkers(mapRef.current);
    }
  }, [visibleSpots, filterType]); // << ADD filterType here!

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id || null);
      
      if (session?.user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();
        
        setIsAdmin(data?.is_admin || false);
      }
    };
    getUser();
    fetchSpots();
  }, []);

  const handleMapClick = (e: any) => {
    if (e.originalEvent.target.classList.contains('marker')) {
      return;
    }

    const { lngLat } = e;
    const clickedPoint = { lat: lngLat.lat, lng: lngLat.lng };

    // 🚫 Check distance
    const tooClose = spots.some((spot) => {
      const distance = getDistanceFromLatLonInMeters(
        clickedPoint.lat,
        clickedPoint.lng,
        spot.latitude,
        spot.longitude
      );
      return distance < 50; // BLOCK if within 50 meters
    });

    if (tooClose) {
      alert('❌ Too close to another spot!');
      return;
    }

    // ✅ Otherwise allow
    setClickedLatLng({ lat: lngLat.lat, lng: lngLat.lng });
    setSelectedSpot(null);
  };

  const handleModalClose = () => setClickedLatLng(null);

  const handleSpotAdded = async () => {
    await fetchSpots();
    setClickedLatLng(null);
  };

  const handleDeleteSpot = async () => {
    if (!selectedSpot) return;

    const { error } = await supabase
      .from('spots')
      .delete()
      .eq('id', selectedSpot.id);

    if (!error) {
      await fetchSpots();
      setSelectedSpot(null);
    } else {
      console.error('Error deleting spot:', error);
    }
  };




  const drawCircle = (center: [number, number], radiusInMeters = 50): Feature => {
    const points = 64;
    const coords = { latitude: center[1], longitude: center[0] };

    const km = radiusInMeters / 1000;
    const ret = [];
    const distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
    const distanceY = km / 110.574;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]);
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ret] },
      properties: {}, // needed
    };
  };


  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting user location:', error);
        }
      );
    }
  }, []);


  const zoomToSpot = (spot: Spot) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [spot.longitude, spot.latitude],
      zoom: 15,
    });
    setSelectedSpot(spot);
  };

  useEffect(() => {
    if (selectedSpot) {
      getAddress(selectedSpot.latitude, selectedSpot.longitude)
        .then(address => setSpotAddress(address.address));
    }
  }, [selectedSpot]);

  // Add handler for city filter changes
  const handleCityChange = (city: string) => {
    setFilterCity(city);
    
    if (city !== 'all' && cityCoordinates[city]) {
      const coords = cityCoordinates[city];
      mapRef.current?.flyTo({
        center: [coords.lng, coords.lat],
        zoom: 13,
        duration: 1500
      });
    }
  };

  // Create a memoized version of spotAttendances to ensure consistent reference
  const memoizedSpotAttendances = useMemo(() => spotAttendances, [spotAttendances]);

  return (
    <div>
    <div className="relative w-full h-[70vh] overflow-hidden">
      <MapProvider>
        <Map
          mapLib={import('maplibre-gl')}
          mapStyle="https://api.maptiler.com/maps/streets/style.json?key=RD3p6p7h2mqU4rrZUEKR"
          initialViewState={{
            longitude: 24.0,
            latitude: 55.0,
            zoom: 6,
          }}
          onLoad={handleMapLoad}
          onClick={handleMapClick}
          style={{ width: '100%', height: '100%' }}
        >
          {/* 🔥 Show forbidden zones */}
          {hoveredSpot && !selectedSpot && (
            <Source
              id="hovered-circle"
              type="geojson"
              data={drawCircle([hoveredSpot.longitude, hoveredSpot.latitude])}
            >
              <Layer
                id="hover-layer"
                type="fill"
                paint={{
                  'fill-color': '#ff0000',
                  'fill-opacity': 0.2,
                }}
              />
            </Source>
          )}
          {selectedSpot && (
            <Source
              id="selected-circle"
              type="geojson"
              data={drawCircle([selectedSpot.longitude, selectedSpot.latitude])}
            >
              <Layer
                id="selected-layer"
                type="fill"
                paint={{
                  'fill-color': '#ff0000',
                  'fill-opacity': 0.3,
                }}
              />
            </Source>
          )}
        </Map>
      </MapProvider>

      {/* Add spot modal */}
      {clickedLatLng && (
        <AddSpotModal
          latitude={clickedLatLng.lat}
          longitude={clickedLatLng.lng}
          onClose={handleModalClose}
          onAdded={handleSpotAdded}
        />
      )}

      {/* Sidebar for spot info */}
      {selectedSpot && (
        <div className="fixed right-0 top-0 w-80 h-full bg-white shadow-lg z-50 p-6 overflow-y-auto">
          <button
            onClick={() => setSelectedSpot(null)}
            className="text-black text-2xl absolute top-4 right-6 hover:text-gray-600"
          >
            &times;
          </button>

          <h2 className="text-2xl font-bold mb-4">{selectedSpot.title}</h2>

          <img
            src={selectedSpot.image_url || '/default-spot.png'}
            alt={selectedSpot.title}
            className="w-full h-48 object-cover mb-4 rounded"
          />

          <p className="text-gray-600 mb-2">Type: {selectedSpot.type}</p>
          <p className="text-gray-600 mb-2">
            📍 {spotAddresses[selectedSpot.id]?.address || 'Loading address...'}
          </p>
          <p className="text-gray-600 mb-4">
            Added: {new Date(selectedSpot.created_at).toLocaleDateString()}
          </p>

          <div className="mb-6">
            <AttendButton
              spotId={selectedSpot.id}
              userId={currentUserId}
              onAttendanceChange={() => {
                // Force a re-render of the SpotAttendance component
                console.log('Attendance changed, refreshing sidebar...')
                // Using a key prop to force remount of SpotAttendance
                setSelectedSpot({...selectedSpot, is_approved: selectedSpot.is_approved, created_at: selectedSpot.created_at})
              }}
            />
          </div>

          <div className="border-t pt-4">
            <SpotAttendance 
              key={`attendance-${selectedSpot.id}-${Date.now()}`} 
              spotId={selectedSpot.id} 
            />
          </div>

          <CommentSection 
            spotId={selectedSpot.id}
            currentUserId={currentUserId}
          />

          {(currentUserId === selectedSpot.user_id || isAdmin) && (
            <div className="mt-4 space-y-2 w-[270px]">
              <button
                onClick={() => {
                  // TODO: Implement edit functionality
                  alert('Edit functionality coming soon!')
                }}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded font-semibold"
              >
                Edit Spot
              </button>
              <DeleteButton
                onDelete={handleDeleteSpot}
                itemName="spot"
              />
            </div>
          )}
        </div>
      )}

    </div>

    <SpotList
  spots={spots}
  userLocation={userLocation}
  searchQuery={searchQuery}
  filterDistance={filterDistance}
  filterType={filterType}
  filterAttendance={filterAttendance}
  filterCity={filterCity}
  setSearchQuery={setSearchQuery}
  setFilterDistance={setFilterDistance}
  setFilterType={setFilterType}
  setFilterAttendance={setFilterAttendance}
  setFilterCity={handleCityChange}
  currentPage={currentPage}
  setCurrentPage={setCurrentPage}
  totalPages={1}
  onSpotClick={(spot) => {
    mapRef.current?.flyTo({ center: [spot.longitude, spot.latitude], zoom: 15 });
    setSelectedSpot(spot);
  }}
  spotAttendances={spotAttendances}
  spotAddresses={spotAddresses}
  cities={cities}
  isLoadingAddresses={isLoadingAddresses}
  isAdmin={isAdmin}
/>

<p className="text-center mt-4 text-sm text-gray-500">
  Current filter type: <span className="font-bold">{filterType}</span>
</p>
    </div>
  );
}
