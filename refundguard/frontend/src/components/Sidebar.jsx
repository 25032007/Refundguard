import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/rings', label: 'Refund Rings' },
  { to: '/metrics', label: 'Risk Metrics' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-mark" aria-hidden="true" />
        <span className="sidebar-brand-text">
          <span className="sidebar-wordmark">RefundGuard</span>
          <span className="sidebar-tagline">Fraud Risk Intelligence</span>
        </span>
      </div>
      <nav className="sidebar-nav" aria-label="Primary">
        <span className="sidebar-section-label">Analysis</span>
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
          >
            {label}
          </NavLink>
        ))}
        <span className="sidebar-section-label">Workspace</span>
        <span className="sidebar-link disabled" aria-disabled="true">
          Settings
        </span>
      </nav>
    </aside>
  );
}