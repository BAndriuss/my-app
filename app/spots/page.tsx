'use client'

import Navbar from '../components/Navbar'
import MyMap from '../components/Map'
import SpotList from '../components/Spotlist';
export default function SpotsPage() {
  return (
    <div className="min-h-screen bg-pattern-2">
      <Navbar />
      <main className="main-content">
        <div className="max-w-6xl mx-auto px-4">
          <div className="content-overlay p-8 mb-8">
            <h1 className="heading-1 mb-6">EXPLORE SKATE SPOTS</h1>
            <div className="description-text mb-6">
              Find and share the best skating spots in your area
            </div>
          </div>

          <div className="content-overlay p-4">
            <div className="w-full rounded-lg overflow-hidden">
              <MyMap />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
