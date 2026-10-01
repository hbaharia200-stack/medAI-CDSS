import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from './state/useAuthStore';
import LandingPage from './pages/LandingPage';
import SignInPage from './pages/auth/SignInPage';
import AdminSignInPage from './pages/auth/AdminSignInPage';
import SignUpPage from './pages/auth/SignUpPage';
import ServicesPage from './pages/marketing/ServicesPage';
import SpecialistsPage from './pages/marketing/SpecialistsPage';
import AboutPage from './pages/marketing/AboutPage';
import ContactPage from './pages/marketing/ContactPage';
import AppointmentPage from './pages/marketing/AppointmentPage';
import AppLayout from './components/layout/AppLayout';
import BasicDashboard from './pages/doctor/BasicDashboard';
import PatientsDashboard from './pages/doctor/PatientsDashboard';
import DiagnosisDashboard from './pages/doctor/DiagnosisDashboard';
import PatientDiagnosisDetail from './pages/doctor/PatientDiagnosisDetail';
import AppointmentDashboard from './pages/doctor/AppointmentDashboard';
import StatisticsPage from './pages/StatisticsPage';
import SchedulePage from './pages/SchedulePage';
import MessagesPage from './pages/messages/MessagesPage';
import BillingsPage from './pages/BillingsPage';
import SettingsPage from './pages/SettingsPage';
import DevicesPage from './pages/devices/DevicesPage';
import DeviceDetailsPage from './pages/devices/DeviceDetailsPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import SystemHealthPage from './pages/admin/SystemHealthPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import AuditLogPage from './pages/admin/AuditLogPage';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);
  const location = useLocation();
  if (loading) return <div className="flex h-screen w-full items-center justify-center bg-canvas"><span className="text-ink-muted">Loading…</span></div>;
  if (!isAuthenticated) return <Navigate to="/sign-in" state={{ from: location.pathname }} replace />;
  return children;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);
  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return children;
}

/**
 * Admin-only gate.
 *
 * The backend still enforces authorization with `@role_guard` on every admin
 * route, so this is a navigation guard, not the security boundary. It stops a
 * doctor/nurse from landing on an admin screen, and a non-admin from even
 * seeing these pages in the router.
 */
function AdminRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);
  if (loading) {
    return <div className="flex h-screen w-full items-center justify-center bg-canvas"><span className="text-ink-muted">Loading…</span></div>;
  }
  if (!isAuthenticated) return <Navigate to="/sign-in" replace />;
  if (user?.role !== 'admin') return <Navigate to="/app" replace />;
  return children;
}

function PageFade({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export function AppRoutes() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const restored = useAuthStore((s) => s.loading === false);
  const location = useLocation();
  if (!restored) void restoreSession();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PublicRoute><PageFade><LandingPage /></PageFade></PublicRoute>} />
        <Route path="/sign-in" element={<PublicRoute><SignInPage /></PublicRoute>} />
        {/* Admin password sign-in, kept off the normal staff screen. */}
        <Route path="/admin/sign-in" element={<PublicRoute><AdminSignInPage /></PublicRoute>} />
        <Route path="/sign-up" element={<PublicRoute><SignUpPage /></PublicRoute>} />

        {/* Public marketing pages — visible whether or not the user is signed in */}
        <Route path="/services" element={<PageFade><ServicesPage /></PageFade>} />
        <Route path="/specialists" element={<PageFade><SpecialistsPage /></PageFade>} />
        <Route path="/about" element={<PageFade><AboutPage /></PageFade>} />
        <Route path="/contact" element={<PageFade><ContactPage /></PageFade>} />
        <Route path="/appointment" element={<PageFade><AppointmentPage /></PageFade>} />

      {/* Protected routes with AppLayout (sidebar + topnav) */}
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<BasicDashboard />} />
        <Route path="patients" element={<PatientsDashboard />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="devices/:deviceId" element={<DeviceDetailsPage />} />
        <Route path="diagnosis" element={<DiagnosisDashboard />} />
        <Route path="diagnosis/:caseId" element={<PatientDiagnosisDetail />} />
        <Route path="appointments" element={<AppointmentDashboard />} />
        <Route path="statistics" element={<StatisticsPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="billings" element={<BillingsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Admin-only area. These pages render their own Sidebar/TopNav and are
          never reachable by doctor/nurse/patient (see AdminRoute). */}
      <Route path="/admin" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
      <Route path="/admin/system" element={<AdminRoute><SystemHealthPage /></AdminRoute>} />
      <Route path="/admin/analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
      <Route path="/admin/audit" element={<AdminRoute><AuditLogPage /></AdminRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default AppRoutes;

