'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface Profile {
  username: string | null
  balance: number
  is_admin: boolean
}

interface ProfileChange {
  new: Profile
}

export default function Navbar() {
  const [username, setUsername] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [currentChannel, setCurrentChannel] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

    const fetchProfile = async (userId: string) => {
      console.log('Navbar: Fetching profile for user:', userId);
      let retries = 3;
    
      while (retries > 0) {
        try {
          // First check if the profile exists
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('username, balance, is_admin')
            .eq('id', userId)
            .single();

          if (error) {
            // If error is 'not found', create a new profile
            if (error.code === 'PGRST116') {
              console.log('Navbar: Profile not found, creating new profile');
              const { data: { session } } = await supabase.auth.getSession();
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert([
                  {
                    id: userId,
                    username: null,
                    balance: 0,
                    is_admin: false,
                    email: session?.user?.email
                  }
                ])
                .select()
                .single();

              if (createError) {
                console.error('Navbar: Error creating profile:', createError);
                throw createError;
              }

              if (newProfile) {
                console.log('Navbar: New profile created:', newProfile);
                setUsername(newProfile.username);
                setBalance(newProfile.balance);
                setIsAdmin(newProfile.is_admin);
                return newProfile;
              }
            } else {
              console.error('Navbar: Error fetching profile:', error);
              if (retries > 1) {
                console.log(`Navbar: Retrying... ${retries - 1} attempts left`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries--;
                continue;
              }
              throw error;
            }
          }

          if (!profile) {
            console.log('Navbar: No profile found for user:', userId);
            if (retries > 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              retries--;
              continue;
            }
            return null;
          }

          console.log('Navbar: Profile fetched successfully:', profile);
          setUsername(profile.username);
          setBalance(profile.balance);
          setIsAdmin(profile.is_admin);
          return profile;
        } catch (error) {
          console.error('Navbar: Error in fetchProfile:', error);
          if (retries > 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
            continue;
          }
          return null;
        }
      }
      return null;
    };

    const setupSubscription = async (userId: string) => {
    console.log('Navbar: Setting up subscription for user:', userId);

      // Create a new channel with a unique name
    const channel = supabase
        .channel(`navbar-profile-changes-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`,
          },
          (payload: RealtimePostgresChangesPayload<Profile>) => {
          console.log('Navbar: Received realtime update:', payload);
          const newData = payload.new as Profile;
            if (newData) {
            setUsername(newData.username);
            setBalance(newData.balance);
            setIsAdmin(newData.is_admin);
            }
          }
        )
        .subscribe((status) => {
        console.log('Navbar: Realtime subscription status:', status);
      });

    return channel;
  };

  useEffect(() => {
    let channel: any = null;

    const initializeNavbar = async () => {
      try {
      // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
          console.log('Navbar: User session found:', session.user);
          setIsLoggedIn(true);
          setUserId(session.user.id);
          await fetchProfile(session.user.id);
          channel = await setupSubscription(session.user.id);
          setCurrentChannel(channel);
      } else {
          console.log('Navbar: No user session found');
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error('Navbar: Error initializing:', error);
      }
    };

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Navbar: Auth state changed:', event);
      if (session) {
        setIsLoggedIn(true);
        setUserId(session.user.id);
        await fetchProfile(session.user.id);
        if (channel) {
          channel.unsubscribe();
        }
        channel = await setupSubscription(session.user.id);
        setCurrentChannel(channel);
      } else {
        setIsLoggedIn(false);
        setUsername(null);
        setBalance(null);
        if (channel) {
          channel.unsubscribe();
        }
      }
    });

    initializeNavbar();

    return () => {
      subscription.unsubscribe();
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      // First clear any subscriptions
      if (currentChannel) {
        await currentChannel.unsubscribe();
      }

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        throw error;
      }

      // Clear local state
      setIsLoggedIn(false);
      setUsername(null);
      setBalance(null);
      setUserId(null);
      setCurrentChannel(null);

      // Force reload to clear any cached state
      window.location.href = '/login';
    } catch (err) {
      console.error('Error during logout:', err);
      // Still try to redirect even if there's an error
      window.location.href = '/login';
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="flex items-center h-16">
          {/* Left side - Logo */}
          <div className="flex-none">
            <Link href="/" className="text-2xl font-cornerstone text-gray-800 hover:text-gray-600 transition-colors">
              SKATESPOTS
            </Link>
          </div>

          {/* Middle - Navigation */}
          <div className="flex-1 hidden md:flex items-center justify-center">
            <div className="flex items-center space-x-6">
              <Link href="/dashboard" className="nav-link">
                Dashboard
              </Link>
              <Link href="/spots" className="nav-link">
                Spots
              </Link>
              <Link href="/market" className="nav-link">
                Market
              </Link>
              <Link href="/myaccount/favorites" className="nav-link">
                Favorites
              </Link>
              {isAdmin && (
                <Link href="/admin" className="nav-link text-red-600 hover:text-red-800">
                  Admin
                </Link>
              )}
            </div>
          </div>

          {/* Right side - User Info */}
          <div className="flex-none hidden md:flex items-center space-x-4">
            {isLoggedIn ? (
              <>
                {balance !== null && (
                  <div className="balance-display">
                    ${balance.toFixed(2)}
                  </div>
                )}
                {username && (
                  <Link href="/myaccount" className="username-display hover:text-blue-600 transition-colors">
                    {username}
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="btn-danger"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-primary">
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button className="mobile-menu-button p-2 rounded-md hover:bg-gray-100">
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className="md:hidden">
          {/* Add your mobile menu items here */}
        </div>
      </div>
    </nav>
  );
}

