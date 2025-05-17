'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface SpotAttendanceProps {
  spotId: string
}

interface Attendee {
  id: string
  duration_minutes: number
  start_time: string
  profiles: {
    username: string
  }
}

interface RawAttendee {
  id: string
  duration_minutes: number
  start_time: string
  profiles: {
    username: string
  }
}

export default function SpotAttendance({ spotId }: SpotAttendanceProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState<{[key: string]: string}>({})

  const fetchAttendees = async () => {
    console.log('Fetching attendees for spot:', spotId)
    setIsLoading(true)
    
    const { data: rawData, error } = await supabase
      .from('spot_attendances')
      .select(`
        *,
        profiles:user_id (
          username
        )
      `)
      .eq('spot_id', spotId)
      .order('start_time', { ascending: false })

    if (error) {
      console.error('Error fetching attendees:', error)
      setIsLoading(false)
      return
    }

    if (rawData) {
      console.log('Found attendees:', rawData)
      const now = new Date()
      const activeAttendees = rawData.filter((item: any) => {
        const startTime = new Date(item.start_time)
        const durationInMs = (item.duration_minutes < 1 ? 0.5 : item.duration_minutes) * 60 * 1000
        const endTime = new Date(startTime.getTime() + durationInMs)
        return endTime > now
      })

      const transformedData: Attendee[] = activeAttendees.map((item: any) => ({
        id: item.id,
        duration_minutes: item.duration_minutes,
        start_time: item.start_time,
        profiles: {
          username: item.profiles?.username || 'Unknown User'
        }
      }))
      
      console.log('Active attendees:', transformedData)
      setAttendees(transformedData)
    } else {
      setAttendees([])
    }
    setIsLoading(false)
  }

  // Update countdown timer every second and check for expired attendances
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const newTimeLeft: {[key: string]: string} = {}
      let needsRefresh = false

      attendees.forEach((attendee) => {
        const startTime = new Date(attendee.start_time)
        const durationInMs = (attendee.duration_minutes < 1 ? 0.5 : attendee.duration_minutes) * 60 * 1000
        const endTime = new Date(startTime.getTime() + durationInMs)
        const msLeft = endTime.getTime() - now.getTime()

        if (msLeft <= 0) {
          needsRefresh = true
          return
        }

        // Convert remaining time to minutes and seconds
        const minutesLeft = Math.floor(msLeft / 60000)
        const secondsLeft = Math.floor((msLeft % 60000) / 1000)
        newTimeLeft[attendee.id] = minutesLeft > 0 
          ? `${minutesLeft}m ${secondsLeft}s left`
          : `${secondsLeft}s left`
      })

      if (needsRefresh) {
        fetchAttendees()
      } else {
        setTimeLeft(newTimeLeft)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [attendees, spotId])

  useEffect(() => {
    fetchAttendees()

    // Set up real-time subscription for attendance changes
    const channel = supabase
      .channel(`spot-attendance-${spotId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spot_attendances',
          filter: `spot_id=eq.${spotId}`
        },
        (payload) => {
          console.log('Received real-time update:', payload)
          // Always fetch fresh data to ensure consistency
          fetchAttendees()
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up subscription')
      supabase.removeChannel(channel)
    }
  }, [spotId])

  const formatDuration = (minutes: number) => {
    if (minutes === 0.5) return '30 seconds'
    if (minutes < 60) return `${minutes} minutes`
    const hours = Math.floor(minutes / 60)
    return `${hours} hour${hours > 1 ? 's' : ''}`
  }

  const formatTime = (time: string) => {
    const date = new Date(time)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    let prefix = ''
    if (date.toDateString() === now.toDateString()) {
      prefix = 'Today '
    } else if (date.toDateString() === tomorrow.toDateString()) {
      prefix = 'Tomorrow '
    }

    return prefix + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getAttendanceStatus = (startTime: string, durationMinutes: number) => {
    const start = new Date(startTime)
    const now = new Date()
    const durationInMs = (durationMinutes < 1 ? 0.5 : durationMinutes) * 60 * 1000
    const end = new Date(start.getTime() + durationInMs)

    if (now < start) {
      return 'scheduled'
    } else if (now >= start && now <= end) {
      return 'active'
    } else {
      return 'expired'
    }
  }

  if (isLoading) {
    return <div className="text-gray-500">Loading attendees...</div>
  }

  if (attendees.length === 0) {
    return <div className="text-gray-500">No one is attending yet</div>
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-lg mb-2">
        {attendees.length} {attendees.length === 1 ? 'person' : 'people'} attending/scheduled
      </h3>
      <div className="space-y-2">
        {attendees.map((attendee) => {
          const startTime = new Date(attendee.start_time)
          const durationInMs = (attendee.duration_minutes < 1 ? 0.5 : attendee.duration_minutes) * 60 * 1000
          const endTime = new Date(startTime.getTime() + durationInMs)
          const status = getAttendanceStatus(attendee.start_time, attendee.duration_minutes)
          
          return (
            <div
              key={attendee.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                status === 'active' ? 'bg-green-50 border border-green-200' :
                status === 'scheduled' ? 'bg-blue-50 border border-blue-200' :
                'bg-gray-50'
              }`}
            >
              <div>
                <div className="font-medium">{attendee.profiles.username}</div>
                <div className="text-sm text-gray-500">
                  Duration: {formatDuration(attendee.duration_minutes)}
                </div>
                <div className={`text-sm font-medium ${
                  status === 'active' ? 'text-green-600' :
                  status === 'scheduled' ? 'text-blue-600' :
                  'text-gray-500'
                }`}>
                  {status === 'active' && timeLeft[attendee.id] ? (
                    timeLeft[attendee.id]
                  ) : status === 'scheduled' ? (
                    'Scheduled'
                  ) : (
                    'Expired'
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-500 text-right">
                <div>{formatTime(startTime.toISOString())}</div>
                <div>to</div>
                <div>{formatTime(endTime.toISOString())}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
} 