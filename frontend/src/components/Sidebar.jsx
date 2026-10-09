import { NavLink, useLocation } from 'react-router-dom';
import Logo from './Logo';

function isInvestigationActive(pathname) {
  return pathname.startsWith('/investigations/');
}

export default function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo size="medium" />
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        <span className="sidebar-section-label">Overview</span>
        <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" className="sidebar-icon">
            <rect x="3" y="3" width="6" height="6" rx="1.2" strokeWidth="1.6" />
            <rect x="11" y="3" width="6" height="6" rx="1.2" strokeWidth="1.6" />
            <rect x="3" y="11" width="6" height="6" rx="1.2" strokeWidth="1.6" />
            <rect x="11" y="11" width="6" height="6" rx="1.2" strokeWidth="1.6" />
          </svg>
          <span className="sidebar-link-text">Dashboard</span>
        </NavLink>

        <span className="sidebar-section-label" style={{ marginTop: 16 }}>Investigations</span>
        <NavLink to="/triage" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" className="sidebar-icon">
            <path d="M3 5H17M5 10H15M8 15H12" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="sidebar-link-text">Case Triage</span>
        </NavLink>
        <NavLink to="/rings" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" className="sidebar-icon">
            <circle cx="6" cy="6" r="2.5" strokeWidth="1.5" />
            <circle cx="14" cy="6" r="2.5" strokeWidth="1.5" />
            <circle cx="10" cy="14" r="2.5" strokeWidth="1.5" />
            <path d="M8 7.5L12 7.5M7.5 8L9 12M12.5 8L11 12" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="sidebar-link-text">Ring Intelligence</span>
        </NavLink>

        {isInvestigationActive(pathname) && (
          <div className="sidebar-link sidebar-link--context active" aria-current="page">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" className="sidebar-icon" style={{ opacity: 0.8 }}>
              <circle cx="9" cy="9" r="5" strokeWidth="1.6" />
              <path d="M13 13L17 17" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span className="sidebar-link-context-label">Case Open</span>
              <span className="sidebar-link-context-id sidebar-link-id mono">
                {pathname.replace('/investigations/', '')}
              </span>
            </div>
          </div>
        )}

        <span className="sidebar-section-label" style={{ marginTop: 16 }}>System</span>
        <NavLink to="/system" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" className="sidebar-icon">
            <path d="M3 10H6L8 4L12 16L14 10H17" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="sidebar-link-text">Detection Health</span>
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