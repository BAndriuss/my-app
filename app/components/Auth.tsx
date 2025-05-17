'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignIn = async () => {
    try {
      console.log('Starting sign in process...');
      setLoading(true);
      setErrorMsg('');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('Sign in response:', { data, error });
      if (error) {
        console.error('Sign in error:', error);
        setErrorMsg(error.message);
      } else {
        console.log('Sign in successful:', data);
      }
    } catch (err) {
      console.error('Sign in exception:', err);
      setErrorMsg('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    try {
      console.log('Starting sign up process...');
      setLoading(true);
      setErrorMsg('');
      const { data, error } = await supabase.auth.signUp({ email, password });
      console.log('Sign up response:', { data, error });
      if (error) {
        console.error('Sign up error:', error);
        setErrorMsg(error.message);
      } else {
        console.log('Sign up successful:', data);
      }
    } catch (err) {
      console.error('Sign up exception:', err);
      setErrorMsg('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      console.log('Starting Google sign in process...');
      setLoading(true);
      setErrorMsg('');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      console.log('Google sign in response:', { data, error });
      if (error) {
        console.error('Google sign in error:', error);
        setErrorMsg(error.message);
      } else {
        console.log('Google sign in initiated:', data);
      }
    } catch (err) {
      console.error('Google sign in exception:', err);
      setErrorMsg('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white shadow-md rounded">
      <h2 className="text-2xl font-bold mb-4">Sign In or Register</h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 border mb-3 rounded"
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 border mb-3 rounded"
      />

      {errorMsg && <p className="text-red-500 mb-2">{errorMsg}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Sign In
        </button>
        <button
          onClick={handleSignUp}
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
        >
          Sign Up
        </button>
      </div>

      <hr className="my-4" />

      <button
        onClick={handleGoogleLogin}
        className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
      >
        Continue with Google
      </button>
    </div>
  );
}