import React from 'react';

export function LogoMark({ size = 40, className = '' }) {
  return (
    <div 
      className={`rg-logo-mark-wrapper ${className}`}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      {/* Subtle Financial Radial Aura */}
      <div 
        style={{
          position: 'absolute',
          inset: -3,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(110, 28, 36, 0.32) 0%, rgba(196, 167, 125, 0.22) 60%, transparent 100%)',
          filter: 'blur(4px)',
          pointerEvents: 'none'
        }} 
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'relative', zIndex: 1 }}
      >
        {/* Outer Circular Money Refund Loop 1 (Top Clockwise Arc with Arrowhead) */}
        <path
          d="M22 6C31.3888 6 39 13.6112 39 23C39 26.5 37.9 29.7 36 32.4"
          stroke="url(#rg-currency-gold)"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M38.5 28L36 32.5L31.5 31"
          stroke="url(#rg-currency-gold)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Outer Circular Money Refund Loop 2 (Bottom Counter-Clockwise Arc with Arrowhead) */}
        <path
          d="M22 42C12.6112 42 5 34.3888 5 25C5 21.5 6.1 18.3 8 15.6"
          stroke="url(#rg-currency-burgundy)"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M5.5 20L8 15.5L12.5 17"
          stroke="url(#rg-currency-burgundy)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Central Financial Vault Coin Core */}
        <circle
          cx="22"
          cy="24"
          r="10"
          fill="url(#rg-vault-fill)"
          stroke="url(#rg-currency-gold)"
          strokeWidth="1.8"
        />

        {/* Precision Currency Symbol (Indian Rupee / Money Icon - ₹) */}
        <path
          d="M17.5 18.5H26.5M17.5 21.5H25.5M19.5 18.5V23.5C21.5 23.5 24 23 24 21C24 19 21.5 19 19.5 19M19 23.5L25 29.5"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* AI Guard Micro Security Nodes */}
        <circle cx="22" cy="6" r="1.8" fill="#c4a77d" />
        <circle cx="22" cy="42" r="1.8" fill="#8a2432" />

        {/* Gradients */}
        <defs>
          <linearGradient id="rg-currency-gold" x1="22" y1="6" x2="39" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f5e1be" />
            <stop offset="0.6" stopColor="#c4a77d" />
            <stop offset="1" stopColor="#8a6620" />
          </linearGradient>

          <linearGradient id="rg-currency-burgundy" x1="5" y1="15" x2="22" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8a2432" />
            <stop offset="0.7" stopColor="#501219" />
            <stop offset="1" stopColor="#2c090d" />
          </linearGradient>

          <linearGradient id="rg-vault-fill" x1="12" y1="14" x2="32" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6e1c24" />
            <stop offset="1" stopColor="#3d0e14" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function Logo({ size = 'medium', showTagline = true, className = '' }) {
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  const markSize = isSmall ? 32 : isLarge ? 48 : 40;

  return (
    <div className={`rg-brand-logo ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: isSmall ? 8 : 10 }}>
      <LogoMark size={markSize} />

      {/* Brand Wordmark & Subtitle */}
      <div className="rg-logo-text" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.15 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span 
            style={{ 
              fontSize: isSmall ? '14.5px' : isLarge ? '21px' : '16.5px', 
              fontWeight: 800, 
              letterSpacing: '-0.025em',
              color: 'var(--rg-text-primary)',
              fontFamily: 'var(--rg-font-sans)'
            }}
          >
            Refund<span style={{ color: 'var(--rg-brand)' }}>Guard</span>
          </span>
          <span
            style={{
              width: 4.5,
              height: 4.5,
              borderRadius: '50%',
              background: 'var(--rg-accent)',
              marginLeft: 1.5,
              display: 'inline-block',
              alignSelf: 'center'
            }}
          />
        </div>
        
        {showTagline && (
          <span 
            style={{ 
              fontSize: isSmall ? '8px' : '9px', 
              fontWeight: 700, 
              letterSpacing: '0.14em', 
              textTransform: 'uppercase',
              color: 'var(--rg-text-tertiary)',
              whiteSpace: 'nowrap',
              marginTop: 1
            }}
          >
            Fraud Risk Intelligence
          </span>
        )}
      </div>
    </div>
  );
}
