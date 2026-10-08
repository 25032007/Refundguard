import React from 'react';

export default function Field({ label, value, className = '', ...props }) {
  return (
    <div className={`rg-field ${className}`} {...props}>
      <span className="rg-field-label">{label}</span>
      <span className="rg-field-value">{value}</span>
    </div>
  );
}
