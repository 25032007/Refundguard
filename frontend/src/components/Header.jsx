import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePii } from '../context/PiiContext';
import HotkeyHelpModal from './HotkeyHelpModal';

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
  const navigate = useNavigate();
  const info = getSectionInfo(pathname);
  const { isPiiMasked, togglePiiMask } = usePii();
  const [isHotkeyHelpOpen, setIsHotkeyHelpOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && globalSearch.trim()) {
      navigate(`/triage?search=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

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

      <div className="app-header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}>
        {/* PII Shield Toggle */}
        <button
          onClick={togglePiiMask}
          title={isPiiMasked ? 'PII Masking Active (Compliance Mode)' : 'PII Displaying Unmasked (Click to Mask)'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '6px',
            cursor: 'pointer',
            border: isPiiMasked ? '1px solid #16a34a' : '1px solid var(--rg-border-strong)',
            backgroundColor: isPiiMasked ? 'rgba(22, 163, 74, 0.1)' : 'var(--rg-surface)',
            color: isPiiMasked ? '#15803d' : 'var(--rg-text-primary)',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>PII: {isPiiMasked ? 'MASKED' : 'UNMASKED'}</span>
        </button>

        {/* Hotkeys Button */}
        <button
          onClick={() => setIsHotkeyHelpOpen(true)}
          title="Keyboard Shortcuts (?)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '6px',
            cursor: 'pointer',
            border: '1px solid var(--rg-border-strong)',
            backgroundColor: 'var(--rg-surface)',
            color: 'var(--rg-text-primary)',
            flexShrink: 0,
          }}
        >
          ?
        </button>

        {/* Quick Search */}
        <div className="app-header-search-box" style={{ flexShrink: 1 }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" style={{ color: 'var(--rg-text-tertiary)', flexShrink: 0 }}>
            <circle cx="9" cy="9" r="5" strokeWidth="1.8" />
            <path d="M13 13L17 17" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input 
            type="text" 
            placeholder="Search ring, customer..." 
            className="app-header-search-input"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <kbd className="app-header-kbd">↵</kbd>
        </div>

        {/* System Health Indicator */}
        <div className="app-header-health-pill" style={{ flexShrink: 0 }}>
          <span className="health-dot" />
          <span className="health-text">99.8% Online</span>
        </div>

        {/* Analyst Account Badge */}
        <div className="app-header-user" style={{ flexShrink: 0 }}>
          <div className="app-header-avatar">
            <span>RA</span>
          </div>
          <div className="app-header-analyst-info">
            <span className="app-header-analyst">Risk Analyst</span>
            <span className="app-header-role">RBAC: LEAD</span>
          </div>
        </div>
      </div>

      <HotkeyHelpModal
        isOpen={isHotkeyHelpOpen}
        onClose={() => setIsHotkeyHelpOpen(false)}
      />
    </header>
  );
}