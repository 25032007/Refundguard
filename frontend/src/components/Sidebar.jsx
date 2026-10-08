import { NavLink, useLocation } from 'react-router-dom';

function isInvestigationActive(pathname) {
  return pathname.startsWith('/investigations/');
}

export default function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-mark" aria-hidden="true" />
        <span className="sidebar-brand-text">
          <span className="sidebar-wordmark">RefundGuard</span>
          <span className="sidebar-tagline">Fraud Risk Intelligence</span>
        </span>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        <span className="sidebar-section-label">Overview</span>
        <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Dashboard
        </NavLink>

        <span className="sidebar-section-label" style={{ marginTop: 16 }}>Investigations</span>
        <NavLink to="/triage" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Case Triage
        </NavLink>
        <NavLink to="/rings" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Ring Intelligence
        </NavLink>

        {isInvestigationActive(pathname) && (
          <div className="sidebar-link sidebar-link--context active" aria-current="page">
            <span className="sidebar-link-context-label">↳ Case Open</span>
            <span className="sidebar-link-context-id sidebar-link-id mono">
              {pathname.replace('/investigations/', '')}
            </span>
          </div>
        )}

        <span className="sidebar-section-label" style={{ marginTop: 16 }}>System</span>
        <NavLink to="/system" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Detection Health
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rg-severity-low)' }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--rg-text-secondary)' }}>Analyst Online</span>
        </div>
        <span className="sidebar-footer-label">RefundGuard v2.0</span>
      </div>
    </aside>
  );
}