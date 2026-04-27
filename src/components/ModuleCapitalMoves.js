import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatGBP } from '../utils/treasuryFormat'
import { TermTooltip } from './TermTooltip'
import './ModuleCapitalMoves.css'

/**
 * @typedef {{
 *   id: string,
 *   titleCaps: string,
 *   description: string,
 *   who: string,
 *   time: string,
 *   impactGbpYear: number,
 *   costWaiting30: number,
 *   primaryLabel: string,
 *   primaryHref?: string,
 *   onPrimary?: () => void,
 *   secondaryLabel?: string,
 *   secondaryHref?: string,
 *   onSecondaryClick?: () => void,
 *   onMark?: () => void,
 *   markLabel?: string,
 * }} CapitalMoveAction
 */

export function ModuleCapitalMoves({ actions = [] }) {
  const [dismissed, setDismissed] = useState(() => new Set())
  const visible = useMemo(
    () => actions.filter((a) => a && a.id && !dismissed.has(a.id)),
    [actions, dismissed],
  )

  const dismiss = useCallback((id) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  if (!visible.length) return null

  return (
    <section className="cmoves" aria-labelledby="capital-moves-module-heading">
      <h2 id="capital-moves-module-heading" className="cmoves__title">
        <span className="cmoves__title-text">Capital Moves</span>{' '}
        <TermTooltip term="capital-moves" label="" />
      </h2>
      <div className="cmoves__list">
        {visible.map((a) => (
          <article key={a.id} className="cmoves__card">
            <h3 className="cmoves__action-title">{a.titleCaps}</h3>
            <p className="cmoves__desc">{a.description}</p>
            <div className="cmoves__grid">
              <div>
                <p className="cmoves__field-cap">Who</p>
                <p className="cmoves__field-val">{a.who}</p>
              </div>
              <div>
                <p className="cmoves__field-cap">Time</p>
                <p className="cmoves__field-val">{a.time}</p>
              </div>
              <div>
                <p className="cmoves__field-cap">Impact</p>
                <p className="cmoves__field-val cmoves__field-val--impact">
                  {formatGBP(Math.round(a.impactGbpYear || 0))} / year
                </p>
              </div>
              <div>
                <p className="cmoves__field-cap">Cost of waiting</p>
                <p className="cmoves__field-val cmoves__field-val--cost">
                  {formatGBP(Math.round(a.costWaiting30 || 0))} in the next 30 days
                </p>
              </div>
            </div>
            <div className="cmoves__actions">
              {a.primaryHref ? (
                <Link className="cmoves__btn cmoves__btn--primary" to={a.primaryHref}>
                  {a.primaryLabel}
                </Link>
              ) : a.onPrimary ? (
                <button type="button" className="cmoves__btn cmoves__btn--primary" onClick={a.onPrimary}>
                  {a.primaryLabel}
                </button>
              ) : null}
              {a.secondaryHref && a.secondaryLabel ? (
                <a
                  className="cmoves__btn cmoves__btn--ghost"
                  href={a.secondaryHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    a.onSecondaryClick?.()
                  }}
                >
                  {a.secondaryLabel}
                </a>
              ) : null}
              {a.onMark ? (
                <button type="button" className="cmoves__btn cmoves__btn--text" onClick={a.onMark}>
                  {a.markLabel || 'Mark actioned'}
                </button>
              ) : null}
              <button type="button" className="cmoves__btn cmoves__btn--ghost" onClick={() => dismiss(a.id)}>
                Dismiss
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
