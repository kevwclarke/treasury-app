import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTreasuryTransactions } from '../hooks/useTreasuryTransactions'
import { getReportCompanyName } from '../constants/treasuryReport'
import { buildTreasuryReportPdfPayload } from '../utils/treasuryReportPayload'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import '../components/DetailPage.css'

const LAST_KEY = 'treasury_last_report_at'

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
            border: '1px solid rgba(28,25,23,0.12)',
            borderRadius: 12,
            padding: '1.25rem',
            background: 'linear-gradient(180deg,#fffefb,#faf6f0)',
            minHeight: 280,
            fontFamily: "'Playfair Display', Georgia, serif",
          }}
        >
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#57534e' }}>
            Confidential · {companyName}
          </p>
          <h2 style={{ margin: '0.5rem 0', fontSize: '1.5rem' }}>Treasury health snapshot</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: '#57534e' }}>Health</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {txnLoading ? '…' : `${preview.healthScore} / 100`}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#57534e' }}>Total cash</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {txnLoading ? '…' : formatGBP(Math.round(preview.yieldSummary.totalCash))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#57534e' }}>Runway</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{txnLoading ? '…' : baseRunway}</div>
            </div>
          </div>
          <p style={{ marginTop: 20, fontSize: 14, color: '#44403c', lineHeight: 1.5 }}>
            Yield gap: <strong>{formatPct(preview.bestYieldPct - preview.effectiveYieldPct, 2)}</strong> vs best benchmark ·
            Concentration: <strong>{preview.concentration.riskLabel}</strong> (top{' '}
            {formatPct(preview.concentration.maxPct, 1)}) · Burn: payroll-weighted.
          </p>
        </div>
        {txnError ? <p className="detail-muted" style={{ marginTop: 12, color: '#b45309' }}>{txnError}</p> : null}
        <button
          type="button"
          className="detail-btn detail-btn--dark"
          style={{ marginTop: '1rem', padding: '0.75rem 1.25rem', fontSize: '1rem' }}
          onClick={generate}
          disabled={pdfLoading}
          aria-busy={pdfLoading}
        >
          {pdfLoading ? 'Generating…' : 'Generate PDF'}
        </button>
        {lastAt ? (
          <p className="detail-muted" style={{ marginTop: 12 }}>
            Last generated: {new Date(lastAt).toLocaleString('en-GB')}
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
          <li>Latest AI treasury actions (cached from the dashboard)</li>
        </ul>
      </section>
    </div>
  )
}
