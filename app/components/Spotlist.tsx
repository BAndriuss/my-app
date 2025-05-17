'use client'
import { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo } from 'react';

interface Spot {
  id: string;
  title: string;
  type: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  user_id: string; // <-- ADD THIS LINE
}

interface SpotListProps {
    spots: Spot[];
    userLocation: { lat: number; lng: number } | null;
    searchQuery: string;
    filterDistance: string;
    filterType: string;
    filterAttendance: string;
    filterCity: string;
    setSearchQuery: Dispatch<SetStateAction<string>>;
    setFilterDistance: Dispatch<SetStateAction<string>>;
    setFilterType: Dispatch<SetStateAction<string>>;
    setFilterAttendance: Dispatch<SetStateAction<string>>;
    setFilterCity: (city: string) => void;
    currentPage: number;
    setCurrentPage: Dispatch<SetStateAction<number>>;
    totalPages: number;
    onSpotClick: (spot: Spot) => void;
    spotAttendances: {[key: string]: any[]};
    spotAddresses: Record<string, { address: string; city: string }>;
    cities: string[];
    isLoadingAddresses: boolean;
}

import { useState } from 'react';

// Simple distance calculator (haversine formula)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth radius
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
  
    const a = Math.sin(Δφ / 2) ** 2 +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
    return R * c; // distance in meters
  }

  export default function SpotList({
    spots,
    userLocation,
    searchQuery,
    filterDistance,
    filterType,
    filterAttendance,
    filterCity,
    setSearchQuery,
    setFilterDistance,
    setFilterType,
    setFilterAttendance,
    setFilterCity,
    currentPage,
    setCurrentPage,
    totalPages,
    onSpotClick,
    spotAttendances,
    spotAddresses,
    cities,
    isLoadingAddresses
  }: SpotListProps) {

  const attendanceFilters = [
    { value: 'all', label: 'All Spots' },
    { value: 'active', label: 'Currently Active' },
    { value: 'scheduled', label: 'Has Scheduled' },
    { value: 'popular', label: '3+ People' },
    { value: 'empty', label: 'No Attendees' }
  ];

  // Memoize the getSpotAttendanceInfo function
  const getSpotAttendanceInfo = useMemo(() => (spotId: string) => {
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
      active: activeAttendances.length,
      scheduled: scheduledAttendances.length,
      total: total,
      isEmpty: total === 0
    };
  }, [spotAttendances]);

  // Memoize the filtered spots
  const filteredSpots = useMemo(() => {
    console.log('DEBUG - Initial data:', {
      totalSpots: spots.length,
      filterDistance,
      userLocation,
      filterType,
      filterAttendance,
      searchQuery
    });

    // Start with all spots
    let filtered = [...spots];
    
    // Apply each filter separately and log results
    if (searchQuery) {
      filtered = filtered.filter(spot => 
        spot.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spot.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(spot => spot.type === filterType);
    }

    if (filterAttendance !== 'all') {
      filtered = filtered.filter(spot => {
        const attendanceInfo = getSpotAttendanceInfo(spot.id);
        return (
          (filterAttendance === 'active' && attendanceInfo.active > 0) ||
          (filterAttendance === 'scheduled' && attendanceInfo.scheduled > 0) ||
          (filterAttendance === 'popular' && attendanceInfo.total >= 3) ||
          (filterAttendance === 'empty' && attendanceInfo.isEmpty)
        );
      });
    }

    // Only apply distance filter if we have a specific distance value
    if (filterDistance && filterDistance !== 'all' && userLocation) {
      filtered = filtered.filter(spot => {
        const distance = getDistance(
          userLocation.lat,
          userLocation.lng,
          spot.latitude,
          spot.longitude
        );
        return distance <= parseInt(filterDistance);
      });
    }

    console.log('Final filtered count:', filtered.length);
    return filtered;
  }, [
    spots,
    searchQuery,
    filterType,
    filterDistance,
    filterAttendance,
    userLocation,
    getSpotAttendanceInfo
  ]);

  // Debug pagination
  const paginatedSpots = useMemo(() => {
    const spotsPerPage = 10;
    const start = (currentPage - 1) * spotsPerPage;
    const end = start + spotsPerPage;
    const paginated = filteredSpots.slice(start, end);
    console.log('Pagination:', {
      currentPage,
      totalSpots: filteredSpots.length,
      start,
      end,
      paginatedCount: paginated.length
    });
    return paginated;
  }, [filteredSpots, currentPage]);

  // Debug final results
  useEffect(() => {
    console.log('Filtered results:', {
      filteredSpotsLength: filteredSpots.length,
      paginatedSpotsLength: paginatedSpots.length,
      currentPage
    });
  }, [filteredSpots, paginatedSpots, currentPage]);

  // Debug log when attendance data changes
  useEffect(() => {
    console.log('SpotList received updated attendances:', spotAttendances);
  }, [spotAttendances]);

  return (
    <div className="p-4">
      <div className="mb-4 space-y-2">
        <input
          type="text"
          placeholder="Search spots..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border rounded"
        />
        
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="all">All Types</option>
            <option value="skatepark">🛹 Skatepark</option>
            <option value="rail">➖ Rail</option>
            <option value="stairs">🪜 Stairs</option>
            <option value="ledge">🔲 Ledge</option>
            <option value="flatbar">➖ Flatbar</option>
          </select>

          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="p-2 border rounded"
            disabled={isLoadingAddresses}
          >
            <option value="all">
              {isLoadingAddresses ? 'Loading cities...' : 'All Cities'}
            </option>
            {!isLoadingAddresses && cities.map(city => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <select
            value={filterAttendance}
            onChange={(e) => setFilterAttendance(e.target.value)}
            className="p-2 border rounded"
          >
            {attendanceFilters.map(filter => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          {userLocation && (
            <select
              value={filterDistance}
              onChange={(e) => setFilterDistance(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="all">Any Distance</option>
              <option value="500">Within 500m</option>
              <option value="1000">Within 1km</option>
              <option value="5000">Within 5km</option>
              <option value="10000">Within 10km</option>
            </select>
          )}
        </div>
      </div>

      {isLoadingAddresses && (
        <div className="text-center py-4 text-gray-600">
          Loading addresses...
        </div>
      )}

      <div className="space-y-2">
        {paginatedSpots.map((spot) => {
          const attendanceInfo = getSpotAttendanceInfo(spot.id);
          const hasAttendees = attendanceInfo.total > 0;
          const address = spotAddresses[spot.id];

          return (
            <div
              key={spot.id}
              onClick={() => onSpotClick(spot)}
              className={`p-4 rounded-lg cursor-pointer transition-all ${
                hasAttendees ? 'bg-blue-50 hover:bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{spot.title}</h3>
                  <p className="text-sm text-gray-600">Type: {spot.type}</p>
                  <p className="text-sm text-gray-600">
                    📍 {isLoadingAddresses ? 'Loading...' : (address?.city || 'Unknown')}
                  </p>
                  {userLocation && (
                    <p className="text-sm text-gray-500">
                      {(getDistance(userLocation.lat, userLocation.lng, spot.latitude, spot.longitude) / 1000).toFixed(1)}km away
                    </p>
                  )}
                </div>
                {hasAttendees && (
                  <div className="text-right text-sm">
                    {attendanceInfo.active > 0 && (
                      <div className="text-green-600">
                        {attendanceInfo.active} active now
                      </div>
                    )}
                    {attendanceInfo.scheduled > 0 && (
                      <div className="text-blue-600">
                        {attendanceInfo.scheduled} scheduled
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-4">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="bg-blue-500 text-white py-1 px-3 rounded disabled:bg-gray-300"
        >
          Previous
        </button>
        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="bg-blue-500 text-white py-1 px-3 rounded disabled:bg-gray-300"
        >
          Next
        </button>
      </div>
    </div>
  );
}

