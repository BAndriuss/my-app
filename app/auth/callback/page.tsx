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

        // Successfully authenticated, redirect to dashboard
        console.log('Redirecting to dashboard...');
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
