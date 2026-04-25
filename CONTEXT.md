# Project context

**Product:** Treasury Autopilot — a workspace for CFOs and Finance Directors at funded startups that maintains runway automatically and surfaces pound-ranked actions (yield, liquidity, concentration, burn).

**Stack:** React, Supabase, Vercel

**Supabase URL:** https://wahnitwoudpdlszlgdvw.supabase.co

## Pages built so far

**Public**

- Landing / early access at `/`
- Login at `/login`
- Sign up at `/signup`

**Authenticated (shell: deep blue-black sidebar `#0A0A1A` + white main — same layout for all below)**

- Treasury Autopilot (main overview) at `/app`
- Cash Control (simplified runway / yield / FX stack) at `/app/control`
- CSV upload at `/upload`

**Detail modules (full pages)**

- Yield Optimisation at `/app/yield`
- Concentration Risk at `/app/concentration`
- Runway & Burn at `/app/runway`
- Burn Intelligence at `/app/burn-intelligence`
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

Royal blue brand (`#1B2B8C`) on white: CTAs, links, positive runway/inflows, and sidebar active state; red for opportunity cost and material negatives; amber only for warning-severity alerts. Typography is Inter throughout (Google Fonts), with a premium SaaS scale for headings, KPI numerals, and muted body copy.

## Product vision

**Treasury Autopilot** maintains the CFO’s runway automatically, quantifies idle-cash and other leaks in pounds, and recommends specific next moves with impact and cost of inaction. This is the product positioning (not a generic “treasury intelligence” dashboard).

**Autopilot Recommendations (dashboard)** are treasury-only: yield, FSCS protection, FX, and cash structure. **Burn Intelligence** is spend-only: vendors, subscriptions, contractors, and operational efficiency — no yield or cash-placement advice. The two AI prompts are scoped so they do not overlap.

## Modules to build (in order)

1. CSV upload and parser
2. Yield gap calculation
3. Concentration risk
4. Runway modelling
5. Burn rate breakdown
6. Cash flow forecast
7. Autopilot recommendations layer (AI-ranked actions)

---

**Every future Cursor session should start with:** read CONTEXT.md first.
