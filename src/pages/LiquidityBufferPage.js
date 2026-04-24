import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LiquidityBufferGauge } from '../components/LiquidityBufferGauge'
import { formatGBP } from '../utils/treasuryFormat'
import {
  computeLiquidityBuffer,
  LIQUIDITY_MIN_MONTHS,
  LIQUIDITY_TARGET_MONTHS,
} from '../utils/treasuryLiquidity'
import { useUserTransactions } from '../hooks/useUserTransactions'
import '../components/DetailPage.css'

function statusLabel(liq) {
  if (liq.monthlyBurn <= 0) return 'No outflows in the last 90 days'
  if (liq.bufferMonths == null) return '—'
  if (liq.bufferMonths < LIQUIDITY_MIN_MONTHS) return 'Below minimum'
  if (liq.bufferMonths <= LIQUIDITY_TARGET_MONTHS) return 'Between minimum and target'
  return 'Above target'
}

function threshClass(band) {
  if (band === 'red') return 'detail-liq-thresh--risk'
  if (band === 'amber') return 'detail-liq-thresh--warn'
  return 'detail-liq-thresh--ok'
}

export function LiquidityBufferPage() {
  const { rows, loading, error } = useUserTransactions()
  const liq = useMemo(() => computeLiquidityBuffer(rows), [rows])

  const bufferMoLabel =
    liq.bufferMonths != null && Number.isFinite(liq.bufferMonths)
      ? `${liq.bufferMonths.toLocaleString('en-GB', { maximumFractionDigits: 1 })} mo`
      : liq.monthlyBurn <= 0
        ? '∞'
        : '—'

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Liquidity Buffer</h1>
        <p className="detail-sub">
          Instantly accessible cash from your statement import, compared to average monthly outflow from the last{' '}
          {90} days. Ring scale runs to {LIQUIDITY_TARGET_MONTHS} months; grey dots mark {LIQUIDITY_MIN_MONTHS}-month
          minimum and {LIQUIDITY_TARGET_MONTHS}-month target.
        </p>
      </header>

      {error ? (
        <section className="detail-section">
          <p className="detail-muted" role="alert">
            {error}
          </p>
        </section>
      ) : null}

      <section className="detail-section">
        <h2 className="detail-section__title">Coverage</h2>
        {loading ? (
          <p className="detail-muted">Loading…</p>
        ) : !rows.length ? (
          <p className="detail-muted" style={{ margin: 0 }}>
            Upload a bank statement to model your liquidity buffer.{' '}
            <Link to="/upload">Upload statement</Link>
          </p>
        ) : (
          <>
            <div className="detail-liq-hero">
              <LiquidityBufferGauge bufferMonths={liq.bufferMonths} band={liq.band} size={112} />
              <div className="detail-liq-thresholds">
                <div className="detail-liq-thresh">
                  <span className="detail-liq-thresh__cap">{LIQUIDITY_MIN_MONTHS} months minimum</span>
                  <span className="detail-liq-thresh__val">{formatGBP(Math.round(liq.minCash3mo))}</span>
                </div>
                <div className="detail-liq-thresh">
                  <span className="detail-liq-thresh__cap">{LIQUIDITY_TARGET_MONTHS} months target</span>
                  <span className="detail-liq-thresh__val">{formatGBP(Math.round(liq.targetCash6mo))}</span>
                </div>
                <div className={`detail-liq-thresh ${threshClass(liq.band)}`}>
                  <span className="detail-liq-thresh__cap">Current · {bufferMoLabel}</span>
                  <span className="detail-liq-thresh__val">{formatGBP(Math.round(liq.totalCash))}</span>
                </div>
              </div>
            </div>
            <p className="detail-liq-foot">{statusLabel(liq)}</p>
          </>
        )}
      </section>

      {!loading && rows.length > 0 ? (
        <>
          <section className="detail-section">
            <h2 className="detail-section__title">Headline figures</h2>
            <div className="detail-grid3">
              <div className="detail-stat">
                <p className="detail-stat__cap">Instantly accessible cash</p>
                <p className="detail-stat__val">{formatGBP(Math.round(liq.totalCash))}</p>
              </div>
              <div className="detail-stat">
                <p className="detail-stat__cap">Monthly burn (90-day basis)</p>
                <p className="detail-stat__val">{formatGBP(Math.round(liq.monthlyBurn))}</p>
              </div>
              <div className="detail-stat">
                <p className="detail-stat__cap">Liquidity buffer</p>
                <p className="detail-stat__val">{bufferMoLabel}</p>
              </div>
            </div>
          </section>

          <section className="detail-section">
            <h2 className="detail-section__title">Obligations & excess</h2>
            <div className="detail-grid3">
              <div className="detail-stat">
                <p className="detail-stat__cap">3-month obligations</p>
                <p className="detail-stat__val">{formatGBP(Math.round(liq.obligations3mo))}</p>
                <p className="detail-stat__note">Monthly burn × 3</p>
              </div>
              <div className="detail-stat">
                <p className="detail-stat__cap">Buffer excess</p>
                <p
                  className={`detail-stat__val${
                    liq.bufferExcess < 0 ? ' detail-stat__val--red' : ' detail-stat__val--green'
                  }`}
                >
                  {formatGBP(Math.round(liq.bufferExcess))}
                </p>
                <p className="detail-stat__note">Total cash minus 3-month obligations</p>
              </div>
              <div className="detail-stat">
                <p className="detail-stat__cap">Eligible for yield optimisation</p>
                <p className="detail-stat__val detail-stat__val--green">{formatGBP(Math.round(liq.eligibleForYield))}</p>
                <p className="detail-stat__note">Cash above the {LIQUIDITY_TARGET_MONTHS}-month target buffer</p>
              </div>
            </div>
          </section>

          <section className="detail-section">
            <h2 className="detail-section__title">Policy</h2>
            <p className="detail-section__lead" style={{ marginBottom: 0 }}>
              {liq.eligibleForYield > 0 ? (
                <>
                  Only cash above the {LIQUIDITY_TARGET_MONTHS}-month target buffer is eligible for yield optimisation.{' '}
                  That is <strong>{formatGBP(Math.round(liq.eligibleForYield))}</strong> on your current import.
                </>
              ) : (
                <>
                  You are at or below the {LIQUIDITY_TARGET_MONTHS}-month target buffer. No balance is treated as
                  eligible for yield optimisation until accessible cash exceeds{' '}
                  <strong>{formatGBP(Math.round(liq.targetCash6mo))}</strong>.
                </>
              )}
            </p>
          </section>
        </>
      ) : null}
    </div>
  )
}
