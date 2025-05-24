'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import Navbar from '../../components/Navbar';
import TournamentSubmissionForm from '../../components/TournamentSubmissionForm';
import MediaDisplay from '../../components/MediaDisplay';
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

interface TournamentSubmission {
  id: string;
  user_id: string;
  tournament_id: string;
  media_url: string;
  description: string;
  created_at: string;
  likes_count: number;
  status: 'pending' | 'approved' | 'rejected';
  admin_feedback?: string;
  points_awarded: boolean;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface VideoModalProps {
  submission: TournamentSubmission;
  onClose: () => void;
  userLikes: Record<string, boolean>;
  tournament: Tournament;
}

// Add type for skater points record
interface SkaterPoints {
  user_id: string;
  points: number;
  current_streak: number;
  month: number;
  year: number;
  last_trick_date: string | null;
}

// Add after the other interfaces
interface SkaterPointsWithProfile {
  user_id: string;
  points: number;
  profiles: {
    username: string;
    avatar_url: string | null;
  } | null;
}

interface RealtimePostgresChangesPayload<T> {
  commit_timestamp: string;
  errors: null | any[];
  schema: string;
  table: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  old: Partial<T>;
  new: T;
}

// Add new interface for leaderboard data
interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  points: number;
}

// Update the interface
interface DatabaseSkaterPoints {
  user_id: string;
  points: number;
}

function VideoModal({ submission, onClose, userLikes, tournament }: VideoModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-[800px] flex flex-col">
        <div className="p-2 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image 
              src="/profile.png"
              alt={submission.profiles.username}
              width={32}
              height={32}
              className="rounded-full"
            />
            <span className="font-cornerstone">{submission.profiles.username}</span>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="relative bg-black">
          <div className="w-full h-full flex items-center justify-center">
            <MediaDisplay 
              url={submission.media_url} 
              className="w-full h-auto max-h-[70vh] object-contain" 
            />
          </div>
        </div>
        <div className="p-2 border-t">
          <p className="description-text mb-2">{submission.description}</p>
          {tournament.tournament_types.frequency !== 'daily' && (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="flex items-center gap-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill={userLikes[submission.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className={userLikes[submission.id] ? "text-red-500" : "text-gray-500"}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span>{submission.likes_count}</span>
              </div>
              <span>•</span>
              <span>{new Date(submission.created_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [submissions, setSubmissions] = useState<TournamentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<TournamentSubmission | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({});
  const [currentStreak, setCurrentStreak] = useState(1);
  const [monthlyPoints, setMonthlyPoints] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const fetchTournamentAndSubmissions = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        // Get current month and year
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
        const currentYear = currentDate.getFullYear();

        // Fetch user streak and monthly points
        const { data: pointsData, error: pointsError } = await supabase
          .from('skater_points')
          .select('points, current_streak')
          .eq('user_id', user.id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .single();

        if (pointsError && pointsError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('Error fetching points:', pointsError);
        }

        // If no points record exists yet, use defaults
        setCurrentStreak(pointsData?.current_streak || 1);
        setMonthlyPoints(pointsData?.points || 0);

        // Fetch user likes
        const { data: likesData } = await supabase
          .from('submission_likes')
          .select('submission_id')
          .eq('user_id', user.id);
        
        if (likesData) {
          const likes: Record<string, boolean> = {};
          likesData.forEach(like => {
            likes[like.submission_id] = true;
          });
          setUserLikes(likes);
        }
      }

      // Fetch tournament details with type and trick information
      const { data: tournamentData, error: tournamentError } = await supabase
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
        .eq('id', params.id)
        .single();

      if (tournamentError) throw tournamentError;
      if (!tournamentData) {
        router.push('/tournaments');
        return;
      }

      setTournament(tournamentData);

      // Fetch submissions with user profiles - removed avatar_url from selection
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('tournament_submissions')
        .select(`
          *,
          profiles:user_id (
            username
          )
        `)
        .eq('tournament_id', params.id)
        .order('likes_count', { ascending: false });

      if (submissionsError) throw submissionsError;
      setSubmissions(submissionsData);

      // If it's a monthly tournament, fetch the leaderboard
      if (tournamentData.tournament_types.frequency === 'monthly') {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const { data: leaderboardData, error: leaderboardError } = await supabase
          .from('skater_points')
          .select('user_id, points')
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .order('points', { ascending: false })
          .limit(10);

        if (leaderboardError) throw leaderboardError;

        if (leaderboardData) {
          console.log('Leaderboard data:', leaderboardData);
          
          // Get usernames for all user_ids
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', leaderboardData.map(entry => entry.user_id));

          console.log('Profiles data:', profilesData);
          console.log('Profiles error:', profilesError);

          if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
          }

          // Create a map of user_id to username
          const usernameMap = new Map(
            profilesData?.map(profile => [profile.id, profile.username]) || []
          );

          console.log('Username map:', Object.fromEntries(usernameMap));

          const formattedLeaderboard: LeaderboardEntry[] = leaderboardData.map(entry => {
            const username = usernameMap.get(entry.user_id);
            console.log('Mapping user_id:', entry.user_id, 'to username:', username);
            return {
              user_id: entry.user_id,
              username: username || 'Unknown User',
              avatar_url: null,
              points: entry.points || 0
            };
          });
          setLeaderboard(formattedLeaderboard);
        }
      }

    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load tournament details.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add real-time subscription for points updates
  useEffect(() => {
    if (!userId) return;

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // First, fetch initial data
    const fetchPoints = async () => {
      const { data: pointsData, error: pointsError } = await supabase
        .from('skater_points')
        .select('points, current_streak')
        .eq('user_id', userId)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .single();

      if (pointsError && pointsError.code !== 'PGRST116') {
        console.error('Error fetching points:', pointsError);
      }

      setCurrentStreak(pointsData?.current_streak || 1);
      setMonthlyPoints(pointsData?.points || 0);
    };

    fetchPoints();

    // Then set up real-time subscription
    const channel = supabase.channel('points_changes');
    
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'skater_points',
          filter: `user_id=eq.${userId} AND month=eq.${currentMonth} AND year=eq.${currentYear}`
        },
        (payload) => {
          const newPoints = payload.new as SkaterPoints;
          if (newPoints) {
            setCurrentStreak(newPoints.current_streak);
            setMonthlyPoints(newPoints.points);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    fetchTournamentAndSubmissions();
  }, [params.id]);

  const handleLike = async (submissionId: string) => {
    if (!userId) return;

    try {
      if (userLikes[submissionId]) {
        // Unlike
        await supabase
          .from('submission_likes')
          .delete()
          .eq('user_id', userId)
          .eq('submission_id', submissionId);
        
        setUserLikes(prev => ({ ...prev, [submissionId]: false }));
      } else {
        // Like
        await supabase
          .from('submission_likes')
          .insert([{ user_id: userId, submission_id: submissionId }]);
        
        setUserLikes(prev => ({ ...prev, [submissionId]: true }));
      }

      // Refresh submissions to update likes count
      fetchTournamentAndSubmissions();
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-200 text-green-800';
      case 'upcoming':
        return 'bg-yellow-200 text-yellow-800';
      case 'ended':
        return 'bg-gray-200 text-gray-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  const getSubmissionStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">PENDING</span>;
      case 'approved':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">APPROVED</span>;
      case 'rejected':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">REJECTED</span>;
      default:
        return null;
    }
  };

  const renderGridView = () => {
    if (!tournament) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {submissions.map((submission) => (
          <div key={submission.id} className="bg-white/90 backdrop-blur-sm rounded-lg overflow-hidden shadow-sm">
            <div 
              className="aspect-video relative cursor-pointer"
              onClick={() => setSelectedSubmission(submission)}
            >
              <MediaDisplay url={submission.media_url} className="absolute inset-0 object-cover" />
              {tournament.tournament_types.frequency === 'daily' && (
                <div className="absolute top-2 right-2">
                  {getSubmissionStatusBadge(submission.status)}
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Image 
                    src="/profile.png"
                    alt={submission.profiles.username}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                  <span className="font-cornerstone text-sm">
                    {submission.profiles.username}
                  </span>
                </div>
                {tournament.tournament_types.frequency !== 'daily' && userId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(submission.id);
                    }}
                    className={`flex items-center gap-1 ${userLikes[submission.id] ? 'text-red-500' : 'text-gray-500'} hover:text-red-500 transition-colors`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={userLikes[submission.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span>{submission.likes_count}</span>
                  </button>
                )}
              </div>
              <p className="description-text text-sm mb-2">{submission.description}</p>
              <div className="flex items-center justify-between">
                <span className="description-text text-sm text-gray-500">
                  {new Date(submission.created_at).toLocaleDateString()}
                </span>
                {tournament.tournament_types.frequency === 'daily' && submission.status === 'approved' && (
                  <span className="text-sm text-green-600 font-semibold">
                    +{calculateApprovedPoints(submission)} points
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderListView = () => {
    if (!tournament) return null;
    
    return (
      <div className="space-y-4">
        {submissions.map((submission) => (
          <div key={submission.id} className="bg-white/90 backdrop-blur-sm rounded-lg overflow-hidden shadow-sm">
            <div className="flex items-start gap-4 p-4">
              <div className="flex-shrink-0">
                <Image 
                  src="/profile.png"
                  alt={submission.profiles.username}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              </div>
              <div className="flex-grow">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-cornerstone">
                      {submission.profiles.username}
                    </span>
                    {tournament.tournament_types.frequency === 'daily' && (
                      getSubmissionStatusBadge(submission.status)
                    )}
                  </div>
                  {tournament.tournament_types.frequency !== 'daily' && userId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(submission.id);
                      }}
                      className={`flex items-center gap-1 ${userLikes[submission.id] ? 'text-red-500' : 'text-gray-500'} hover:text-red-500 transition-colors`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={userLikes[submission.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      <span>{submission.likes_count}</span>
                    </button>
                  )}
                </div>
                <p className="description-text mb-2">{submission.description}</p>
                {tournament.tournament_types.frequency === 'daily' && submission.status === 'rejected' && submission.admin_feedback && (
                  <p className="text-sm text-red-600 mb-2">Feedback: {submission.admin_feedback}</p>
                )}
                <div 
                  className="aspect-video relative rounded-lg overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSubmission(submission);
                  }}
                >
                  <MediaDisplay url={submission.media_url} className="absolute inset-0 object-cover" />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="description-text text-sm text-gray-500">
                    {new Date(submission.created_at).toLocaleDateString()}
                  </span>
                  {tournament.tournament_types.frequency === 'daily' && submission.status === 'approved' && (
                    <span className="text-sm text-green-600 font-semibold">
                      +{calculateApprovedPoints(submission)} points
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Add helper function to calculate points
  const calculateApprovedPoints = (submission: TournamentSubmission) => {
    if (!tournament || !tournament.tricks) return 0;
    
    // For daily tournaments, get the streak at the time of approval
    if (tournament.tournament_types.frequency === 'daily') {
      // If submission was approved today, use current streak
      if (new Date(submission.created_at).toDateString() === new Date().toDateString()) {
        return tournament.tricks.points * tournament.tournament_types.points_multiplier * currentStreak;
      }
      // For older submissions, use base points (we don't store historical streak info)
      return tournament.tricks.points * tournament.tournament_types.points_multiplier;
    }
    
    // For non-daily tournaments, just use base points
    return tournament.tricks.points * tournament.tournament_types.points_multiplier;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-pattern-1">
        <Navbar />
        <main className="main-content">
          <div className="flex justify-center py-10">Loading tournament details...</div>
        </main>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-pattern-1">
        <Navbar />
        <main className="main-content">
          <div className="flex justify-center py-10 text-red-500">{error || 'Tournament not found'}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pattern-1">
      <Navbar />
      <main className="main-content">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Tournament Details Section */}
          {tournament.tournament_types.frequency === 'daily' ? (
            <div className="content-overlay p-8 mb-8">
              <div className="flex justify-between items-start mb-8">
                <div className="flex-1">
                  <h1 className="heading-1 mb-2">{tournament.tournament_types.name}</h1>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(tournament.status)}`}>
                      {tournament.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                {tournament.status === 'active' && userId && (
                  <button 
                    className="btn-primary flex-shrink-0"
                    onClick={() => setShowSubmissionForm(true)}
                  >
                    Submit Entry
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="mb-6">
                    <h2 className="font-cornerstone text-2xl mb-2">YOUR STATS</h2>
                    <div className="space-y-2">
                      <p className="font-cornerstone text-3xl text-blue-600">{monthlyPoints} POINTS</p>
                      <div className="flex items-center gap-2">
                        <span className="font-cornerstone text-xl">{currentStreak} DAY STREAK</span>
                        {currentStreak > 1 && (
                          <span className="font-cornerstone bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                            {currentStreak}x MULTIPLIER!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {tournament.tricks && (
                    <div>
                      <h2 className="font-cornerstone text-2xl mb-4">TODAY'S CHALLENGE</h2>
                      <p className="font-cornerstone text-xl mb-3">
                        {tournament.tricks.name} <span className="text-yellow-500">{'★'.repeat(tournament.tricks.difficulty)}</span>
                      </p>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="font-cornerstone text-sm text-blue-800 mb-2">POTENTIAL POINTS</p>
                        <div className="flex items-center gap-2">
                          <span className="font-cornerstone text-2xl text-blue-600">
                            {tournament.tricks.points * tournament.tournament_types.points_multiplier * currentStreak}
                          </span>
                          {currentStreak > 1 && (
                            <span className="font-cornerstone text-sm text-blue-600">
                              ({tournament.tricks.points * tournament.tournament_types.points_multiplier} × {currentStreak} streak)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6">
                  <h2 className="font-cornerstone text-2xl mb-4">HOW IT WORKS</h2>
                  <div className="space-y-3">
                    <div className="bg-white/80 backdrop-blur-sm rounded p-3">
                      <p className="description-text">
                        Complete the daily trick challenge to earn points
                      </p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded p-3">
                      <p className="description-text">
                        Keep your streak alive by completing tricks daily
                      </p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded p-3">
                      <p className="description-text">
                        Each consecutive day multiplies your points
                      </p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded p-3">
                      <p className="description-text">
                        Resets at midnight - don't miss a day!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : tournament.tournament_types.frequency === 'monthly' ? (
            <>
              <div className="content-overlay p-8 mb-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h1 className="heading-1 mb-2">{tournament.tournament_types.name}</h1>
                    <p className="description-text text-lg mb-6">
                      All skaters automatically participate in this monthly contest. The skater who accumulates the most points throughout the month will be crowned the winner!
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-sm">
                    <h3 className="font-cornerstone text-lg mb-2">PRIZE</h3>
                    <div className="space-y-2">
                      <p className="description-text">Monthly Champion Title</p>
                      <p className="description-text text-blue-600">+1000 Bonus Points</p>
                    </div>
                  </div>

                  <div className="bg-blue-50/90 backdrop-blur-sm rounded-lg p-6 shadow-sm">
                    <h3 className="font-cornerstone text-lg mb-2">PARTICIPATION</h3>
                    <p className="description-text">
                      Complete daily challenges and weekly tournaments to earn points
                    </p>
                  </div>

                  <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-sm">
                    <h3 className="font-cornerstone text-lg mb-2">TIMELINE</h3>
                    <p className="description-text">
                      Starts: {new Date(tournament.start_date).toLocaleDateString()}<br />
                      Ends: {new Date(tournament.end_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="content-overlay p-8">
                <h2 className="heading-2 mb-6">TOP 10 LEADERBOARD</h2>
                <div className="bg-white/90 backdrop-blur-sm rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 font-cornerstone text-sm">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-7">SKATER</div>
                    <div className="col-span-4 text-right">POINTS</div>
                  </div>
                  {leaderboard.map((entry, index) => (
                    <div 
                      key={entry.user_id} 
                      className={`grid grid-cols-12 gap-4 p-4 border-b last:border-0 items-center hover:bg-gray-50 ${entry.user_id === userId ? 'bg-blue-50' : ''}`}
                    >
                      <div className="col-span-1 text-center font-cornerstone">
                        {index + 1}
                      </div>
                      <div className="col-span-7 flex items-center gap-3">
                        <Image
                          src="/profile.png"
                          alt={entry.username}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                        <span className="font-cornerstone">{entry.username}</span>
                      </div>
                      <div className="col-span-4 text-right font-cornerstone text-blue-600">
                        {entry.points} PTS
                      </div>
                    </div>
                  ))}
                  {leaderboard.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      No points recorded yet this month.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="content-overlay p-8 mb-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="heading-1 mb-2">{tournament.tournament_types.name}</h1>
                  <div className="flex items-center gap-4 mb-4">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(tournament.status)}`}>
                      {tournament.status.toUpperCase()}
                    </span>
                    <span className="font-cornerstone text-gray-600">
                      {tournament.tournament_types.frequency.toUpperCase()}
                    </span>
                  </div>
                </div>
                {tournament.status === 'active' && userId && (
                  <button 
                    className="btn-primary"
                    onClick={() => setShowSubmissionForm(true)}
                  >
                    Submit Entry
                  </button>
                )}
              </div>

              {tournament.description && (
                <p className="description-text mb-6">{tournament.description}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-sm">
                  <h3 className="font-cornerstone text-lg mb-2">CATEGORY</h3>
                  <p className="description-text">{tournament.tournament_types.category}</p>
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-cornerstone text-sm text-blue-800 mb-1">PRIZE</h4>
                    <p className="description-text text-blue-600">+200 Points for Winner</p>
                  </div>
                </div>

                {tournament.tricks && (
                  <div className="bg-blue-50/90 backdrop-blur-sm rounded-lg p-6 shadow-sm">
                    <h3 className="font-cornerstone text-lg mb-2">CHALLENGE</h3>
                    <p className="description-text mb-2">
                      {tournament.tricks.name} ({tournament.tricks.difficulty}★)
                    </p>
                    {tournament.tournament_types.frequency === 'daily' ? (
                      <>
                        <p className="description-text text-sm text-blue-600">
                          Base Points: {tournament.tricks.points} × {tournament.tournament_types.points_multiplier}x multiplier
                        </p>
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <p className="font-cornerstone text-sm text-blue-800">YOUR STREAK: {currentStreak} DAYS</p>
                          <p className="description-text text-sm text-blue-600">
                            Potential Points: {tournament.tricks.points * tournament.tournament_types.points_multiplier * currentStreak}
                            {currentStreak > 1 && ` (${currentStreak}x streak bonus!)`}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="description-text text-sm text-blue-600">
                        Base Points: {tournament.tricks.points} × {tournament.tournament_types.points_multiplier}x multiplier
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-sm">
                  <h3 className="font-cornerstone text-lg mb-2">TIMELINE</h3>
                  <p className="description-text">
                    Starts: {new Date(tournament.start_date).toLocaleDateString()}<br />
                    Ends: {new Date(tournament.end_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submissions Section - Only show for non-monthly tournaments */}
          {tournament.tournament_types.frequency !== 'monthly' && (
            <div className="content-overlay p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="heading-2">SUBMISSIONS</h2>
                <div className="flex items-center gap-4">
                  <div className="flex rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-4 py-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}
                    >
                      Grid
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-4 py-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}
                    >
                      List
                    </button>
                  </div>
                </div>
              </div>

              {submissions.length === 0 ? (
                <p className="description-text text-center py-8">
                  No submissions yet. Be the first to submit your entry!
                </p>
              ) : viewMode === 'grid' ? (
                renderGridView()
              ) : (
                renderListView()
              )}
            </div>
          )}
        </div>
      </main>

      {showSubmissionForm && tournament.tournament_types.frequency !== 'monthly' && (
        <TournamentSubmissionForm
          tournamentId={tournament.id}
          onClose={() => setShowSubmissionForm(false)}
          onSubmissionComplete={fetchTournamentAndSubmissions}
        />
      )}

      {selectedSubmission && (
        <VideoModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          userLikes={userLikes}
          tournament={tournament}
        />
      )}
    </div>
  );
} 