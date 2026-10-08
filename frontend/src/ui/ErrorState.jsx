import React from 'react';

export default function ErrorState({ title = 'Error', description, className = '', ...props }) {
  return (
    <div className={`rg-error-state ${className}`} role="alert" {...props}>
      <h4 className="rg-error-state-title">{title}</h4>
      {description && <p className="rg-error-state-description">{description}</p>}
    </div>
  );
}
