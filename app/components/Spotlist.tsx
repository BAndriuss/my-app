'use client'
import { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo } from 'react';
import { useState } from 'react';
import SpotCard from './SpotCard';
import { supabase } from '../../lib/supabaseClient';

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

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id || null);
    };
    fetchUser();
  }, []);

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
    const spotsPerPage = 6;
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
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search spots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="p-2 border rounded font-bebas"
          />
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="p-2 border rounded font-bebas"
          >
            <option value="all">All Types</option>
            <option value="rail">Rail</option>
            <option value="stairs">Stairs</option>
            <option value="park">Park</option>
            <option value="box">Box</option>
          </select>

          <select
            value={filterDistance}
            onChange={(e) => setFilterDistance(e.target.value)}
            className="p-2 border rounded font-bebas"
            disabled={!userLocation}
          >
            <option value="all">Any Distance</option>
            <option value="1000">Within 1km</option>
            <option value="5000">Within 5km</option>
            <option value="10000">Within 10km</option>
          </select>

          <select
            value={filterAttendance}
            onChange={(e) => setFilterAttendance(e.target.value)}
            className="p-2 border rounded font-bebas"
          >
            {attendanceFilters.map(filter => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoadingAddresses && (
        <div className="text-center py-4 text-gray-600">
          Loading addresses...
        </div>
      )}

      <div className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedSpots.map((spot) => (
            <SpotCard
              key={spot.id}
              spot={spot}
              currentUserId={currentUserId}
              onDelete={() => {
                // Refresh the spots list after deletion
                window.location.reload();
              }}
              onClick={() => onSpotClick(spot)}
              attendanceInfo={getSpotAttendanceInfo(spot.id)}
              userLocation={userLocation}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-2">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="btn-secondary"
        >
          Previous
        </button>
        <span className="px-4 py-2 font-cornerstone">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="btn-secondary"
        >
          Next
        </button>
      </div>
    </div>
  );
}

