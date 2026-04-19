# Project context

**Product:** Treasury intelligence SaaS for CFOs and Finance Directors at funded startups

**Stack:** React, Supabase, Vercel

**Supabase URL:** https://wahnitwoudpdlszlgdvw.supabase.co

## Pages built so far

**Public**

- Landing / waitlist at `/`
- Login at `/login`

**Authenticated (shell: dark sidebar + cream main — same layout for all below)**

- Treasury dashboard (overview cards) at `/app`
- CSV upload at `/upload`

**Intelligence (full detail pages)**

- Yield Optimisation at `/app/yield`
- Concentration Risk at `/app/concentration`
- Runway & Burn at `/app/runway`
- Cash Flow Forecast at `/app/cashflow`
- FX Exposure at `/app/fx`
- Opportunities (marketplace) at `/app/opportunities`

**Advanced**

- Scenario Modeller at `/app/scenarios`
- Peer Benchmarks at `/app/benchmarks`
- Term Sheet Cash Impact at `/app/term-sheet-cash-impact`
- AR Ageing at `/app/ar`
- Tax Tracker at `/app/tax`

**Reports**

- Investor Report at `/app/report`
- Fundraise Timing at `/app/fundraise`

**Legacy redirects (old paths → canonical URLs above):** e.g. `/app/yield-optimisation` → `/app/yield`, `/app/cash-flow` → `/app/cashflow`, and similar for other former slugs.

## Design style

FT meets Bloomberg. Salmon pink and cream tones, dark text, clean editorial typography.

## Modules to build (in order)

1. CSV upload and parser
2. Yield gap calculation
3. Concentration risk
4. Runway modelling
5. Burn rate breakdown
6. Cash flow forecast
7. AI actions layer

---

**Every future Cursor session should start with:** read CONTEXT.md first.
