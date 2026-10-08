import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TriagePage from './features/triage/TriagePage.jsx';
import RingsPage from './features/rings/RingsPage.jsx';
import InvestigationPage from './features/investigation/InvestigationPage.jsx';
import Metrics from './pages/Metrics.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/triage" replace />} />
      <Route element={<Layout />}>
        <Route path="/triage" element={<TriagePage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/rings" element={<RingsPage />} />
        <Route path="/rings/:ringId" element={<RingsPage />} />
        <Route path="/investigations/:id" element={<InvestigationPage />} />
        <Route path="/metrics" element={<Metrics />} />
      </Route>
    </Routes>
  );
}