'use client'

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface RegistrationFormProps {
  onRegistrationSuccess: () => void;
}

export default function RegistrationForm({ onRegistrationSuccess }: RegistrationFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      console.log('Registration: Starting registration process');
      
      // Validate fields
      if (!email || !password || !confirmPassword || !username) {
        throw new Error('All fields are required');
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const trimmedUsername = username.trim();

      // Check if username is taken
      console.log('Registration: Checking if username is taken:', trimmedUsername);
      const { data: existingUsers, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmedUsername);

      if (checkError) {
        console.error('Registration: Error checking username:', checkError);
        throw new Error(`Error checking username: ${checkError.message}`);
      }

      if (existingUsers && existingUsers.length > 0) {
        throw new Error('Username already taken');
      }

      console.log('Registration: Username is available, proceeding with signup');

      // Log the URL we're using for redirect
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log('Registration: Redirect URL:', redirectUrl);

      // Sign up the user
      console.log('Registration: Attempting to sign up user with email:', email);
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: trimmedUsername
          },
          emailRedirectTo: redirectUrl
        }
      });

      console.log('Registration: Sign up response:', { 
        user: signUpData?.user ? 'User exists' : 'No user', 
        session: signUpData?.session ? 'Session exists' : 'No session',
        error: signUpError
      });

      if (signUpError) {
        console.error('Registration: Signup error:', signUpError);
        throw new Error(`Registration failed: ${signUpError.message}`);
      }

      if (!signUpData.user) {
        throw new Error('Registration failed: No user data returned');
      }

      // Wait a bit longer before checking the profile
      console.log('Registration: Waiting for profile creation...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if the user was created successfully with retries
      console.log('Registration: Checking for profile creation...');
      let profile = null;
      let profileError = null;
      let retries = 3;

      while (retries > 0) {
        const result = await supabase
        .from('profiles')
        .select('*')
        .eq('id', signUpData.user.id)
        .single();

        if (result.data) {
          profile = result.data;
          break;
        }

        profileError = result.error;
        retries--;
        
        if (retries > 0) {
          console.log('Registration: Profile not found, retrying in 1 second...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('Registration: Profile check result:', { profile, error: profileError });

      if (!profile) {
        console.error('Registration: Profile check error:', profileError);
        throw new Error('Profile creation is taking longer than expected. Please try logging in after a few moments.');
      }

      setMessage('Registration successful! Please check your email for verification.');
      console.log('Registration: Process completed successfully');
      onRegistrationSuccess?.();

    } catch (err) {
      console.error('Registration: Final error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-md bg-green-50 p-4">
            <div className="text-sm text-green-700">{message}</div>
          </div>
        )}
      </div>
    </div>
  );
} 