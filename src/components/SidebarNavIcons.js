/**
 * Sidebar nav icons — 18px, 1.5px stroke, round caps (no emoji).
 * Stroke colour inherits from parent (inactive / active nav text).
 */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const p = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true }

export function SidebarNavIcon({ name }) {
  switch (name) {
    case 'dashboard':
      /* Gauge / dial */
      return (
        <svg {...p} {...stroke}>
          <path d="M5 15a7 7 0 0114 0" />
          <path d="M12 15V11" />
          <path d="M9.5 8.5L12 11l2.5-2.5" />
        </svg>
      )
    case 'control':
      /* Sliders */
      return (
        <svg {...p} {...stroke}>
          <path d="M4 7h16M4 12h10M4 17h14" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="14" cy="17" r="2" />
        </svg>
      )
    case 'upload':
      return (
        <svg {...p} {...stroke}>
          <path d="M12 5v10M8 9l4-4 4 4" />
          <path d="M5 19h14" />
        </svg>
      )
    case 'yield':
      return (
        <svg {...p} {...stroke}>
          <path d="M4 18V14M9 18V10M14 18V6M19 18V3" />
        </svg>
      )
    case 'concentration':
      return (
        <svg {...p} {...stroke}>
          <path d="M12 3l7 3v6c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
        </svg>
      )
    case 'runway':
      return (
        <svg {...p} {...stroke}>
          <path d="M6 16a6 6 0 0112 0" />
          <path d="M12 16V12M10 10l2 2 2-2" />
          <path d="M4 18h16" />
        </svg>
      )
    case 'burn':
      return (
        <svg {...p} {...stroke}>
          <path d="M12 21c-2.5-1.2-4-3.5-4-6.2 0-2.5 1.5-4.5 2-6.5.8 1.5 1.5 3.2 2 5.2.3-1.8 1.2-3.2 2.5-4.2 1.3 2 2 4.2 2 6.7 0 2.7-1.5 5-4 6.2z" />
          <path d="M12 17.5c-1-.5-1.5-1.4-1.5-2.5 0-1 .5-1.8 1.5-2.3" />
        </svg>
      )
    case 'liquidity':
      return (
        <svg {...p} {...stroke}>
          <path d="M12 21a7 7 0 007-7c0-5-7-12-7-12S5 9 5 14a7 7 0 007 7z" />
        </svg>
      )
    case 'cashflow':
      return (
        <svg {...p} {...stroke}>
          <path d="M3 14c2.5-3 4.5-1 7-4s4.5-2 7 1 4.5 1 7-2" />
          <path d="M3 18h18" />
        </svg>
      )
    case 'fx':
      return (
        <svg {...p} {...stroke}>
          <circle cx="8" cy="10" r="2.5" />
          <circle cx="16" cy="14" r="2.5" />
          <path d="M13 5l2.5 2.5L13 10M11 19l-2.5-2.5L11 14" />
        </svg>
      )
    case 'opportunities':
      return (
        <svg {...p} {...stroke}>
          <path d="M12 3l2.2 4.5L19 8.5l-3.6 3.5L16.2 19 12 16.2 7.8 19l.8-7L5 8.5l4.8-.5L12 3z" />
        </svg>
      )
    case 'scenario':
      return (
        <svg {...p} {...stroke}>
          <path d="M5 6h3M5 12h3M5 18h3" />
          <path d="M11 8h8M11 14h8M11 20h5" />
          <circle cx="8.5" cy="6" r="1.75" />
          <circle cx="8.5" cy="12" r="1.75" />
          <circle cx="8.5" cy="18" r="1.75" />
        </svg>
      )
    case 'benchmarks':
      return (
        <svg {...p} {...stroke}>
          <circle cx="8" cy="8" r="2.5" />
          <circle cx="16" cy="8" r="2.5" />
          <path d="M4 19c0-2.5 2-4.5 4-4.5s4 2 4 4.5M12 19c0-2.5 2-4.5 4-4.5s4 2 4 4.5" />
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
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      )
    case 'tax':
      return (
        <svg {...p} {...stroke}>
          <path d="M7 4h10l1 3v13l-2-1-2 1-2-1-2 1-2-1-2 1V7l1-3z" />
          <path d="M9 9h6M9 12h4M9 15h5" />
        </svg>
      )
    case 'report':
      return (
        <svg {...p} {...stroke}>
          <path d="M7 4h10l3 3v13a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
          <path d="M10 12h4M10 15h3" />
          <path d="M10 9h2v2h-2z" />
        </svg>
      )
    case 'fundraise':
      return (
        <svg {...p} {...stroke}>
          <path d="M12 3c2 2 3.5 5 3.5 8.5a3.5 3.5 0 11-7 0C8.5 8 10 5 12 3z" />
          <path d="M10 12h4M12 12v6M9 19h6" />
        </svg>
      )
    case 'preferences':
      return (
        <svg {...p} {...stroke}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 20a7 7 0 0114 0" />
        </svg>
      )
    case 'integrations':
      return (
        <svg {...p} {...stroke}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M8 10h8M8 14h5" />
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
