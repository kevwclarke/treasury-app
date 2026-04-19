import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from './components/DashboardLayout'
import { LandingPage } from './components/LandingPage'
import { LoginPage } from './components/LoginPage'
import { ModulePlaceholder } from './components/ModulePlaceholder'
import { ProtectedRoute } from './components/ProtectedRoute'
import { TreasuryDashboard } from './components/TreasuryDashboard'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<TreasuryDashboard />} />
            <Route
              path="yield-optimisation"
              element={<ModulePlaceholder title="Yield Optimisation" />}
            />
            <Route
              path="concentration-risk"
              element={<ModulePlaceholder title="Concentration Risk" />}
            />
            <Route path="runway-burn" element={<ModulePlaceholder title="Runway & Burn" />} />
            <Route path="cash-flow" element={<ModulePlaceholder title="Cash Flow" />} />
            <Route path="fx-exposure" element={<ModulePlaceholder title="FX Exposure" />} />
            <Route path="opportunities" element={<ModulePlaceholder title="Opportunities" />} />
            <Route path="scenario-modeller" element={<ModulePlaceholder title="Scenario Modeller" />} />
            <Route path="peer-benchmarks" element={<ModulePlaceholder title="Peer Benchmarks" />} />
            <Route
              path="term-sheet-cash-impact"
              element={<ModulePlaceholder title="Term Sheet Cash Impact" />}
            />
            <Route path="ar-ageing" element={<ModulePlaceholder title="AR Ageing" />} />
            <Route path="tax-tracker" element={<ModulePlaceholder title="Tax Tracker" />} />
            <Route path="investor-report" element={<ModulePlaceholder title="Investor Report" />} />
            <Route path="fundraise-timing" element={<ModulePlaceholder title="Fundraise Timing" />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
