'use client';

import { useEffect, useState, useRef } from 'react';
import Map, { MapProvider, Source, Layer } from 'react-map-gl/maplibre';
import { supabase } from '../../lib/supabaseClient';
import maplibregl from 'maplibre-gl';
import AddSpotModal from './AddSpotModal';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Feature } from 'geojson';
import SpotList from '../components/Spotlist';

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
}

export default function MyMap() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [clickedLatLng, setClickedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [hoveredSpot, setHoveredSpot] = useState<Spot | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filterDistance, setFilterDistance] = useState('')
  const [filterType, setFilterType] = useState('all');

  const fetchSpots = async () => {
    const { data } = await supabase.from('spots').select('*');
    if (data) {
      setSpots(data as Spot[]);
    }
  };

  const filteredSpots = spots.filter((spot) => {
    const matchesSearch =
      spot.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spot.type.toLowerCase().includes(searchQuery.toLowerCase());
  
    const matchesType =
      filterType === 'all' || spot.type === filterType;
  
    return matchesSearch && matchesType;
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
    fetchSpots();
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      addMarkers(mapRef.current);
    }
  }, [visibleSpots, filterType]); // << ADD filterType here!

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id || null);
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
            Lat: {selectedSpot.latitude.toFixed(5)}, Lng: {selectedSpot.longitude.toFixed(5)}
          </p>

          {selectedSpot.user_id === currentUserId && (
            <button
              onClick={handleDeleteSpot}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded w-full font-bold"
            >
              🗑️ Delete Spot
            </button>
          )}
        </div>
      )}

    </div>

    <SpotList
  spots={spots}
  userLocation={userLocation}
  searchQuery={searchQuery}
  filterDistance={filterDistance}
  filterType={filterType}    // <<< ADD THIS
  setSearchQuery={setSearchQuery}
  setFilterDistance={setFilterDistance}
  setFilterType={setFilterType}  // <<< ADD THIS
  currentPage={currentPage}
  setCurrentPage={setCurrentPage}
  totalPages={1}
  onSpotClick={(spot) => {
    mapRef.current?.flyTo({ center: [spot.longitude, spot.latitude], zoom: 15 });
    setSelectedSpot(spot);
  }}
/>

<p className="text-center mt-4 text-sm text-gray-500">
  Current filter type: <span className="font-bold">{filterType}</span>
</p>
    </div>
  );
}
