import React from 'react';

// Sort signals by contribution descending
function sortedSignals(signals) {
  return [...signals].sort((a, b) => (b.contribution || 0) - (a.contribution || 0));
}

export default function EvidenceLedger({ signals = [] }) {
  if (!signals.length) {
    return null;
  }

  const sorted = sortedSignals(signals);

  return (
    <div className="inv-section">
      <div className="inv-section-title">
        <span className="inv-section-title-bar" />
        Risk Contribution Ledger
        <span className="section-count">{signals.length}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sorted.map((signal, idx) => {
          const level = signal.severity?.toUpperCase();
          const evidenceEntries = signal.evidence ? Object.entries(signal.evidence) : [];

          return (
            <div key={idx} className="evidence-row" style={{ paddingTop: 8, paddingBottom: 16, borderBottom: idx < sorted.length - 1 ? '1px solid var(--rg-border-subtle)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-primary)' }}>
                    {signal.type?.replace(/_/g, ' ') || signal.title}
                  </span>
                  {level && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--rg-text-tertiary)', textTransform: 'uppercase' }}>
                      • {level}
                    </span>
                  )}
                </div>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: signal.contribution > 10 ? 'var(--rg-severity-critical)' : 'var(--rg-text-primary)' }}>
                  +{signal.contribution}
                </span>
              </div>

              {signal.description && (
                <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--rg-text-secondary)', lineHeight: 1.5 }}>
                  {signal.description}
                </p>
              )}

              {evidenceEntries.length > 0 && (
                <div style={{ background: 'var(--rg-surface-hover)', borderRadius: 4, padding: '8px 12px', border: '1px solid var(--rg-border-subtle)' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 6 }}>
                    Evidence
                  </div>
                  {evidenceEntries.map(([key, val]) => {
                      const renderValue = (v) => {
                        if (Array.isArray(v)) {
                          return v.map((item, i) => {
                            let content = String(item);
                            if (typeof item === 'string') {
                              if (item.match(/^C\d+$/)) { // Assuming customer IDs look like C001, etc. or just use the Link logic for IDs. Wait, the original code had: href={`/investigations/${item}`}
                                content = <a href={`/investigations/${item}`} style={{ color: 'var(--rg-brand)', textDecoration: 'none' }}>{item}</a>;
                              }
                            }

                            // Check for > 100%
                            const asStr = String(item);
                            const rateMatch = asStr.match(/(\d+(?:\.\d+)?)%/);
                            if (rateMatch && parseFloat(rateMatch[1]) > 100) {
                              content = (
                                <>
                                  {content}
                                  <span
                                    style={{ marginLeft: 6, fontSize: 10, cursor: 'help', color: 'var(--rg-text-tertiary)', borderBottom: '1px dotted var(--rg-text-tertiary)' }}
                                    title="Data note: The refund rate exceeds 100% due to the detection engine's counting definitions. This is a known engine behavior."
                                  >
                                    (data note)
                                  </span>
                                </>
                              );
                            }

                            return (
                              <React.Fragment key={i}>
                                {content}
                                {i < v.length - 1 ? ', ' : ''}
                              </React.Fragment>
                            );
                          });
                        }

                        const strV = String(v);
                        const rateMatch = strV.match(/(\d+(?:\.\d+)?)%/);
                        if (rateMatch && parseFloat(rateMatch[1]) > 100) {
                          return (
                            <>
                              {strV}
                              <span
                                style={{ marginLeft: 6, fontSize: 10, cursor: 'help', color: 'var(--rg-text-tertiary)', borderBottom: '1px dotted var(--rg-text-tertiary)' }}
                                title="Data note: The refund rate exceeds 100% due to the detection engine's counting definitions. This is a known engine behavior."
                              >
                                (data note)
                              </span>
                            </>
                          );
                        }
                        return strV;
                      };

                      return (
                        <div key={key} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 6, alignItems: 'baseline' }}>
                          <span style={{ color: 'var(--rg-text-tertiary)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em', fontWeight: 700 }}>
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span style={{ color: 'var(--rg-text-primary)', fontFamily: 'var(--rg-font-mono)', background: 'var(--rg-canvas)', padding: '2px 6px', borderRadius: 3, border: '1px solid var(--rg-border-subtle)' }}>
                            {renderValue(val)}
                          </span>
                        </div>
                      );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
