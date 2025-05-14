'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          router.push('/login?error=auth_error');
          return;
        }

        if (!session) {
          console.error('No session found');
          router.push('/login');
          return;
        }

        // Successfully authenticated, redirect to dashboard
        router.push('/dashboard');
      } catch (error) {
        console.error('Error in callback:', error);
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
      </div>
    </div>
  );
}
