import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../supabase'

/**
 * Ensures authenticated users have completed company onboarding before app shell routes.
 */
export function RequireCompanyProfile() {
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) {
          if (!cancelled) setState('missing')
          return
        }
        const { data, error } = await supabase
          .from('company_profiles')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) throw error
        if (!cancelled) setState(data ? 'ok' : 'missing')
      } catch {
        if (!cancelled) setState('missing')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return (
      <div className="app-loading" role="status">
        <span className="app-loading__text">Loading…</span>
      </div>
    )
  }

  if (state === 'missing') {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
