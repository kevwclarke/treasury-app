import { Link } from 'react-router-dom'
import { formatGBP } from '../utils/treasuryFormat'
import { TransactionList, TransactionRow } from './TransactionRow'
import './TransactionFeed.css'

function formatRowMeta(t) {
  const d = t.date ? String(t.date).slice(0, 10) : '—'
  return d
}

/**
 * @param {{
 *   rows: Array<{ id?: string, amount?: number, payee?: string, date?: string }>,
 *   loading?: boolean,
 *   error?: string | null,
 *   emptyMessage?: string,
 *   viewAllHref?: string,
 *   maxRows?: number,
 * }} props
 */
export function TransactionFeed({
  rows = [],
  loading = false,
  error = null,
  emptyMessage = 'No transactions to show.',
  viewAllHref = '/upload',
  maxRows = 20,
}) {
  if (loading) {
    return (
      <div className="txn-feed txn-feed--state">
        <p className="txn-feed__state">Loading activity…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="txn-feed txn-feed--state txn-feed--error" role="alert">
        <p className="txn-feed__state">{error}</p>
      </div>
    )
  }
  const slice = (rows || []).slice(0, maxRows)
  if (!slice.length) {
    return (
      <div className="txn-feed txn-feed--state">
        <p className="txn-feed__state">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="txn-feed">
      <TransactionList>
        {slice.map((t) => {
          const amt = Number(t.amount)
          const inflow = Number.isFinite(amt) && amt > 0
          return (
            <TransactionRow
              key={t.id || `${t.date}-${t.payee}-${amt}`}
              direction={inflow ? 'in' : 'out'}
              payee={String(t.payee || '—')}
              meta={formatRowMeta(t)}
              amountText={formatGBP(Math.abs(Number.isFinite(amt) ? amt : 0))}
            />
          )
        })}
      </TransactionList>
      {rows.length > maxRows ? (
        <div className="txn-feed__footer">
          <Link className="txn-feed__view-all" to={viewAllHref}>
            View all
          </Link>
        </div>
      ) : null}
    </div>
  )
}
