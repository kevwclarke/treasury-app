import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export function useUserTransactions() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('Not authenticated.')

        const { data, error: qError } = await supabase
          .from('transactions')
          .select('id,amount,payee,date,balance')
          .eq('user_id', user.id)
          .order('date', { ascending: true })

        if (qError) throw qError
        if (!cancelled) setRows(data ?? [])
      } catch (e) {
        if (!cancelled) {
          setError(e?.message ?? 'Failed to load transactions.')
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { rows, loading, error }
}
