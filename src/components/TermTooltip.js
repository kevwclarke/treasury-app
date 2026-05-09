import './TermTooltip.css'

const GLOSSARY = {
  'yield-gap':
    'The difference between what your cash earns now and what it could earn at the same liquidity level.',
  fscs: 'The UK government scheme that protects up to £120,000 of deposits per bank (from December 2025) if a bank fails.',
  'liquidity-buffer': 'How many months of instantly accessible cash you have to cover operating costs.',
  'concentration-risk': 'How much of your total cash sits in a single bank — a risk if that bank fails.',
  runway: 'How many months your company can operate before running out of cash at current burn rate.',
  'burn-rate': 'Your average monthly cash outflow — what it costs to run the company each month.',
  mmf: 'A low-risk investment fund that holds short-term government debt — same-day access, higher yield than a current account.',
  aer: 'Annual Equivalent Rate — the yearly interest rate you earn on a savings product.',
  'capital-moves': 'Your highest-impact treasury decisions calculated from your real financial data.',
  'priority-actions':
    'Specific spend reduction opportunities identified from your transaction patterns.',
  'cash-flow':
    'Expected money in and out over the coming months — based on your imports — so you can spot a cash crunch before it hits.',
  opportunities:
    'Curated treasury products and rates (e.g. deposits, MMFs) you can compare or act on from your cash position.',
  'scenario-modeller':
    'What-if tool: change burn, hiring, or revenue assumptions and see how runway and cash respond before you commit.',
  'peer-benchmarks':
    'Anonymous comparison of your treasury metrics (runway, yield, concentration) against similar UK startups.',
  'ar-ageing':
    'Money owed to you on invoices — how old open receivables are and how much is still outstanding.',
  'tax-tracker':
    'Upcoming corporation tax and VAT-style liabilities inferred from your data so large payments do not surprise you.',
  'investor-report':
    'One-click pack for investors: cash, runway, concentration, and key treasury metrics from live figures.',
  'fundraise-timing':
    'How many months of runway you have versus how long a typical raise takes — to time your next round.',
  'term-sheet-analysis':
    'Estimate post-close cash and runway from headline investment terms before you sign.',
  preferences:
    'Treasury policies, email and Slack notification settings, and an audit trail of important changes.',
  integrations:
    'Connections to accounting (Xero), open banking (TrueLayer), and Slack for alerts — expand what the app can see.',
}

export function TermTooltip({ term, label }) {
  const text = GLOSSARY[term] || ''
  if (!text) return null
  return (
    <span className="term-tip" tabIndex={0}>
      {label ? <span className="term-tip__label">{label}</span> : null}
      <span className="term-tip__icon" aria-hidden>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
          <path d="M12 10v6M12 8h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </span>
      <span className="term-tip__bubble" role="tooltip">
        {text}
      </span>
    </span>
  )
}
