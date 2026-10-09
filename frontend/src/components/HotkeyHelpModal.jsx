import React from 'react';

export default function HotkeyHelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[var(--rg-surface)] border border-[var(--rg-border-strong)] rounded-xl shadow-2xl max-w-md w-full p-6 text-[var(--rg-text-primary)]">
        <div className="flex items-center justify-between border-b border-[var(--rg-border)] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--rg-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <h3 className="font-bold text-lg">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--rg-text-secondary)] hover:text-[var(--rg-text-primary)] p-1 rounded-md transition"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-1.5 border-b border-[var(--rg-border-subtle)]">
            <span className="font-medium">Quick Mark: MONITOR</span>
            <kbd className="px-2 py-1 bg-[var(--rg-surface-hover)] border border-[var(--rg-border)] rounded text-xs font-mono font-bold">1</kbd>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-[var(--rg-border-subtle)]">
            <span className="font-medium">Quick Mark: ESCALATED</span>
            <kbd className="px-2 py-1 bg-[var(--rg-surface-hover)] border border-[var(--rg-border)] rounded text-xs font-mono font-bold">2</kbd>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-[var(--rg-border-subtle)]">
            <span className="font-medium">Quick Mark: CLEARED</span>
            <kbd className="px-2 py-1 bg-[var(--rg-surface-hover)] border border-[var(--rg-border)] rounded text-xs font-mono font-bold">3</kbd>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-[var(--rg-border-subtle)]">
            <span className="font-medium">Toggle Shortcuts Help</span>
            <kbd className="px-2 py-1 bg-[var(--rg-surface-hover)] border border-[var(--rg-border)] rounded text-xs font-mono font-bold">?</kbd>
          </div>
        </div>

        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[var(--rg-brand)] text-white rounded-lg text-xs font-semibold hover:opacity-90 transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
