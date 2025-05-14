'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const handleAuth = async () => {
    setLoading(true)
    setErrorMsg('')
    const fn = mode === 'login' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { error } = await fn({ email, password })
    if (error) setErrorMsg(error.message)
    setLoading(false)
  }

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: 'http://localhost:3000/auth/callback', // ✅ adjust for deployed env
      },
    });
  
    if (error) {
      console.error('OAuth login error:', error.message);
      setErrorMsg(error.message);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">
        {mode === 'login' ? 'Log In' : 'Sign Up'}
      </h2>

      {errorMsg && <p className="text-red-500 mb-2">{errorMsg}</p>}

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full p-2 mb-3 border rounded"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full p-2 mb-3 border rounded"
      />

      <button
        onClick={handleAuth}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded mb-4"
        disabled={loading}
      >
        {loading ? 'Loading...' : mode === 'login' ? 'Log In' : 'Sign Up'}
      </button>

      <div className="flex justify-between text-sm mb-4">
        <button onClick={() => setMode('login')} className="text-blue-500">
          Log In
        </button>
        <button onClick={() => setMode('signup')} className="text-blue-500">
          Sign Up
        </button>
      </div>

      <hr className="my-4" />
      <p className="text-center text-sm text-gray-500 mb-2">Or continue with:</p>

      <div className="flex gap-4 justify-center">
        <button
          onClick={() => handleOAuth('google')}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Google
        </button>
        <button
          onClick={() => handleOAuth('facebook')}
          className="bg-blue-700 text-white px-4 py-2 rounded"
        >
          Facebook
        </button>
      </div>
    </div>
  )
}
