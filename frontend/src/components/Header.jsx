import { useLocation, useParams } from 'react-router-dom';

const SECTION_TITLES = {
  '/triage': { title: 'Case Triage', sub: 'Active investigation queue' },
  '/rings': { title: 'Ring Intelligence', sub: 'Network behavior & lifecycle' },
  '/system': { title: 'Detection Health', sub: 'Engine status & operational metrics' },
};

function getSectionInfo(pathname) {
  if (pathname.startsWith('/rings/')) {
    const ringId = pathname.replace('/rings/', '').split('?')[0];
    return { title: 'Ring Intelligence', sub: `Ring ${ringId}`, id: ringId };
  }
  if (pathname.startsWith('/investigations/')) {
    const customerId = pathname.replace('/investigations/', '');
    return { title: 'Customer Investigation', sub: customerId, id: customerId };
  }
  return SECTION_TITLES[pathname] || { title: 'RefundGuard', sub: 'Fraud Risk Intelligence' };
}

export default function Header() {
  const { pathname } = useLocation();
  const info = getSectionInfo(pathname);
  const isInvestigation = pathname.startsWith('/investigations/');
  const isRingDetail = pathname.startsWith('/rings/') && pathname !== '/rings';

  return (
    <header className="app-header">
      <div className="app-header-context">
        <div className="app-header-eyebrow">
          {isInvestigation ? 'Investigation Console' : isRingDetail ? 'Ring Intelligence' : pathname === '/dashboard' ? 'Overview' : 'RefundGuard'}
        </div>
        <h1 className="app-header-title">
          {info.title}
          {info.id && (
            <span className="app-header-id mono">{info.id}</span>
          )}
        </h1>
      </div>
      <div className="app-header-user">
        <div className="app-header-analyst-info">
          <span className="app-header-analyst">Analyst</span>
          <span className="app-header-status-dot" aria-hidden="true" />
        </div>
        <span className="app-header-avatar" aria-label="Analyst account">
          AN
        </span>
      </div>
    </header>
  );
}