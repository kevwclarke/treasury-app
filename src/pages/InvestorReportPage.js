import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTreasuryTransactions } from '../hooks/useTreasuryTransactions'
import { getReportCompanyName } from '../constants/treasuryReport'
import { buildTreasuryReportPdfPayload } from '../utils/treasuryReportPayload'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import '../components/DetailPage.css'
import './InvestorReportPage.css'

const LAST_KEY = 'treasury_last_report_at'

const PDF_INCLUDES = [
  'Treasury health score',
  'Cash position and yield gap',
  'Runway scenarios',
  'Concentration risk and FSCS exposure',
  'AI-generated priority actions',
]

export function InvestorReportPage() {
  const { txnLoading, txnError, txnRows } = useTreasuryTransactions()
  const [lastAt, setLastAt] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const pdfLockRef = useRef(false)

  const companyName = useMemo(() => getReportCompanyName(), [])

  const preview = useMemo(() => buildTreasuryReportPdfPayload(txnRows), [txnRows])

  useEffect(() => {
    setLastAt(localStorage.getItem(LAST_KEY))
  }, [])

  const generate = useCallback(async () => {
    if (pdfLockRef.current) return
    pdfLockRef.current = true
    setPdfLoading(true)
    try {
      await new Promise((resolve) => {
        requestAnimationFrame(() => resolve())
      })
      const payload = buildTreasuryReportPdfPayload(txnRows)
      const { downloadTreasuryInvestorPdf } = await import('../utils/treasuryInvestorPdf')
      downloadTreasuryInvestorPdf(payload)
      const iso = new Date().toISOString()
      localStorage.setItem(LAST_KEY, iso)
      setLastAt(iso)
    } catch (e) {
      window.alert(e?.message ?? 'Could not generate PDF. Please try again.')
    } finally {
      setPdfLoading(false)
      pdfLockRef.current = false
    }
  }, [txnRows])

  const baseRunway =
    preview.runwayMetrics.baseRunwayMo != null && Number.isFinite(preview.runwayMetrics.baseRunwayMo)
      ? `${preview.runwayMetrics.baseRunwayMo.toFixed(1)} mo`
      : '—'

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Investor-Ready Treasury Report</h1>
        <p className="detail-sub">Board-ready in 30 seconds</p>
      </header>

      <section className="detail-section">
        <div
          style={{
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: '1.25rem',
            background: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280' }}>
            Confidential · {companyName}
          </p>
          <h2 style={{ margin: '0.5rem 0', fontSize: '1.5rem' }}>Treasury health snapshot</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: '#6B7280' }}>Health</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {txnLoading ? '…' : `${preview.healthScore} / 100`}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6B7280' }}>Total cash</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {txnLoading ? '…' : formatGBP(Math.round(preview.yieldSummary.totalCash))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6B7280' }}>Runway</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{txnLoading ? '…' : baseRunway}</div>
            </div>
          </div>
          <p style={{ marginTop: 20, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
            Yield gap: <strong>{formatPct(preview.bestYieldPct - preview.effectiveYieldPct, 2)}</strong> vs best benchmark ·
            Concentration: <strong>{preview.concentration.riskLabel}</strong> (top{' '}
            {formatPct(preview.concentration.maxPct, 1)}) · Burn: payroll-weighted.
          </p>
        </div>

        <div className="investor-report__row">
          <div className="investor-report__pdf-panel">
            <p className="investor-report__pdf-title">Your report includes</p>
            <ul className="investor-report__pdf-list">
              {PDF_INCLUDES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="investor-report__actions">
            <button
              type="button"
              className="detail-btn detail-btn--dark"
              style={{ padding: '0.75rem 1.25rem', fontSize: '1rem' }}
              onClick={generate}
              disabled={pdfLoading}
              aria-busy={pdfLoading}
            >
              {pdfLoading ? 'Generating…' : 'Generate PDF'}
            </button>
            {lastAt ? (
              <p className="detail-muted" style={{ margin: 0 }}>
                Last generated: {new Date(lastAt).toLocaleString('en-GB')}
              </p>
            ) : null}
          </div>
        </div>

        {txnError ? (
          <p
            className="detail-muted"
            style={{
              marginTop: 12,
              padding: '12px 14px',
              background: '#FFFBEB',
              border: '1px solid #E5E7EB',
              borderLeft: '3px solid #D97706',
              color: '#374151',
            }}
          >
            {txnError}
          </p>
        ) : null}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Included</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Cover with treasury health score and generation date</li>
          <li>Cash position, yield, and opportunity cost</li>
          <li>Runway scenarios and top burn categories</li>
          <li>Concentration and FSCS exposure</li>
          <li>Latest autopilot recommendations (cached from Treasury Autopilot)</li>
        </ul>
      </section>
    </div>
  )
}
