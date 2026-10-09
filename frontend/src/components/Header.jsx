import React from 'react';
import { useLocation } from 'react-router-dom';

const SECTION_TITLES = {
  '/dashboard': { eyebrow: 'Executive Overview', title: 'Risk Intelligence Console', sub: 'Real-time refund fraud & ring monitoring' },
  '/triage': { eyebrow: 'Case Management', title: 'Case Triage', sub: 'Active investigation queue & risk ranking' },
  '/rings': { eyebrow: 'Network Graph', title: 'Ring Intelligence', sub: 'Network behavior & lifecycle tracking' },
  '/system': { eyebrow: 'System Diagnostics', title: 'Detection Health', sub: 'Engine pipeline status & model operational metrics' },
};

function getSectionInfo(pathname) {
  if (pathname.startsWith('/rings/')) {
    const ringId = pathname.replace('/rings/', '').split('?')[0];
    return { eyebrow: 'Ring Analysis', title: 'Ring Network Details', sub: `Investigation target: ${ringId}`, id: ringId };
  }
  if (pathname.startsWith('/investigations/')) {
    const customerId = pathname.replace('/investigations/', '');
    return { eyebrow: 'Customer Deep Dive', title: 'Customer Investigation', sub: `Subject ID: ${customerId}`, id: customerId };
  }
  return SECTION_TITLES[pathname] || { eyebrow: 'RefundGuard AI', title: 'Fraud Risk Intelligence', sub: 'Razorpay AI Buildathon' };
}

export default function Header() {
  const { pathname } = useLocation();
  const info = getSectionInfo(pathname);

  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="app-header-context">
          <div className="app-header-eyebrow-container">
            <span className="app-header-eyebrow">{info.eyebrow}</span>
            <span className="app-header-slash">/</span>
            <span className="app-header-sub-label">{info.sub}</span>
          </div>
          <h1 className="app-header-title">
            {info.title}
            {info.id && (
              <span className="app-header-id mono">{info.id}</span>
            )}
          </h1>
        </div>
      </div>

      <div className="app-header-right">
        {/* Quick Search / Command Bar */}
        <div className="app-header-search-box">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" style={{ color: 'var(--rg-text-tertiary)', flexShrink: 0 }}>
            <circle cx="9" cy="9" r="5" strokeWidth="1.8" />
            <path d="M13 13L17 17" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input 
            type="text" 
            placeholder="Search ring, customer, device..." 
            className="app-header-search-input"
            readOnly
          />
          <kbd className="app-header-kbd">⌘K</kbd>
        </div>

        {/* Real-time System Health Indicator */}
        <div className="app-header-health-pill">
          <span className="health-dot" />
          <span className="health-text">Engine 99.8% Online</span>
        </div>

        {/* Analyst Account Badge */}
        <div className="app-header-user">
          <div className="app-header-avatar">
            <span>RA</span>
          </div>
          <div className="app-header-analyst-info">
            <span className="app-header-analyst">Risk Analyst</span>
            <span className="app-header-role">Tier 3 Triage</span>
          </div>
        </div>
      </div>
    </header>
  );
}