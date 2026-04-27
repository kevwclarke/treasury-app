import './TransactionRow.css'

function ArrowIcon({ inflow }) {
  if (inflow) {
    return (
      <svg className="txn-row__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 17L17 7M17 7H9M17 7V15"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg className="txn-row__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 7L7 17M7 17H15M7 17V9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * @param {{ direction?: 'in' | 'out', payee: string, meta: string, amountText: string }} props
 */
export function TransactionRow({ direction = 'out', payee, meta, amountText }) {
  const inflow = direction === 'in'
  return (
    <div className={`txn-row ${inflow ? 'txn-row--in' : 'txn-row--out'}`}>
      <div className={`txn-row__icon ${inflow ? 'txn-row__icon--in' : 'txn-row__icon--out'}`} aria-hidden>
        <ArrowIcon inflow={inflow} />
      </div>
      <div className="txn-row__body">
        <p className="txn-row__payee">{payee}</p>
        <p className="txn-row__meta">{meta}</p>
      </div>
      <p className={`txn-row__amt ${inflow ? 'txn-row__amt--in' : 'txn-row__amt--out'}`}>{amountText}</p>
    </div>
  )
}

export function TransactionList({ children }) {
  return <div className="txn-list">{children}</div>
}
