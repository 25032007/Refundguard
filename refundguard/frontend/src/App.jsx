import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import RingList from './pages/RingList.jsx';
import RingDetail from './pages/RingDetail.jsx';
import Metrics from './pages/Metrics.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/rings" element={<RingList />} />
      <Route path="/rings/:id" element={<RingDetail />} />
      <Route path="/metrics" element={<Metrics />} />
    </Routes>
  );
}