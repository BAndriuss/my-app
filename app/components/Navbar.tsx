'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface Profile {
  username: string | null
  balance: number
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
  const router = useRouter()

    const fetchProfile = async (userId: string) => {
      console.log('Navbar: Fetching profile for user:', userId);
    let retries = 3;
    
    while (retries > 0) {
      try {
        // First check if the profile exists
        const { count, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('id', userId);

        if (countError) {
          console.error('Navbar: Error checking profile existence:', countError);
          throw countError;
        }

        // If profile doesn't exist yet, wait and retry
        if (count === 0) {
          console.log('Navbar: Profile does not exist yet, waiting...');
          if (retries > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Longer wait for profile creation
            retries--;
            continue;
          }
          return null;
        }

        // If profile exists, fetch it
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('username, balance')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('Navbar: Error fetching profile:', error);
          if (retries > 1) {
            console.log(`Navbar: Retrying... ${retries - 1} attempts left`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
            continue;
          }
          throw error;
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
    <nav className="bg-white shadow px-6 py-4 flex items-center justify-between">
      <div className="text-2xl font-bold text-black">
         SkateSpots
      </div>

      <div className="flex gap-6 text-sm font-medium text-gray-700">
        <Link href="/dashboard" className="hover:text-black">HOME</Link>
        <Link href="/posts" className="hover:text-black">POSTS</Link>
        <Link href="/market" className="hover:text-black">MARKET</Link>
        <Link href="/spots" className="hover:text-black">SPOTS</Link>
        <Link href="/news" className="hover:text-black">NEWS</Link>
        <Link href="/myaccount" className="hover:text-black">MY ACCOUNT</Link>
        <Link href="/myaccount/favorites" className="hover:text-black">FAVORITES</Link>
      </div>

      <div className="flex items-center gap-4">
        {isLoggedIn && (
          <>
            {username && <span className="text-sm text-gray-600">Hi, {username}</span>}
            {balance !== null && (
              <span className="text-sm font-medium text-green-600">
                Balance: ${balance.toFixed(2)}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

