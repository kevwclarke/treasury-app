/** Shared product catalogue for Yield + Opportunities pages. */
export const YIELD_MARKETPLACE_PRODUCTS = [
  {
    rank: 1,
    name: 'UK T-Bills 91-day',
    provider: 'UK Debt Management Office',
    type: 'T-bill',
    ratePct: 5.25,
    fscs: false,
    fscsLabel: 'Not FSCS',
    liquidity: '91 day',
    applyUrl: 'https://www.dmo.gov.uk/',
    description:
      'Short-dated UK government bills with quarterly liquidity windows. Consider operational cash segmentation before sizing.',
    minDeposit: '£1,000+',
  },
  {
    rank: 2,
    name: 'BlackRock Liquidity Fund',
    provider: 'BlackRock',
    type: 'Money market',
    ratePct: 5.12,
    fscs: false,
    fscsLabel: 'Not FSCS',
    liquidity: 'Same day',
    applyUrl: 'https://www.blackrock.com/',
    description:
      'AAA-rated liquidity fund sleeve for operating balances with same-day dealing subject to cut-offs.',
    minDeposit: '£1',
  },
  {
    rank: 3,
    name: 'Shawbrook 12-mo Fixed',
    provider: 'Shawbrook Bank',
    type: 'Fixed term',
    ratePct: 4.95,
    fscs: true,
    fscsLabel: 'FSCS',
    liquidity: '12 month',
    applyUrl: 'https://www.shawbrook.co.uk/',
    description: 'Fixed-term deposit with FSCS protection per institution up to £120,000.',
    minDeposit: '£1,000',
  },
  {
    rank: 4,
    name: 'Flagstone Platform',
    provider: 'Flagstone',
    type: 'Multi-bank',
    ratePct: 4.8,
    fscs: true,
    fscsLabel: 'FSCS per institution',
    liquidity: 'Same day (platform)',
    applyUrl: 'https://www.flagstone.com/',
    description: 'Cash platform spreading balances across multiple authorised deposit-takers for FSCS stacking.',
    minDeposit: '£50,000',
  },
  {
    rank: 5,
    name: 'Allica Bank 95-day Notice',
    provider: 'Allica Bank',
    type: 'Notice account',
    ratePct: 4.65,
    fscs: true,
    fscsLabel: 'FSCS',
    liquidity: '95 day notice',
    applyUrl: 'https://www.allica.bank/',
    description: 'Notice savings with competitive yield and FSCS protection within limits.',
    minDeposit: '£10,000',
  },
  {
    rank: 6,
    name: 'Chase Business Saver',
    provider: 'Chase',
    type: 'Instant access',
    ratePct: 3.5,
    fscs: true,
    fscsLabel: 'FSCS',
    liquidity: 'Instant access',
    applyUrl: 'https://www.chase.co.uk/',
    description: 'Instant-access business saver for surplus operating cash within FSCS limits.',
    minDeposit: '£1',
  },
]

/** Rows with Apply on the main Treasury Autopilot yield gap table (order preserved). */
const YIELD_GAP_DASHBOARD_APPLY_NAMES = [
  'Shawbrook 12-mo Fixed',
  'UK T-Bills 91-day',
  'BlackRock Liquidity Fund',
  'Flagstone Platform',
]

export function getYieldGapDashboardApplyProducts() {
  return YIELD_GAP_DASHBOARD_APPLY_NAMES.map((name) => YIELD_MARKETPLACE_PRODUCTS.find((p) => p.name === name)).filter(
    Boolean,
  )
}
