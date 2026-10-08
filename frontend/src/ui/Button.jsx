import React from 'react';

export default function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`rg-button rg-button--${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
