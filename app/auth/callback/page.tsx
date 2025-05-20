'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      console.log('Starting callback page session check...');
      
      try {
        // Check URL parameters for any error information
        const params = new URLSearchParams(window.location.search);
        const errorParam = params.get('error');
        const errorDescription = params.get('error_description');
        
        if (errorParam) {
          console.error('OAuth error from URL params:', { error: errorParam, description: errorDescription });
          router.push(`/login?error=${encodeURIComponent(errorParam)}`);
          return;
        }

        console.log('Fetching session from Supabase...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          router.push('/login?error=auth_error');
          return;
        }

        if (!session) {
          console.error('No session found after authentication');
          router.push('/login?error=no_session');
          return;
        }

        console.log('Session successfully retrieved:', {
          user: session.user.email,
          expires_at: session.expires_at
        });

        // Check if user has a profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .single();

        // If no profile exists, create one with null username
        if (profileError?.code === 'PGRST116') {
          console.log('No profile exists, creating one...');
          const { error: createError } = await supabase
            .from('profiles')
            .insert([
              {
                id: session.user.id,
                username: null,
                balance: 0,
                is_admin: false
              }
            ]);

          if (createError) {
            console.error('Error creating profile:', createError);
            router.push('/login?error=profile_creation_error');
            return;
          }

          console.log('Profile created, redirecting to username setup...');
          router.push('/setup-username');
          return;
        } else if (profileError) {
          console.error('Error checking profile:', profileError);
          router.push('/login?error=profile_error');
          return;
        }

        // If profile exists but no username is set
        if (!profile?.username) {
          console.log('No username set, redirecting to setup...');
          router.push('/setup-username');
          return;
        }

        // Successfully authenticated and has username, redirect to dashboard
        console.log('Profile complete, redirecting to dashboard...');
        router.push('/dashboard');
      } catch (error) {
        console.error('Unexpected error in callback:', error);
        router.push('/login?error=callback_error');
      }
    };

    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Completing Sign In...</h2>
        <p className="text-gray-600">Please wait while we complete the process.</p>
        <p className="text-sm text-gray-500 mt-2">Check the browser console for detailed progress.</p>
      </div>
    </div>
  );
}
