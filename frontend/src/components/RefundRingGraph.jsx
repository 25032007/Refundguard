import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import Badge from '../ui/Badge.jsx';
import {
  buildGraphModel,
  buildTextSummary,
  relationshipTypesOf,
  severityFromScore,
} from '../utils/ringGraphModel.js';

/* Luxury Fintech Theme Graph Palette - 100% Matched to RefundGuard Ivory/Burgundy/Gold UI */
const THEME_COLORS = {
  targetCustomer: '#6e1c24',         /* Deep Burgundy Brand */
  targetHalo: '#c4a77d',             /* Muted Gold Accent */
  ringMember: '#8A6620',             /* Dark Warm Amber (Contrast > 4.5) */
  sharedIp: '#292524',               /* Dark Slate Charcoal */
  sharedIpAccent: '#c4a77d',         /* Gold IP Core */
  sharedDevice: '#A8481A',           /* Burnt Sienna / Terracotta */
  linkIp: 'rgba(41, 37, 36, 0.4)',
  linkDevice: 'rgba(168, 72, 26, 0.45)',
  particleGold: '#c4a77d',
  textPrimary: '#1c1917',
  textSecondary: '#57534e',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
};

function radiusOf(node) {
  if (node.type === 'customer') return 12;
  if (node.type === 'device') return 9;
  if (node.type === 'ip') return 9;
  return 8;
}

export default function RefundRingGraph({ investigation }) {
  const graph = investigation.graph;
  const inRing = !!graph?.inRing;
  const selectedId = investigation.customer?.customerId;

  const model = useMemo(
    () => (inRing ? buildGraphModel(investigation) : { nodes: [], links: [] }),
    [investigation, inRing]
  );
  const textSummary = useMemo(
    () => (inRing ? buildTextSummary(model) : ''),
    [inRing, model]
  );
  const ringSeverity = useMemo(
    () => (inRing ? severityFromScore(graph.ringScore) : null),
    [inRing, graph.ringScore]
  );

  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const containerRef = useRef(null);
  const fgRef = useRef();
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize((prev) =>
          prev.width === width && prev.height === height ? prev : { width, height }
        );
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const nodeCanvasObject = useCallback(
    (node, ctx, globalScale) => {
      const isTarget = node.id === selectedId;
      const isHovered = node.id === hoveredId;
      const radius = radiusOf(node);

      if (node.type === 'customer') {
        const fill = isTarget ? THEME_COLORS.targetCustomer : THEME_COLORS.ringMember;
        
        // Target customer glowing aura ring
        if (isTarget) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + (7 / globalScale), 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(196, 167, 125, 0.22)';
          ctx.fill();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = THEME_COLORS.targetHalo;
          ctx.stroke();
        }

        // Customer Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = isTarget ? 2.5 : isHovered ? 2 : 1.2;
        ctx.strokeStyle = isTarget ? '#ffffff' : isHovered ? THEME_COLORS.targetHalo : THEME_COLORS.borderStrong;
        ctx.stroke();

      } else if (node.type === 'ip') {
        // Shared IP Diamond Node (Sleek Charcoal + Gold Core)
        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.beginPath();
        ctx.moveTo(0, -radius * 1.1);
        ctx.lineTo(radius * 1.1, 0);
        ctx.lineTo(0, radius * 1.1);
        ctx.lineTo(-radius * 1.1, 0);
        ctx.closePath();
        ctx.fillStyle = THEME_COLORS.sharedIp;
        ctx.fill();
        ctx.lineWidth = isHovered ? 2 : 1.2;
        ctx.strokeStyle = isHovered ? THEME_COLORS.targetHalo : THEME_COLORS.borderStrong;
        ctx.stroke();

        // Inner Gold IP Core Dot
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = THEME_COLORS.sharedIpAccent;
        ctx.fill();
        ctx.restore();

      } else if (node.type === 'device') {
        // Shared Device Rounded Box (Terracotta)
        const side = radius * 1.8;
        ctx.beginPath();
        ctx.roundRect(node.x - side / 2, node.y - side / 2, side, side, 3);
        ctx.fillStyle = THEME_COLORS.sharedDevice;
        ctx.fill();
        ctx.lineWidth = isHovered ? 2 : 1.2;
        ctx.strokeStyle = isHovered ? '#ffffff' : THEME_COLORS.borderStrong;
        ctx.stroke();
      }

      // Label Text (Clean Inter Tight)
      const label = String(node.id);
      const fontSize = 11 / Math.max(globalScale, 1);
      ctx.font = `${isTarget ? '700 ' : '600 '}${fontSize}px 'Inter Tight', 'Inter', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = THEME_COLORS.textPrimary;
      ctx.fillText(label, node.x, node.y + radius + (6 / Math.max(globalScale, 1)));
    },
    [selectedId, hoveredId]
  );

  const linkColor = useCallback((link) => {
    return link.type === 'shared_ip' ? THEME_COLORS.linkIp : THEME_COLORS.linkDevice;
  }, []);

  const onEngineStop = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 40);
    }
  };

  const nodePointerAreaPaint = useCallback((node, color, ctx) => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, radiusOf(node) + 6, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  if (!inRing) return null;

  return (
    <div className="ring-graph">
      {/* Header Banner */}
      <div className="ring-detected-strip">
        <div className="ring-detected-kicker">Ring Detected</div>
        <div className="ring-detected-id mono">{graph.ringId}</div>
        <div className="ring-detected-meta" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
          {ringSeverity && <Badge severity={ringSeverity.toLowerCase()}>{ringSeverity}</Badge>}
          <span className="ring-detected-score" style={{ fontFamily: 'var(--rg-font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--rg-text-secondary)' }}>Score {graph.ringScore}</span>
          <span className="ring-detected-count" style={{ fontSize: 13, color: 'var(--rg-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {graph.members.length} member{graph.members.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <p className="ring-graph-summary">{textSummary}</p>

      {/* Graph Canvas Container with Matched Warm Theme */}
      <div 
        className="ring-graph-canvas-wrap" 
        ref={containerRef} 
        style={{ 
          height: 420, 
          width: '100%', 
          background: '#f8f6f2', 
          borderRadius: 8, 
          border: '1px solid var(--rg-border)', 
          overflow: 'hidden', 
          position: 'relative',
          boxShadow: 'var(--rg-shadow-sm)'
        }}
      >
        {size.width > 0 && size.height > 0 && (
          <ForceGraph2D
            ref={fgRef}
            graphData={model}
            width={size.width}
            height={size.height}
            backgroundColor="transparent"
            nodeRelSize={8}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkColor={linkColor}
            linkWidth={1.6}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2.2}
            linkDirectionalParticleSpeed={0.003}
            linkDirectionalParticleColor={() => THEME_COLORS.particleGold}
            onEngineStop={onEngineStop}
            onNodeClick={setSelectedNode}
            onNodeHover={(node) => setHoveredId(node?.id || null)}
            linkDistance={85}
            d3Force="collide"
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.1}
          />
        )}

        {/* Executive Graph Legend Overlay (100% Theme Matched) */}
        <div style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--rg-border-strong)',
          borderRadius: 6,
          padding: '8px 14px',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--rg-text-primary)',
          boxShadow: 'var(--rg-shadow-md)',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: THEME_COLORS.targetCustomer, border: `1.5px solid ${THEME_COLORS.targetHalo}` }} />
            <span>Target Subject</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: THEME_COLORS.ringMember }} />
            <span>Ring Member</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: THEME_COLORS.sharedIp, border: '1px solid #c4a77d' }} />
            <span>Shared IP</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: THEME_COLORS.sharedDevice }} />
            <span>Shared Device</span>
          </div>
        </div>
      </div>

      {selectedNode && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--rg-surface)', borderRadius: 6, border: '1px solid var(--rg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--rg-shadow-sm)' }}>
          <div>
            <h3 style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--rg-text-tertiary)' }}>Selected Graph Node</h3>
            <p style={{ margin: 0, fontSize: 13, fontFamily: 'var(--rg-font-mono)', fontWeight: 600 }}>{selectedNode.id} ({selectedNode.type})</p>
          </div>
          <button 
            onClick={() => setSelectedNode(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--rg-text-tertiary)' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}