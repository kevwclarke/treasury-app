import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

/**
 * @returns {{
 *   profile: { company_name: string, funding_stage: string, created_at?: string } | null,
 *   loading: boolean,
 *   error: string,
 *   refresh: () => Promise<void>,
 * }}
 */
export function useCompanyProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) {
        setProfile(null)
        return
      }
      const { data, error: qError } = await supabase
        .from('company_profiles')
        .select('company_name,funding_stage,created_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (qError) throw qError
      setProfile(data ?? null)
    } catch (e) {
      setError(e?.message ?? 'Failed to load company profile.')
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { profile, loading, error, refresh }
}
