import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { TenantProvider } from "./dashboard/TenantProvider";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { ScanRedirectPage } from "./pages/ScanRedirectPage";
import { AnalyticsPage } from "./pages/dashboard/AnalyticsPage";
import { DashboardLayout } from "./pages/dashboard/DashboardLayout";
import { NfcPage } from "./pages/dashboard/NfcPage";
import { OverviewPage } from "./pages/dashboard/OverviewPage";
import { ProfilePage } from "./pages/dashboard/ProfilePage";
import { QrPage } from "./pages/dashboard/QrPage";
import { SettingsPage } from "./pages/dashboard/SettingsPage";
import { TeamPage } from "./pages/dashboard/TeamPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/scan/:publicToken" element={<ScanRedirectPage />} />
      <Route path="/t/:slug" element={<PublicProfilePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <TenantProvider>
              <DashboardLayout />
            </TenantProvider>
          </RequireAuth>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="nfc" element={<NfcPage />} />
        <Route path="qr" element={<QrPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
