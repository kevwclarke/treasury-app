import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { formatGBP } from '../utils/treasuryFormat'
import {
  buildCashflowMonthlySeries,
  cashflowWeeklyLowCashWarning,
  computeCashflowSummary,
  detectRecurringTransactions,
  seriesToBarHeights,
} from '../utils/treasuryCashflow'
import { buildCashflowCapitalMoves } from '../utils/capitalMovesFromData'
import { ModuleCapitalMoves } from '../components/ModuleCapitalMoves'
import { TermTooltip } from '../components/TermTooltip'
import { TransactionList, TransactionRow } from '../components/TransactionRow'
import '../components/DetailPage.css'
import './CashFlowPage.css'

const RECURRING = [
  { payee: 'Slack Technologies', amount: 420, frequency: 'Monthly', next: '2026-04-22', category: 'Infrastructure', on: true },
  { payee: 'Google Workspace', amount: 1180, frequency: 'Monthly', next: '2026-04-28', category: 'Infrastructure', on: true },
  { payee: 'Deel Inc', amount: 84200, frequency: 'Monthly', next: '2026-04-30', category: 'Payroll', on: true },
]

export function CashFlowPage() {
  const { rows, loading } = useUserTransactions()
  const rec = RECURRING

  const summary = useMemo(() => computeCashflowSummary(rows), [rows])
  const monthlySeries = useMemo(() => buildCashflowMonthlySeries(rows, summary, 90), [rows, summary])
  const bars = useMemo(() => seriesToBarHeights(monthlySeries), [monthlySeries])
  const lowCash = useMemo(() => cashflowWeeklyLowCashWarning(summary, 13), [summary])
  const recurringDetected = useMemo(() => detectRecurringTransactions(rows), [rows])

  const capitalMoves = useMemo(
    () => buildCashflowCapitalMoves({ summary, lowCash }),
    [lowCash, summary],
  )

  return (
    <div className="detail-page">
      <ModuleCapitalMoves actions={capitalMoves} />

      <header className="detail-hero">
        <h1 className="detail-title">Cash Flow Forecast</h1>
        <p className="detail-sub">
          Average inflows and outflows from your import, monthly net movement, and whether the trajectory hits a low-cash
          week — so you can act before payroll or receipts misalign.
        </p>
      </header>

      <section className="detail-section">
        <h2 className="detail-section__title">Headline stats</h2>
        {loading ? (
          <p className="detail-muted">Loading…</p>
        ) : (
          <div className="detail-grid3">
            <div className="detail-stat">
              <p className="detail-stat__cap">Average monthly inflow</p>
              <p className="detail-stat__val detail-stat__val--green">{formatGBP(Math.round(summary.avgMonthlyIn))}</p>
            </div>
            <div className="detail-stat">
              <p className="detail-stat__cap">Average monthly outflow</p>
              <p className="detail-stat__val detail-stat__val--red">{formatGBP(Math.round(summary.avgMonthlyOut))}</p>
            </div>
            <div className="detail-stat">
              <p className="detail-stat__cap">Net monthly position</p>
              <p className="detail-stat__val">{formatGBP(Math.round(summary.netMonthly))}</p>
            </div>
          </div>
        )}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Monthly net movement</h2>
        <p className="detail-section__lead">
          Actuals from your file, then projected months using average in − out. Shaded bars are projected.{' '}
          <TermTooltip term="capital-moves" label="Capital Moves" /> above flags urgent cash timing risks.
        </p>
        {!rows.length ? (
          <p className="detail-muted">
            <Link to="/upload">Upload Bank Statement</Link> to build this chart from your data.
          </p>
        ) : (
          <div
            className="cf-page-chart"
            role="img"
            aria-label="Monthly net cash movement; shaded bars are projected from averages"
          >
            {bars.map((m) => (
              <div key={m.key} className="cf-page-col">
                <div
                  className={`cf-page-bar${m.proj ? ' cf-page-bar--proj' : ''}${m.neg ? ' cf-page-bar--neg' : ''}`}
                  style={{ height: `${m.hPct}%` }}
                />
                <span className="cf-page-lab">{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {lowCash && rows.length ? (
        <section className="detail-section">
          <h2 className="detail-section__title">Low cash warning</h2>
          <div className="detail-warn detail-warn--red">
            Projected balance within the forecast window falls below roughly one month of average outflow (
            {formatGBP(Math.round(summary.avgMonthlyOut))}). Review timing of inflows and{' '}
            <Link to="/app/liquidity">liquidity buffer</Link>.
          </div>
        </section>
      ) : null}

      <section className="detail-section">
        <h2 className="detail-section__title">Recurring transactions</h2>
        {recurringDetected.length ? (
          <TransactionList>
            {recurringDetected.map((r) => (
              <TransactionRow
                key={r.payee}
                direction="out"
                payee={r.payee}
                meta={`${r.frequency} · Next ${r.nextExpected}`}
                amountText={formatGBP(Math.round(r.amount))}
              />
            ))}
          </TransactionList>
        ) : (
          <TransactionList>
            {rec.map((r) => (
              <TransactionRow
                key={r.payee}
                direction="out"
                payee={r.payee}
                meta={`${r.frequency} · Next ${r.next} · ${r.category}`}
                amountText={formatGBP(r.amount)}
              />
            ))}
          </TransactionList>
        )}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Deeper forecast</h2>
        <p className="detail-section__lead">
          Connect accounting in <Link to="/app/integrations">Integrations</Link> to layer invoices and bills on top of
          this view.
        </p>
      </section>
    </div>
  )
}
