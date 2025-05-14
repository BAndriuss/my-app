'use client'
import { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';

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
    filterType: string;                     // <<< ADD THIS
    setSearchQuery: Dispatch<SetStateAction<string>>;
    setFilterDistance: Dispatch<SetStateAction<string>>;
    setFilterType: Dispatch<SetStateAction<string>>;   // <<< ADD THIS
    currentPage: number;
    setCurrentPage: Dispatch<SetStateAction<number>>;
    totalPages: number;
    onSpotClick: (spot: Spot) => void;
  }

import { useState, useMemo } from 'react';

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
    filterType, // 👈 here
    setSearchQuery,
    setFilterDistance,
    setFilterType, // 👈 here
    currentPage,
    setCurrentPage,
    totalPages,
    onSpotClick,
  }: SpotListProps) {



  const filteredSpots = spots.filter((spot) => {
    const matchesSearch =
      spot.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spot.type.toLowerCase().includes(searchQuery.toLowerCase());
  
    const matchesType =
      filterType === 'all' || spot.type === filterType;
  
    const matchesDistance =
      filterDistance === 'all' ||
      (userLocation && 
        getDistance(
          userLocation.lat,
          userLocation.lng,
          spot.latitude,
          spot.longitude
        ) <= parseInt(filterDistance)
      );
  
    return matchesSearch && matchesType && matchesDistance;
  });

  const sortedSpots = userLocation
  ? [...filteredSpots].sort((a, b) => {
      const distA = getDistance(
        userLocation.lat,
        userLocation.lng,
        a.latitude,
        a.longitude
      );
      const distB = getDistance(
        userLocation.lat,
        userLocation.lng,
        b.latitude,
        b.longitude
      );
      return distA - distB;
    })
  : filteredSpots;

  const spotsPerPage = 10;
  const paginatedSpots = sortedSpots.slice((currentPage - 1) * spotsPerPage, currentPage * spotsPerPage);

  return (
    <div className="p-4">
      <input
        type="text"
        placeholder="Search by name or type"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setCurrentPage(1); // reset page on search
        }}
        className="w-full p-2 border mb-4 rounded"
      />



<div className="flex gap-4 mb-4">
  {/* Filter by Distance */}
  <select
    value={filterDistance}
    onChange={(e) => {
      setFilterDistance(e.target.value);
      setCurrentPage(1); // Reset page on change
    }}
    className="p-2 border rounded w-full"
  >
    <option value="all">All Distances</option>
    <option value="500">Within 500m</option>
    <option value="1000">Within 1km</option>
    <option value="5000">Within 5km</option>
    <option value="10000">Within 10km</option>
  </select>

  {/* Filter by Type */}
  <select
    value={filterType}
    onChange={(e) => {
      setFilterType(e.target.value);
      setCurrentPage(1);
    }}
    className="p-2 border rounded w-full"
  >
    <option value="all">All Types</option>
    <option value="skatepark">Skatepark</option>
    <option value="rail">Rail</option>
    <option value="ledge">Ledge</option>
    <option value="stairs">Stairs</option>
    <option value="flatbar">Flatbar</option>
  </select>
</div>

      <div className="grid gap-4">
        {paginatedSpots.map((spot) => (
          <div
            key={spot.id}
            onClick={() => onSpotClick(spot)}
            className="border p-3 rounded shadow cursor-pointer hover:bg-gray-100"
          >
            <h3 className="font-bold">{spot.title}</h3>
            <p className="text-gray-600">{spot.type}</p>
            <p className="text-gray-500 text-sm">
            {userLocation && (
            <>
                {Math.round(getDistance(userLocation.lat, userLocation.lng, spot.latitude, spot.longitude))} meters away
            </>
)}
</p>
          </div>
        ))}
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

