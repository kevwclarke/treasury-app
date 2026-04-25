import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import { computeYieldApplyFigures } from '../utils/treasuryYieldApply'
import { logYieldApplyConfirmedToAudit } from '../utils/logYieldApplyAudit'
import './YieldApplyConfirmModal.css'

function fmtMo(m) {
  if (m == null || !Number.isFinite(m)) return '—'
  return `${m.toLocaleString('en-GB', { maximumFractionDigits: 1 })} mo`
}

export function YieldApplyConfirmModal({
  open,
  product,
  liquidity,
  currentYieldDec,
  source,
  onClose,
}) {
  const confirmRef = useRef(null)

  const figures = useMemo(() => {
    if (!product || !liquidity) return null
    const productRateDec = Number(product.ratePct) / 100
    if (!Number.isFinite(productRateDec)) return null
    return computeYieldApplyFigures({
      liquidity,
      productRateDec,
      currentYieldDec: Number(currentYieldDec) || 0,
    })
  }, [product, liquidity, currentYieldDec])

  useEffect(() => {
    if (!open) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => confirmRef.current?.focus(), 50)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open, onClose])

  if (!open || !product || !figures) return null

  const handleConfirm = async () => {
    await logYieldApplyConfirmedToAudit(product.name, {
      source,
      provider: product.provider,
      recommended_gbp: figures.recommendedGbp,
      annual_gain_gbp: figures.annualGainGbp,
    })
    if (product.applyUrl) {
      window.open(product.applyUrl, '_blank', 'noopener,noreferrer')
    }
    onClose()
  }

  const node = (
    <div className="yam-backdrop" role="presentation" onClick={onClose}>
      <div
        className="yam-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="yam-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="yam-title" className="yam-title">
          Confirm yield move
        </h2>
        <p className="yam-product">
          <span className="yam-product-name">{product.name}</span>
          <span className="yam-product-meta">{product.provider}</span>
        </p>

        <div className="yam-grid">
          <div className="yam-cell">
            <span className="yam-cap">Recommended amount to move</span>
            <span className="yam-val">{formatGBP(figures.recommendedGbp)}</span>
            <span className="yam-note">Cash above your 6-month liquidity target from imported activity</span>
          </div>
          <div className="yam-cell">
            <span className="yam-cap">Current yield on that amount (annual)</span>
            <span className="yam-val">{formatGBP(figures.currentAnnualGbp)}</span>
            <span className="yam-note">At {formatPct(currentYieldDec * 100, 2)} on the moved slice</span>
          </div>
          <div className="yam-cell">
            <span className="yam-cap">New yield on that amount (annual)</span>
            <span className="yam-val">{formatGBP(figures.newAnnualGbp)}</span>
            <span className="yam-note">At {formatPct(product.ratePct, 2)} headline rate (illustrative)</span>
          </div>
        </div>

        <div className="yam-gain">
          <span className="yam-gain-cap">Annual gain</span>
          <span className="yam-gain-val">{formatGBP(figures.annualGainGbp)}</span>
          <span className="yam-gain-sub">per year on the recommended move, before tax and fees</span>
        </div>

        <div className="yam-impact">
          <div>
            <span className="yam-cap">Liquidity buffer after move</span>
            <p className="yam-impact-text">
              <strong>{fmtMo(figures.bufferMonthsAfter)}</strong> of cover on operating cash remaining on your import
              {figures.bufferMonthsBefore != null ? (
                <>
                  {' '}
                  (today: <strong>{fmtMo(figures.bufferMonthsBefore)}</strong>)
                </>
              ) : null}
              .
            </p>
          </div>
          <div>
            <span className="yam-cap">Runway impact</span>
            <p className="yam-impact-text">{figures.runwayImpactLabel}</p>
          </div>
        </div>

        <div className="yam-actions">
          <button type="button" className="yam-btn yam-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" className="yam-btn yam-btn--confirm" onClick={handleConfirm}>
            Confirm and Apply
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
