import { useLocation } from 'react-router-dom';

const TITLES = {
  '/triage': 'Triage Center',
  '/rings': 'Ring Intelligence',
  '/system': 'System Metrics',
};

function titleForPath(pathname) {
  if (pathname.startsWith('/rings/')) return 'Ring Intelligence';
  if (pathname.startsWith('/investigations/')) return 'Customer Investigation';
  return TITLES[pathname] || 'RefundGuard';
}

export default function Header() {
  const { pathname } = useLocation();
  const title = titleForPath(pathname);

  return (
    <header className="app-header">
      <div className="app-header-context">
        <h1 className="app-header-title">{title}</h1>
        <span className="app-header-eyebrow">Investigation Console</span>
      </div>
      <div className="app-header-user">
        <span className="app-header-analyst">Analyst</span>
        <span className="app-header-avatar" aria-hidden="true">
          AN
        </span>
      </div>
    </header>
  );
}