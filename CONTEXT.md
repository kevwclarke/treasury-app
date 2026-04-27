# Project context

**Product:** Treasury Autopilot — we maintain the CFO’s runway automatically.

**Stack:** React, Supabase, Vercel

**Supabase URL:** https://wahnitwoudpdlszlgdvw.supabase.co

## Routes (current)

**Public**

- Landing / early access at `/`
- Login at `/login`
- Sign up at `/signup`
- Privacy policy at `/privacy`

**Authenticated (shell: deep blue-black sidebar `#0A0A1A` + white main — same layout for all below)**

- Treasury Autopilot (main overview) at `/app`
- Cash Control (simplified runway / yield / FX stack) at `/app/control`
- CSV upload at `/upload`
- Profile at `/app/profile`

**Detail modules (full pages)**

- Yield Optimisation at `/app/yield`
- Concentration Risk at `/app/concentration`
- Runway & Burn at `/app/runway`
- Burn Intelligence at `/app/burn-intelligence`
- Cash Flow Forecast at `/app/cashflow`
- FX Exposure at `/app/fx`
- Liquidity Buffer at `/app/liquidity`
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

## Design system (non-negotiables)

- **Primary brand colour:** `#1B2B8C` (royal blue)
- **Sidebar background:** `#0A0A1A` (deep blue-black)
- **Font:** Inter throughout
- **No emojis anywhere in the UI**

## Product vision

- **Treasury Autopilot** maintains the CFO’s runway automatically.
- **Intelligence layer:** live.
- **Execution layer:** the roadmap.
- **Never use the word “AI” in the UI.** Treasury actions are called **Capital Moves**. Spend reduction actions are called **Priority Actions**.

## Terminology (and scope)

- **Capital Moves** = treasury actions on the dashboard (yield optimisation, FSCS protection, FX hedging, cash structure). These must never be spend-reduction.
- **Priority Actions** = spend reduction in Burn Intelligence (vendor costs, contractor optimisation, SaaS rationalisation, operational efficiency). These must never be yield / cash-placement.

These two surfaces **never overlap**.

## Supabase tables (all RLS enabled)

- `transactions`
- `company_profiles`
- `burn_actions`
- `email_preferences`
- `treasury_policies`
- `audit_log`

## Modules status

- **All 16 modules are built as wireframes.**
- **Wired to real data:** Yield Gap, Concentration Risk, Runway, Burn Rate, Cash Flow, Liquidity Buffer, KPI Cards, Capital Moves, Burn Intelligence Priority Actions.

## Positioning

- **One-line pitch:** Most funded startups are losing £50,000–£200,000 a year in idle cash. We fix that — and maintain their runway automatically.
- **Language rules:** never say “treasury management platform”. Always say **treasury autopilot**.

---

**Every future Cursor session should start with:** read CONTEXT.md first.
