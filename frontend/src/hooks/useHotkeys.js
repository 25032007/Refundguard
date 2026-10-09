import { useEffect } from 'react';

export function useHotkeys({ onMonitor, onEscalate, onClear, onToggleHelp, enabled = true }) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e) {
      // Ignore keypresses when typing inside input/textarea elements
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
        return;
      }

      if (e.key === '1' && onMonitor) {
        e.preventDefault();
        onMonitor();
      } else if (e.key === '2' && onEscalate) {
        e.preventDefault();
        onEscalate();
      } else if (e.key === '3' && onClear) {
        e.preventDefault();
        onClear();
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        if (onToggleHelp) onToggleHelp();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onMonitor, onEscalate, onClear, onToggleHelp, enabled]);
}
