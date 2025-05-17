'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface AttendButtonProps {
  spotId: string
  userId: string | null
  onAttendanceChange?: () => void
}

export default function AttendButton({ spotId, userId, onAttendanceChange }: AttendButtonProps) {
  const [isAttending, setIsAttending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showDurationSelect, setShowDurationSelect] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState<number>(60)
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [expirationTimer, setExpirationTimer] = useState<NodeJS.Timeout | null>(null)
  const [showTimeSelect, setShowTimeSelect] = useState(false)
  const [showInitialChoice, setShowInitialChoice] = useState(false)

  const durations = [
    { value: 0.5, label: '30 seconds' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 180, label: '3 hours' },
    { value: 240, label: '4 hours' },
  ]

  // Generate time slots for the next 24 hours
  const getTimeSlots = () => {
    const slots = []
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    
    // Start from current time, rounded to next 30 minutes
    let startMinute = currentMinute >= 30 ? 0 : 30
    let startHour = currentMinute >= 30 ? (currentHour + 1) % 24 : currentHour

    // Generate slots for the next 24 hours
    for (let i = 0; i < 48; i++) {
      const hour = (startHour + Math.floor((startMinute + i * 30) / 60)) % 24
      const minute = (startMinute + i * 30) % 60
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      
      // Calculate the full date for this time slot
      const slotDate = new Date()
      slotDate.setHours(hour, minute, 0, 0)
      if (slotDate < now) {
        slotDate.setDate(slotDate.getDate() + 1) // Move to tomorrow if time has passed
      }

      slots.push({
        label: timeString,
        value: slotDate.toISOString()
      })
    }
    return slots
  }

  const checkIfAttending = async () => {
    if (!userId || !spotId) {
      setIsAttending(false)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data, error } = await supabase
      .from('spot_attendances')
      .select('id, duration_minutes, start_time')
      .eq('user_id', userId)
      .eq('spot_id', spotId)
      .single()

    if (error) {
      console.error('Error checking attendance:', error)
      setIsAttending(false)
      setIsLoading(false)
      return
    }

    if (data) {
      const startTime = new Date(data.start_time)
      const durationInMs = (data.duration_minutes < 1 ? 0.5 : data.duration_minutes) * 60 * 1000
      const endTime = new Date(startTime.getTime() + durationInMs)
      const now = new Date()

      setSelectedTime(startTime.toISOString())

      if (endTime > now) {
        setIsAttending(true)
        setSelectedDuration(data.duration_minutes)
        
        // Set up expiration timer
        const timeLeft = endTime.getTime() - now.getTime()
        const timer = setTimeout(() => {
          setIsAttending(false)
          if (onAttendanceChange) {
            onAttendanceChange()
          }
        }, timeLeft)
        setExpirationTimer(timer)
      } else {
        // Attendance has expired, remove it
        await supabase
          .from('spot_attendances')
          .delete()
          .eq('user_id', userId)
          .eq('spot_id', spotId)
        setIsAttending(false)
      }
    } else {
      setIsAttending(false)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    setIsAttending(false)
    setShowDurationSelect(false)
    setShowTimeSelect(false)
    setSelectedDuration(60)
    setSelectedTime('')
    if (expirationTimer) {
      clearTimeout(expirationTimer)
      setExpirationTimer(null)
    }
    checkIfAttending()

    const channel = supabase
      .channel(`spot-attendance-${spotId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spot_attendances',
          filter: `spot_id=eq.${spotId} AND user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Received attendance update:', payload)
          checkIfAttending()
        }
      )
      .subscribe()

    return () => {
      if (expirationTimer) {
        clearTimeout(expirationTimer)
      }
      supabase.removeChannel(channel)
    }
  }, [spotId, userId])

  const resetStates = () => {
    setShowInitialChoice(false)
    setShowTimeSelect(false)
    setShowDurationSelect(false)
    setSelectedTime('')
  }

  const handleImmediateAttend = () => {
    setSelectedTime(new Date().toISOString())
    setShowInitialChoice(false)
    setShowDurationSelect(true)
  }

  const handleScheduledAttend = () => {
    setShowInitialChoice(false)
    setShowTimeSelect(true)
  }

  const handleAttend = async (duration?: number) => {
    if (!userId) {
      alert('Please sign in to mark attendance')
      return
    }

    if (!isAttending && !duration) {
      setShowInitialChoice(true)
      return
    }

    setIsLoading(true)
    if (expirationTimer) {
      clearTimeout(expirationTimer)
      setExpirationTimer(null)
    }

    try {
      if (isAttending) {
        const { error } = await supabase
          .from('spot_attendances')
          .delete()
          .eq('user_id', userId)
          .eq('spot_id', spotId)

        if (error) {
          console.error('Error removing attendance:', error)
          throw error
        }

        setIsAttending(false)
        resetStates()
      } else if (duration && selectedTime) {
        const startTime = new Date(selectedTime)
        const { error } = await supabase
          .from('spot_attendances')
          .insert([
            {
              user_id: userId,
              spot_id: spotId,
              duration_minutes: duration,
              start_time: startTime.toISOString()
            }
          ])

        if (error) {
          console.error('Error adding attendance:', error)
          throw error
        }

        setIsAttending(true)
        setSelectedDuration(duration)
        resetStates()

        // Set up expiration timer if the start time is now
        const now = new Date()
        if (startTime <= now) {
          const durationInMs = (duration < 1 ? 0.5 : duration) * 60 * 1000
          const timer = setTimeout(() => {
            setIsAttending(false)
            if (onAttendanceChange) {
              onAttendanceChange()
            }
          }, durationInMs)
          setExpirationTimer(timer)
        }
      }

      if (onAttendanceChange) {
        onAttendanceChange()
      }
    } catch (error) {
      console.error('Error handling attendance:', error)
      alert('Failed to update attendance. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <button disabled className="w-full bg-gray-300 text-gray-600 py-2 px-4 rounded">
        Loading...
      </button>
    )
  }

  if (showInitialChoice && !isAttending) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium mb-2">Are you already there?</div>
        <button
          onClick={handleImmediateAttend}
          className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded text-sm mb-2"
        >
          Yes, I'm here now
        </button>
        <button
          onClick={handleScheduledAttend}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded text-sm"
        >
          No, schedule for later
        </button>
        <button
          onClick={resetStates}
          className="w-full mt-2 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded text-sm"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (showTimeSelect && !isAttending) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium mb-2">When are you planning to come?</div>
        <div className="max-h-48 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {getTimeSlots().map(({ label, value }) => (
              <button
                key={value}
                onClick={() => {
                  setSelectedTime(value)
                  setShowTimeSelect(false)
                  setShowDurationSelect(true)
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded text-sm"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={resetStates}
          className="w-full mt-2 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded text-sm"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (showDurationSelect && !isAttending) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium mb-2">How long will you stay?</div>
        <div className="grid grid-cols-2 gap-2">
          {durations.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleAttend(value)}
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded text-sm"
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={resetStates}
          className="w-full mt-2 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded text-sm"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => handleAttend()}
      className={`
        w-full py-2 px-4 rounded font-medium
        ${isAttending
          ? 'bg-green-500 hover:bg-green-600 text-white'
          : 'bg-blue-500 hover:bg-blue-600 text-white'
        }
      `}
    >
      {isAttending ? '✓ Attending' : 'Attend'}
    </button>
  )
} 