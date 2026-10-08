import React from 'react';

export default function Panel({ title, metadata, actions, children, className = '', ...props }) {
  return (
    <div className={`rg-panel ${className}`} {...props}>
      {(title || metadata || actions) && (
        <div className="rg-panel-header">
          <div>
            {title && <h3 className="rg-panel-title">{title}</h3>}
            {metadata && <div className="rg-panel-meta">{metadata}</div>}
          </div>
          {actions && <div className="rg-panel-actions">{actions}</div>}
        </div>
      )}
      <div className="rg-panel-content">
        {children}
      </div>
    </div>
  );
}
