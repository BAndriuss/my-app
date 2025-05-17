'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import RegistrationForm from '../components/RegistrationForm'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const router = useRouter()

  // Check for error message in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const errorParam = url.searchParams.get('error')
      if (errorParam === 'verification_expired') {
        setError('Verification link has expired. Please try logging in or request a new verification email.')
      }
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    try {
      setLoading(true)
      console.log('Attempting login with email:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Login error:', error)
        throw error
      }

      if (data.session) {
        console.log('Login successful, redirecting to dashboard')
        router.push('/dashboard')
      } else {
        throw new Error('No session after login')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred during login')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      console.log('Attempting Google login')
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        console.error('Google login error:', error)
        throw error
      }

      console.log('Google login initiated:', data)
    } catch (err) {
      console.error('Google login error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred during Google login')
    }
  }

  const handleFacebookLogin = async () => {
    try {
      console.log('Attempting Facebook login')
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        console.error('Facebook login error:', error)
        throw error
      }

      console.log('Facebook login initiated:', data)
    } catch (err) {
      console.error('Facebook login error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred during Facebook login')
    }
  }

  const handleRegistrationSuccess = () => {
    setIsRegistering(false)
  }

  if (isRegistering) {
    return (
      <div className="min-h-screen bg-pattern-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="content-overlay p-8 max-w-md w-full">
          <RegistrationForm onRegistrationSuccess={handleRegistrationSuccess} />
          <div className="text-center mt-4">
            <button
              onClick={() => setIsRegistering(false)}
              className="font-cornerstone text-blue-600 hover:text-blue-800"
            >
              Already have an account? Log in
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pattern-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="content-overlay p-8 max-w-md w-full space-y-8">
        <div>
          <h2 className="heading-1 text-center">
            SIGN IN TO YOUR ACCOUNT
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="font-bebas appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-base"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="font-bebas appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-base"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="description-text text-red-500 text-center">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary bg-blue-600 hover:bg-blue-700 w-full disabled:bg-blue-300"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="btn-primary bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 w-full"
            >
              <img
                src="/google.svg"
                alt="Google"
                className="w-5 h-5 mr-2 inline"
              />
              Sign in with Google
            </button>

            <button
              type="button"
              onClick={handleFacebookLogin}
              className="btn-primary bg-[#1877F2] text-white hover:bg-[#166FE5] w-full"
            >
              <img
                src="/facebook.svg"
                alt="Facebook"
                className="w-5 h-5 mr-2 inline"
              />
              Sign in with Facebook
            </button>
          </div>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsRegistering(true)}
            className="font-cornerstone text-blue-600 hover:text-blue-800"
          >
            Don't have an account? Register
          </button>
        </div>
      </div>
    </div>
  )
}
