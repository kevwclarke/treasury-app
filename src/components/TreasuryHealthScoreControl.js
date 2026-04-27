import { useEffect, useRef, useState } from 'react'
import { useCountUp } from '../hooks/useCountUp'
import { getTreasuryHealthScoreBand } from '../utils/treasuryHealthScore'
import './TreasuryHealthScoreControl.css'

function summaryTooltipText(peerAverage) {
  return `Your Treasury Health Score is calculated from yield gap, concentration risk, runway, liquidity buffer, and burn trajectory. 100 is optimal. Industry average for Series A startups is ${peerAverage}.`
}

export function TreasuryHealthScoreControl({ score, loading, peerAverage = 68 }) {
  const band = loading ? 'warn' : getTreasuryHealthScoreBand(score)
  const animatedScore = useCountUp(Number.isFinite(score) ? score : 0, {
    enabled: !loading && Number.isFinite(score),
  })
  const [pinned, setPinned] = useState(false)
  const [hover, setHover] = useState(false)
  const wrapRef = useRef(null)

  const open = pinned || hover

  useEffect(() => {
    if (!pinned) return undefined
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setPinned(false)
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setPinned(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pinned])

  return (
    <div
      className="tdash-health-score"
      ref={wrapRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className={`tdash-health-score__trigger tdash-health-score__trigger--${band}`}
        onClick={() => setPinned((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="treasury-health-score-popover"
        id="treasury-health-score-trigger"
        title={summaryTooltipText(peerAverage)}
      >
        <span className="tdash-health-score__eyebrow">Treasury Health</span>
        <span className="tdash-health-score__score-row">
          <span className="tdash-health-score__value">
            {loading || !Number.isFinite(score) ? '—' : Math.round(animatedScore)}
          </span>
          <span className="tdash-health-score__max">/ 100</span>
        </span>
        <span className="tdash-health-score__peer">vs {peerAverage} avg</span>
      </button>
      {open ? (
        <div
          className="tdash-health-score__popover"
          id="treasury-health-score-popover"
          role="region"
          aria-labelledby="treasury-health-score-trigger"
        >
          <p className="tdash-health-score__popover-title">Treasury health score</p>
          <p className="tdash-health-score__popover-lead">
            A single 0–100 read on structural treasury risk from your uploaded data and our benchmark assumptions.
          </p>
          <p className="tdash-health-score__popover-sub">How it is calculated (from 100)</p>
          <ul className="tdash-health-score__popover-list">
            <li>
              <strong>−20</strong> if more than <strong>75%</strong> of cash sits with one institution
            </li>
            <li>
              <strong>−15</strong> if your effective yield is more than <strong>2 percentage points</strong> below the
              best-available benchmark we use
            </li>
            <li>
              <strong>−15</strong> if base-case runway is <strong>below 18 months</strong>
            </li>
            <li>
              <strong>−10</strong> if FSCS-unprotected cash (above £85k per bank) exceeds <strong>£500,000</strong>
            </li>
            <li>
              <strong>−10</strong> if implied monthly burn (last 30 days vs 90-day average) is growing by{' '}
              <strong>more than 10%</strong>
            </li>
          </ul>
          <p className="tdash-health-score__popover-sub">How to read it</p>
          <ul className="tdash-health-score__popover-list tdash-health-score__popover-list--bands">
            <li>
              <span className="tdash-health-score__dot tdash-health-score__dot--good" aria-hidden />{' '}
              <strong>Above 80</strong> — generally healthy structure
            </li>
            <li>
              <span className="tdash-health-score__dot tdash-health-score__dot--warn" aria-hidden />{' '}
              <strong>60–80</strong> — needs attention on one or more dimensions
            </li>
            <li>
              <span className="tdash-health-score__dot tdash-health-score__dot--risk" aria-hidden />{' '}
              <strong>Below 60</strong> — elevated risk; prioritise remediation
            </li>
          </ul>
          <p className="tdash-health-score__popover-foot">Hover to preview, or click to pin. Esc or click outside closes when pinned.</p>
        </div>
      ) : null}
    </div>
  )
}
