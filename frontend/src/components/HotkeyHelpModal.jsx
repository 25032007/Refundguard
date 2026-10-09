import React from 'react';

export default function HotkeyHelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--rg-surface)',
          border: '1px solid var(--rg-border-strong)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          maxWidth: '420px',
          width: '100%',
          padding: '24px',
          color: 'var(--rg-text-primary)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--rg-border)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rg-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--rg-text-secondary)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--rg-border-subtle)' }}>
            <span style={{ fontWeight: 500 }}>Quick Mark: MONITOR</span>
            <kbd style={{ padding: '2px 8px', background: 'var(--rg-surface-hover)', border: '1px solid var(--rg-border)', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700 }}>1</kbd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--rg-border-subtle)' }}>
            <span style={{ fontWeight: 500 }}>Quick Mark: ESCALATED</span>
            <kbd style={{ padding: '2px 8px', background: 'var(--rg-surface-hover)', border: '1px solid var(--rg-border)', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700 }}>2</kbd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--rg-border-subtle)' }}>
            <span style={{ fontWeight: 500 }}>Quick Mark: CLEARED</span>
            <kbd style={{ padding: '2px 8px', background: 'var(--rg-surface-hover)', border: '1px solid var(--rg-border)', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700 }}>3</kbd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--rg-border-subtle)' }}>
            <span style={{ fontWeight: 500 }}>Toggle Shortcuts Help</span>
            <kbd style={{ padding: '2px 8px', background: 'var(--rg-surface-hover)', border: '1px solid var(--rg-border)', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700 }}>?</kbd>
          </div>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: 'var(--rg-brand)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
