import { useMemo, useState } from 'react'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { YIELD_MARKETPLACE_PRODUCTS } from '../data/yieldMarketplace'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import '../components/DetailPage.css'

export function OpportunitiesPage() {
  const { rows } = useUserTransactions()
  const [filter, setFilter] = useState('all')

  const cash = useMemo(
    () => Math.max(0, rows.reduce((s, t) => s + (Number(t.amount) || 0), 0)),
    [rows],
  )
  const blended = 0.1

  const filtered = useMemo(() => {
    return YIELD_MARKETPLACE_PRODUCTS.filter((p) => {
      if (filter === 'fscs') return p.fscs
      if (filter === 'instant') return /same|instant/i.test(p.liquidity)
      if (filter === 'rate') return true
      return true
    }).sort((a, b) => (filter === 'rate' ? b.ratePct - a.ratePct : a.rank - b.rank))
  }, [filter])

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Opportunities</h1>
        <p className="detail-sub">Full marketplace — filter sleeves that match your liquidity policy</p>
      </header>

      <div className="detail-filters" role="group" aria-label="Filters">
        {[
          { id: 'all', label: 'All' },
          { id: 'fscs', label: 'FSCS protected only' },
          { id: 'instant', label: 'Instant access only' },
          { id: 'rate', label: 'Highest rate' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            className={`detail-filter${filter === f.id ? ' detail-filter--on' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="detail-product-list">
        {filtered.map((p) => {
          const gain = cash * ((p.ratePct - blended) / 100)
          return (
            <article key={p.rank} className="detail-product" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
              <div className="detail-product__rank">{p.rank}</div>
              <div>
                <h3 className="detail-product__name">{p.name}</h3>
                <p className="detail-product__meta">
                  {p.provider} · {p.type} · Min. deposit {p.minDeposit}
                </p>
                <p className="detail-product__rate">{formatPct(p.ratePct, 2)}</p>
                <p style={{ fontSize: '0.875rem', lineHeight: 1.55, marginTop: 8, color: '#44403c' }}>{p.description}</p>
                <p className="detail-product__meta" style={{ marginTop: 8 }}>
                  FSCS:{' '}
                  <span className={`detail-badge ${p.fscs ? 'detail-badge--green' : 'detail-badge--red'}`}>{p.fscsLabel}</span>
                  · Liquidity: {p.liquidity} · Est. annual gain <strong>{formatGBP(Math.round(gain))}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                <a className="detail-btn detail-btn--salmon" href={p.applyUrl} target="_blank" rel="noreferrer">
                  Apply
                </a>
                <button type="button" className="detail-btn">
                  Save for later
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
