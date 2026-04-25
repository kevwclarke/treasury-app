import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

/** Loads `treasury_policies.min_runway_months` for the signed-in user (Burn Intelligence / Treasury Autopilot). */
export function useTreasuryAutopilotPolicy() {
  const [autopilot, setAutopilot] = useState({ loading: true, configured: false, minRunwayMonths: 6 })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setAutopilot((s) => ({ ...s, loading: true }))
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('Not authenticated.')
        const { data } = await supabase.from('treasury_policies').select('*').eq('user_id', user.id).maybeSingle()
        if (cancelled) return
        if (data) {
          setAutopilot({
            loading: false,
            configured: true,
            minRunwayMonths: Number(data.min_runway_months) || 6,
          })
        } else {
          setAutopilot({ loading: false, configured: false, minRunwayMonths: 6 })
        }
      } catch {
        if (!cancelled) setAutopilot({ loading: false, configured: false, minRunwayMonths: 6 })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return autopilot
}
