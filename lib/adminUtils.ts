import { supabase } from './supabaseClient'

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error checking admin status:', error)
      return false
    }

    return data?.is_admin || false
  } catch (err) {
    console.error('Error in isAdmin check:', err)
    return false
  }
}

export async function requireAdmin(userId: string): Promise<boolean> {
  const adminStatus = await isAdmin(userId)
  if (!adminStatus) {
    throw new Error('Unauthorized: Admin access required')
  }
  return true
} 