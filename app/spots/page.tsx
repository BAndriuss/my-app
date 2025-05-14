'use client'

import Navbar from '../components/Navbar'
import MyMap from '../components/Map'
import SpotList from '../components/Spotlist';
export default function SpotsPage() {
  return (
    <>
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-6">Explore Skate Spots</h1>

        {/* REMOVE hard height and overflow here! */}
        <div className="w-full rounded-lg shadow-lg">
          <MyMap />
        </div>

        asdas
      </div>
    </>
  )
}
