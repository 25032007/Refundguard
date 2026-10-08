import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';
import TriagePage from './features/triage/TriagePage.jsx';
import RingsPage from './features/rings/RingsPage.jsx';
import InvestigationPage from './features/investigation/InvestigationPage.jsx';
import SystemPage from './features/system/SystemPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/triage" element={<TriagePage />} />
        <Route path="/rings" element={<RingsPage />} />
        <Route path="/rings/:ringId" element={<RingsPage />} />
        <Route path="/investigations/:id" element={<InvestigationPage />} />
        <Route path="/system" element={<SystemPage />} />
        <Route path="/metrics" element={<Navigate to="/system" replace />} />
      </Route>
    </Routes>
  );
}