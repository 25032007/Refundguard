import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '\u25C7' },
  { to: '/rings', label: 'Refund Rings', icon: '\u25CE' },
  { to: '/metrics', label: 'Risk Metrics', icon: '\u25A4' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo" aria-hidden="true">
          {'\u25C8'}
        </span>
        <span className="sidebar-wordmark">RefundGuard</span>
      </div>
      <nav className="sidebar-nav" aria-label="Primary">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
          >
            <span className="sidebar-icon" aria-hidden="true">
              {icon}
            </span>
            <span className="sidebar-label">{label}</span>
          </NavLink>
        ))}
        <span className="sidebar-link disabled" aria-disabled="true">
          <span className="sidebar-icon" aria-hidden="true">
            {'\u2699'}
          </span>
          <span className="sidebar-label">Settings</span>
        </span>
      </nav>
    </aside>
  );
}