import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

/**
 * Loads the signed-in user’s transactions (same query as Treasury Autopilot).
 * @returns {{ txnLoading: boolean, txnError: string, txnRows: Array<{ amount?: number|string, payee?: string, date?: string, institution?: string, running_balance?: number|null }> }}
 */
export function useTreasuryTransactions() {
  const [txnLoading, setTxnLoading] = useState(true)
  const [txnError, setTxnError] = useState('')
  const [txnRows, setTxnRows] = useState([])

  useEffect(() => {
    let cancelled = false

    async function loadTransactions() {
      setTxnLoading(true)
      setTxnError('')

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('Not authenticated.')

        const { data, error } = await supabase
          .from('transactions')
          .select('amount,payee,date,institution,running_balance')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(2000)

        if (error) throw error
        if (cancelled) return
        setTxnRows(data ?? [])
      } catch (e) {
        if (cancelled) return
        setTxnError(e?.message ?? 'Failed to load transactions.')
        setTxnRows([])
      } finally {
        if (!cancelled) setTxnLoading(false)
      }
    }

    loadTransactions()
    return () => {
      cancelled = true
    }
  }, [])

  return { txnLoading, txnError, txnRows }
}
