import { useLocation } from 'react-router-dom';

const TITLES = {
  '/dashboard': 'Dashboard',
  '/rings': 'Refund Rings',
  '/metrics': 'Risk Metrics',
};

function titleForPath(pathname) {
  if (pathname.startsWith('/rings/')) return 'Ring Investigation';
  return TITLES[pathname] || 'RefundGuard';
}

export default function Header() {
  const { pathname } = useLocation();
  const title = titleForPath(pathname);

  return (
    <header className="app-header">
      <h1 className="app-header-title">{title}</h1>
      <div className="app-header-user">
        <span className="app-header-analyst">Analyst</span>
        <span className="app-header-avatar" aria-hidden="true" />
      </div>
    </header>
  );
}