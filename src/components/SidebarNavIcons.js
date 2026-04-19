const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.65,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function SidebarNavIcon({ name }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true }
  switch (name) {
    case 'dashboard':
      return (
        <svg {...p} {...stroke}>
          <rect x="3" y="3" width="7" height="9" rx="1.2" />
          <rect x="14" y="3" width="7" height="5" rx="1.2" />
          <rect x="14" y="11" width="7" height="10" rx="1.2" />
          <rect x="3" y="15" width="7" height="6" rx="1.2" />
        </svg>
      )
    case 'upload':
      return (
        <svg {...p} {...stroke}>
          <path d="M12 4v12M8 8l4-4 4 4" />
          <path d="M5 20h14" />
        </svg>
      )
    case 'yield':
      return (
        <svg {...p} {...stroke}>
          <path d="M4 18V9M9 18V5M14 18v-7M19 18v-11" />
        </svg>
      )
    case 'concentration':
      return (
        <svg {...p} {...stroke}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 12V4a8 8 0 018 8H12z" />
        </svg>
      )
    case 'runway':
      return (
        <svg {...p} {...stroke}>
          <path d="M4 18h16M6 14l4-8 4 5 4-9" />
          <circle cx="18" cy="5" r="1.5" />
        </svg>
      )
    case 'cashflow':
      return (
        <svg {...p} {...stroke}>
          <path d="M3 16c2-4 4-2 6-6s4 2 6-2 4 0 6-4" />
          <path d="M3 20h18" />
        </svg>
      )
    case 'fx':
      return (
        <svg {...p} {...stroke}>
          <circle cx="9" cy="9" r="3.5" />
          <circle cx="15" cy="15" r="3.5" />
          <path d="M6 18c1.5-3 4.5-5 8-6" />
        </svg>
      )
    case 'opportunities':
      return (
        <svg {...p} {...stroke}>
          <path d="M9 18h6M10 22h4M12 2v1M12 3a5 5 0 105 5" />
        </svg>
      )
    case 'scenario':
      return (
        <svg {...p} {...stroke}>
          <path d="M4 15h4M4 9h8M4 21h12" />
          <circle cx="16" cy="9" r="2" />
          <circle cx="10" cy="15" r="2" />
          <circle cx="18" cy="21" r="2" />
        </svg>
      )
    case 'benchmarks':
      return (
        <svg {...p} {...stroke}>
          <path d="M5 20V10M11 20V4M17 20v-8" />
        </svg>
      )
    case 'term':
      return (
        <svg {...p} {...stroke}>
          <path d="M7 4h10a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 012-2z" />
          <path d="M9 9h6M9 13h4" />
        </svg>
      )
    case 'ar':
      return (
        <svg {...p} {...stroke}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 3v4M16 3v4M4 11h16" />
        </svg>
      )
    case 'tax':
      return (
        <svg {...p} {...stroke}>
          <rect x="3" y="7" width="18" height="12" rx="2" />
          <path d="M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2" />
          <path d="M12 11v4M10 15h4" />
        </svg>
      )
    case 'report':
      return (
        <svg {...p} {...stroke}>
          <path d="M7 4h10l3 3v13a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      )
    case 'fundraise':
      return (
        <svg {...p} {...stroke}>
          <path d="M12 3l2 5h5l-4 3 2 6-5-3-5 3 2-6-4-3h5z" />
        </svg>
      )
    default:
      return (
        <svg {...p} {...stroke}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}
