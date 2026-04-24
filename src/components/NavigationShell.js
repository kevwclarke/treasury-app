import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DashboardLayout } from './DashboardLayout'
import { LandingPage } from './LandingPage'
import { LoginPage } from './LoginPage'
import { SignUpPage } from './SignUpPage'
import { ProtectedRoute } from './ProtectedRoute'
import { RequireCompanyProfile } from './RequireCompanyProfile'
import { TreasuryDashboard } from './TreasuryDashboard'
import { UploadPage } from './UploadPage'
import { ArAgeingPage } from '../pages/ArAgeingPage'
import { CashFlowPage } from '../pages/CashFlowPage'
import { ConcentrationRiskPage } from '../pages/ConcentrationRiskPage'
import { FundraiseTimingPage } from '../pages/FundraiseTimingPage'
import { FxExposurePage } from '../pages/FxExposurePage'
import { InvestorReportPage } from '../pages/InvestorReportPage'
import { OpportunitiesPage } from '../pages/OpportunitiesPage'
import { PeerBenchmarksPage } from '../pages/PeerBenchmarksPage'
import { LiquidityBufferPage } from '../pages/LiquidityBufferPage'
import { RunwayBurnPage } from '../pages/RunwayBurnPage'
import { ScenarioModellerFullPage } from '../pages/ScenarioModellerFullPage'
import { TaxTrackerPage } from '../pages/TaxTrackerPage'
import { TermSheetCashPage } from '../pages/TermSheetCashPage'
import { YieldOptimisationPage } from '../pages/YieldOptimisationPage'
import { PrivacyPolicyPage } from '../pages/PrivacyPolicyPage'
import { CompanyOnboardingPage } from '../pages/CompanyOnboardingPage'
import { ProfilePage } from '../pages/ProfilePage'
import './NavigationShell.css'

export function NavigationShell() {
  const location = useLocation()

  return (
    <div className="app-route-fade" key={location.pathname}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/onboarding" element={<ProtectedRoute />}>
          <Route index element={<CompanyOnboardingPage />} />
        </Route>
        <Route path="/app" element={<ProtectedRoute />}>
          <Route element={<RequireCompanyProfile />}>
            <Route element={<DashboardLayout />}>
              <Route index element={<TreasuryDashboard />} />
              <Route path="yield" element={<YieldOptimisationPage />} />
              <Route path="concentration" element={<ConcentrationRiskPage />} />
              <Route path="runway" element={<RunwayBurnPage />} />
              <Route path="liquidity" element={<LiquidityBufferPage />} />
              <Route path="cashflow" element={<CashFlowPage />} />
              <Route path="fx" element={<FxExposurePage />} />
              <Route path="opportunities" element={<OpportunitiesPage />} />
              <Route path="scenarios" element={<ScenarioModellerFullPage />} />
              <Route path="benchmarks" element={<PeerBenchmarksPage />} />
              <Route path="term-sheet-cash-impact" element={<TermSheetCashPage />} />
              <Route path="ar" element={<ArAgeingPage />} />
              <Route path="tax" element={<TaxTrackerPage />} />
              <Route path="report" element={<InvestorReportPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="fundraise" element={<FundraiseTimingPage />} />
              <Route path="yield-optimisation" element={<Navigate to="/app/yield" replace />} />
              <Route path="concentration-risk" element={<Navigate to="/app/concentration" replace />} />
              <Route path="runway-burn" element={<Navigate to="/app/runway" replace />} />
              <Route path="cash-flow" element={<Navigate to="/app/cashflow" replace />} />
              <Route path="fx-exposure" element={<Navigate to="/app/fx" replace />} />
              <Route path="scenario-modeller" element={<Navigate to="/app/scenarios" replace />} />
              <Route path="peer-benchmarks" element={<Navigate to="/app/benchmarks" replace />} />
              <Route path="ar-ageing" element={<Navigate to="/app/ar" replace />} />
              <Route path="tax-tracker" element={<Navigate to="/app/tax" replace />} />
              <Route path="investor-report" element={<Navigate to="/app/report" replace />} />
              <Route path="fundraise-timing" element={<Navigate to="/app/fundraise" replace />} />
            </Route>
          </Route>
        </Route>
        <Route path="/upload" element={<ProtectedRoute />}>
          <Route element={<RequireCompanyProfile />}>
            <Route element={<DashboardLayout />}>
              <Route index element={<UploadPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
