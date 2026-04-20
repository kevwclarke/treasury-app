import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useUserTransactions } from '../hooks/useUserTransactions'
import '../components/DetailPage.css'
import { computeConcentrationFromTransactions } from '../utils/treasuryConcentration'
import { formatGBP, formatPct } from '../utils/treasuryFormat'

export function ConcentrationRiskPage() {
  const { rows, loading, error } = useUserTransactions()
  const concentration = useMemo(() => computeConcentrationFromTransactions(rows), [rows])

  const {
    totalCash,
    institutionRows,
    barSegments,
    maxPct,
    riskTone,
    riskLabel,
    unprotectedTotal,
    protectedTotal,
  } = concentration

  const visibleRows = institutionRows.filter((r) => Math.abs(r.balance) > 0.005)

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Concentration Risk</h1>
        <p className="detail-sub">FSCS protection and counterparty exposure from your uploaded transactions</p>
      </header>

      {loading ? (
        <section className="detail-section">
          <p className="detail-muted">Loading transactions…</p>
        </section>
      ) : error ? (
        <section className="detail-section">
          <div className="detail-warn detail-warn--red">{error}</div>
        </section>
      ) : rows.length === 0 ? (
        <section className="detail-section">
          <h2 className="detail-section__title">No transactions yet</h2>
          <p className="detail-section__lead">
            Import a bank CSV to attribute balances by institution and calculate FSCS exposure.
          </p>
          <Link className="detail-btn detail-btn--dark" to="/upload" style={{ marginTop: '0.75rem' }}>
            Upload statement
          </Link>
        </section>
      ) : (
        <>
          <section className="detail-section">
            <h2 className="detail-section__title">Exposure overview</h2>
            <p className="detail-section__lead" style={{ marginBottom: '0.75rem' }}>
              Total cash (net of all transactions):{' '}
              <strong>{formatGBP(Math.round(totalCash))}</strong>
            </p>
            {totalCash <= 0 ? (
              <p className="detail-muted">Net cash is not positive — concentration percentages are not meaningful until inflows exceed outflows.</p>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    height: '1.25rem',
                    borderRadius: '999px',
                    overflow: 'hidden',
                    marginBottom: '0.75rem',
                  }}
                  aria-hidden
                >
                  {barSegments.map((seg) => (
                    <div
                      key={seg.name}
                      style={{
                        width: `${seg.widthPct}%`,
                        background: seg.color,
                      }}
                      title={`${seg.name} ${formatPct((seg.balance / totalCash) * 100, 1)}`}
                    />
                  ))}
                </div>
                <p className="detail-muted" style={{ marginBottom: '0.75rem' }}>
                  {barSegments.map((seg) => `${formatPct((seg.balance / totalCash) * 100, 1)} ${seg.name}`).join(' · ')}
                </p>
              </>
            )}
            <span
              className={`detail-badge ${
                riskTone === 'green' ? 'detail-badge--green' : riskTone === 'amber' ? '' : 'detail-badge--red'
              }`}
              style={
                riskTone === 'amber'
                  ? { background: '#c27803', color: '#fff' }
                  : undefined
              }
            >
              {riskLabel} · top institution {formatPct(maxPct, 1)}
            </span>
            <p className="detail-section__lead" style={{ marginTop: '1rem' }}>
              Each transaction is tagged with the bank you selected when uploading the CSV. Imports done before this
              feature may show as &ldquo;Other&rdquo; until you re-upload with a bank chosen.
            </p>
          </section>

          <section className="detail-section">
            <h2 className="detail-section__title">Institution balances</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="detail-table">
                <thead>
                  <tr>
                    <th>Institution</th>
                    <th>Balance</th>
                    <th>% of total cash</th>
                    <th>FSCS protected</th>
                    <th>Unprotected</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="detail-muted">
                        No attributed institution balances (all activity may be excluded, e.g. AWS-only).
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        <td>{formatGBP(Math.round(r.balance))}</td>
                        <td>{formatPct(r.pctOfTotal, 1)}</td>
                        <td>{formatGBP(Math.round(r.protectedAmt))}</td>
                        <td className="text-red">{formatGBP(Math.round(r.unprotectedAmt))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="detail-section">
            <h2 className="detail-section__title">FSCS calculator</h2>
            <p className="detail-section__lead">
              The Financial Services Compensation Scheme protects up to £85,000 per person per authorised institution for
              eligible deposits. Unprotected = max(0, balance − £85,000) per institution (positive balances only).
            </p>
            <div className="detail-grid3">
              <div className="detail-stat">
                <p className="detail-stat__cap">Total protected (capped)</p>
                <p className="detail-stat__val detail-stat__val--green">
                  {formatGBP(Math.round(protectedTotal))}
                </p>
              </div>
              <div className="detail-stat">
                <p className="detail-stat__cap">Total unprotected</p>
                <p className="detail-stat__val detail-stat__val--salmon">
                  {formatGBP(Math.round(unprotectedTotal))}
                </p>
              </div>
            </div>
            {unprotectedTotal > 0 ? (
              <div className="detail-warn detail-warn--red" style={{ marginTop: '1rem' }}>
                <strong>{formatGBP(Math.round(unprotectedTotal))}</strong> sits above the FSCS £85,000 limit across
                institutions — consider spreading eligible deposits and reviewing non-bank &ldquo;Other&rdquo; balances.
              </div>
            ) : null}
            {unprotectedTotal > 500_000 ? (
              <div className="detail-warn detail-warn--red" style={{ marginTop: '0.75rem' }}>
                Unprotected cash exceeds £500,000 — review sweeps and second legal entity structures urgently.
              </div>
            ) : null}
          </section>
        </>
      )}

      <section className="detail-section">
        <h2 className="detail-section__title">Recommendations</h2>
        <div className="detail-grid3">
          <div className="detail-stat">
            <p className="detail-stat__cap">Spread</p>
            <p className="detail-muted">Split operating balances across ≥2 authorised institutions.</p>
            <button type="button" className="detail-btn" style={{ marginTop: '0.75rem' }}>
              Build sweep plan
            </button>
          </div>
          <div className="detail-stat">
            <p className="detail-stat__cap">Government-backed</p>
            <p className="detail-muted">Allocate a sleeve to short-dated gilts / T-Bills for sovereign risk.</p>
            <button type="button" className="detail-btn" style={{ marginTop: '0.75rem' }}>
              View T-Bills
            </button>
          </div>
          <div className="detail-stat">
            <p className="detail-stat__cap">Flagstone</p>
            <p className="detail-muted">Multi-bank platform to stack FSCS coverage with one operational workflow.</p>
            <button type="button" className="detail-btn" style={{ marginTop: '0.75rem' }}>
              Explore Flagstone
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
