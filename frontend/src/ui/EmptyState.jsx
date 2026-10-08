import React from 'react';

export default function EmptyState({ title, description, action, className = '', ...props }) {
  return (
    <div className={`rg-empty-state ${className}`} {...props}>
      {title && <h4 className="rg-empty-state-title">{title}</h4>}
      {description && <p className="rg-empty-state-description">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
