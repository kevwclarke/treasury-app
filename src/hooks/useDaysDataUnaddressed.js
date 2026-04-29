import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

/**
 * Days since `company_profiles.first_data_upload_at` (first successful data import).
 * @returns {{ days: number | null, loading: boolean }}
 */
export function useDaysDataUnaddressed() {
  const [days, setDays] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) {
          if (!cancelled) {
            setDays(null)
            setLoading(false)
          }
          return
        }

        const { data, error } = await supabase
          .from('company_profiles')
          .select('first_data_upload_at')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) throw error

        const ts = data?.first_data_upload_at
        if (!ts) {
          if (!cancelled) {
            setDays(null)
            setLoading(false)
          }
          return
        }

        const ms = Date.now() - new Date(ts).getTime()
        const d = Math.floor(ms / (1000 * 60 * 60 * 24))
        if (!cancelled) setDays(Number.isFinite(d) ? d : null)
      } catch {
        if (!cancelled) setDays(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { days, loading }
}
