'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import Image from 'next/image';

interface Tournament {
  id: string;
  title: string;
  description: string | null;
  tournament_type_id: string;
  tournament_types: {
    name: string;
    frequency: string;
    category: string;
    points_multiplier: number;
  };
  trick_id: string | null;
  tricks: {
    name: string;
    difficulty: number;
    category: string;
    points: number;
  } | null;
  start_date: string;
  end_date: string;
  status: string;
  winner_id: string | null;
  is_automated: boolean;
  points: number;
}

export default function TournamentsPage() {
  const [dailyTournament, setDailyTournament] = useState<Tournament | null>(null);
  const [weeklyTournaments, setWeeklyTournaments] = useState<Tournament[]>([]);
  const [monthlyTournament, setMonthlyTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState({
    daily: '',
    weekly: '',
    monthly: ''
  });

  const fetchTournaments = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch tournaments with their type and trick information
      const { data, error: dbError } = await supabase
        .from('tournaments')
        .select(`
          *,
          tournament_types (
            name,
            frequency,
            category,
            points_multiplier
          ),
          tricks (
            name,
            difficulty,
            category,
            points
          )
        `)
        .eq('is_automated', true)
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      if (data) {
        // Get the most recent tournament of each type
        const daily = data.find(t => t.tournament_types.frequency === 'daily');
        const weekly = data.filter(t => t.tournament_types.frequency === 'weekly');
        const monthly = data.find(t => t.tournament_types.frequency === 'monthly');

        setDailyTournament(daily || null);
        setWeeklyTournaments(weekly || []);
        setMonthlyTournament(monthly || null);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load tournaments. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate time until next refresh and handle automatic updates
  const calculateTimeUntilRefresh = () => {
    const now = new Date();
    
    // Daily - refreshes at midnight
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dailyDiff = tomorrow.getTime() - now.getTime();
    
    // Weekly - refreshes Sunday at midnight
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + (7 - now.getDay()));
    nextSunday.setHours(0, 0, 0, 0);
    const weeklyDiff = nextSunday.getTime() - now.getTime();
    
    // Monthly - refreshes on the 1st of each month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthlyDiff = nextMonth.getTime() - now.getTime();
    
    const formatTime = (ms: number) => {
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((ms % (1000 * 60)) / 1000);
      
      if (days > 0) {
        return `${days}d ${hours}h`;
      }
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      }
      return `${seconds}s`;
    };
    
    setTimeUntilRefresh({
      daily: formatTime(dailyDiff),
      weekly: formatTime(weeklyDiff),
      monthly: formatTime(monthlyDiff)
    });

    // Check if any tournaments need to be refreshed
    if (dailyDiff <= 0 || weeklyDiff <= 0 || monthlyDiff <= 0) {
      fetchTournaments();
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    const timer = setInterval(calculateTimeUntilRefresh, 1000); // Update every second instead of minute
    calculateTimeUntilRefresh(); // Initial calculation
    
    return () => clearInterval(timer);
  }, []);

  const getTournamentImage = (tournament: Tournament) => {
    const category = tournament.tournament_types.category;
    if (tournament.tournament_types.frequency === 'weekly') {
      switch (category) {
        case 'grind':
          return '/tournaments/GrindTrickOfWeek.png';
        case 'park':
          return '/tournaments/ParkTrickOfWeek.png';
        case 'flat':
          return '/tournaments/FlatTrickOfWeek.png';
        case 'line':
          return '/tournaments/lineoftheweek.png';
        default:
          return null;
      }
    }
    return null;
  };

  const renderTournamentCard = (tournament: Tournament) => {
    const imageUrl = getTournamentImage(tournament);
    const isDaily = tournament.tournament_types.frequency === 'daily';

    return (
      <div key={tournament.id} className="bg-white/90 backdrop-blur-sm rounded-lg shadow-sm overflow-hidden w-[300px]">
        {imageUrl && (
          <div className="relative w-full" style={{ height: '300px' }}>
            <Image
              src={imageUrl}
              alt={tournament.title}
              fill
              className="object-contain"
              sizes="300px"
            />
          </div>
        )}
        <div className="p-4">
          <h3 className="text-xl font-cornerstone mb-2">{tournament.tournament_types.name}</h3>
          
          {isDaily && tournament.tricks && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="font-cornerstone text-sm text-blue-800 mb-1">CURRENT CHALLENGE</p>
              <p className="description-text">
                {tournament.tricks.name} ({tournament.tricks.difficulty}★)
              </p>
              <p className="description-text text-sm text-blue-600 mt-1">
                Base Points: {tournament.tricks.points} × {tournament.tournament_types.points_multiplier}x multiplier
              </p>
            </div>
          )}

          <div className="space-y-2 mb-4">
            <p className="text-gray-700 text-sm">
              <span className="font-semibold">Ends:</span> {new Date(tournament.end_date).toLocaleDateString()}
            </p>
            {isDaily && tournament.description && (
              <p className="text-gray-600 mt-2 text-sm">{tournament.description}</p>
            )}
          </div>

          <Link 
            href={`/tournaments/${tournament.id}`}
            className="btn-primary w-full text-center text-sm py-2"
          >
            View Details
          </Link>
        </div>
      </div>
    );
  };

  const renderPlaceholderCard = (type: 'daily' | 'weekly-grind' | 'weekly-park' | 'weekly-flat' | 'weekly-line' | 'monthly') => {
    const titles = {
      daily: 'Trick of the Day',
      'weekly-grind': 'Grind of the Week',
      'weekly-park': 'Park Line of the Week',
      'weekly-flat': 'Flat Trick of the Week',
      'weekly-line': 'Line of the Week',
      monthly: 'Skater of the Month'
    };

    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-sm overflow-hidden w-[300px]">
        <div className="relative w-full" style={{ height: '300px' }}>
          <div className="animate-pulse h-full w-full bg-gray-200"></div>
        </div>
        <div className="p-4">
          <h3 className="text-xl font-cornerstone mb-2">{titles[type]}</h3>
          <div className="space-y-2 mb-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
          <div className="animate-pulse">
            <div className="h-8 bg-blue-200 rounded w-full"></div>
          </div>
        </div>
      </div>
    );
  };

  const renderDailySection = () => (
    <section className="mb-12">
      <div className="flex justify-between items-center mb-6">
        <h2 className="heading-2">Daily Flat Trick Challenge</h2>
        <div className="flex items-center gap-2">
          <span className="font-cornerstone text-sm text-gray-600">Refreshes in:</span>
          <span className="px-3 py-1 bg-gray-100 rounded-full font-mono text-sm">
            {timeUntilRefresh.daily}
          </span>
        </div>
      </div>
      {dailyTournament ? renderTournamentCard(dailyTournament) : renderPlaceholderCard('daily')}
    </section>
  );

  const renderWeeklySection = () => (
    <section className="mb-12">
      <div className="flex justify-between items-center mb-6">
        <h2 className="heading-2">Weekly Challenges</h2>
        <div className="flex items-center gap-2">
          <span className="font-cornerstone text-sm text-gray-600">Refreshes in:</span>
          <span className="px-3 py-1 bg-gray-100 rounded-full font-mono text-sm">
            {timeUntilRefresh.weekly}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center">
        {weeklyTournaments.length > 0 ? (
          weeklyTournaments.map(renderTournamentCard)
        ) : (
          <>
            {renderPlaceholderCard('weekly-grind')}
            {renderPlaceholderCard('weekly-park')}
            {renderPlaceholderCard('weekly-flat')}
            {renderPlaceholderCard('weekly-line')}
          </>
        )}
      </div>
    </section>
  );

  const renderMonthlySection = () => (
    <section>
      <div className="flex justify-between items-center mb-6">
        <h2 className="heading-2">Monthly Skater Contest</h2>
        <div className="flex items-center gap-2">
          <span className="font-cornerstone text-sm text-gray-600">Refreshes in:</span>
          <span className="px-3 py-1 bg-gray-100 rounded-full font-mono text-sm">
            {timeUntilRefresh.monthly}
          </span>
        </div>
      </div>
      {monthlyTournament ? renderTournamentCard(monthlyTournament) : renderPlaceholderCard('monthly')}
    </section>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-pattern-1">
        <Navbar />
        <main className="main-content">
          <div className="flex justify-center py-10">Loading tournaments...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-pattern-1">
        <Navbar />
        <main className="main-content">
          <div className="flex justify-center py-10 text-red-500">{error}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pattern-1">
      <Navbar />
      <main className="main-content">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="content-overlay p-8">
            <h1 className="heading-1 mb-8">TOURNAMENTS</h1>
            {renderDailySection()}
            {renderWeeklySection()}
            {renderMonthlySection()}
          </div>
        </div>
      </main>
    </div>
  );
} 