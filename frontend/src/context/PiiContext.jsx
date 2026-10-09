import React, { createContext, useContext, useState, useEffect } from 'react';
import { formatPiiText } from '../utils/pii';

const PiiContext = createContext();

export function PiiProvider({ children }) {
  const [isPiiMasked, setIsPiiMasked] = useState(() => {
    const saved = localStorage.getItem('rg_pii_masked');
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('rg_pii_masked', JSON.stringify(isPiiMasked));
  }, [isPiiMasked]);

  const togglePiiMask = () => setIsPiiMasked((prev) => !prev);

  const maskPii = (text, type = 'name') => formatPiiText(text, type, isPiiMasked);

  return (
    <PiiContext.Provider value={{ isPiiMasked, togglePiiMask, maskPii }}>
      {children}
    </PiiContext.Provider>
  );
}

export function usePii() {
  const context = useContext(PiiContext);
  if (!context) {
    return {
      isPiiMasked: false,
      togglePiiMask: () => {},
      maskPii: (text) => text,
    };
  }
  return context;
}
