import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import RiskBadge from './RiskBadge.jsx';
import {
  buildGraphModel,
  buildTextSummary,
  relationshipTypesOf,
  severityFromScore,
} from '../utils/ringGraphModel.js';

const COLORS = {
  background: 'var(--rg-surface)',
  border: 'var(--rg-border)',
  textPrimary: 'var(--rg-text-primary)',
  textSecondary: 'var(--rg-text-secondary)',
  accent: 'var(--rg-brand)',
  accentHover: 'var(--rg-brand-hover)',
  member: 'var(--rg-severity-medium)',
  teal: 'var(--rg-severity-high)',
  neutral: 'var(--rg-surface-hover)',
};

const RELATIONSHIP_LABELS = {
  shared_ip: 'SHARED IP',
  shared_device: 'SHARED DEVICE',
};

function radiusOf(node) {
  if (node.type === 'customer') return 12;
  if (node.type === 'device') return 8;
  return 6;
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
  const relationshipTypes = useMemo(() => relationshipTypesOf(model), [model]);
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
      const isSelected = node.id === selectedId;
      const isHovered = node.id === hoveredId;
      const radius = radiusOf(node);

      let fill = COLORS.neutral;
      let stroke = COLORS.border;

      if (node.type === 'customer') {
        fill = isSelected ? COLORS.accent : COLORS.member;
        stroke = isHovered || isSelected ? COLORS.accentHover : COLORS.border;
      } else if (node.type === 'device') {
        fill = COLORS.teal;
        stroke = isHovered ? COLORS.accentHover : COLORS.border;
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = isSelected ? 2 : 1.2;
      ctx.strokeStyle = stroke;
      ctx.stroke();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + (5 / globalScale), 0, 2 * Math.PI);
        ctx.lineWidth = 1;
        ctx.strokeStyle = COLORS.accentHover;
        ctx.stroke();
      }

      const label = String(node.id);
      const fontSize = 11 / Math.max(globalScale, 1);
      ctx.font = `${isSelected ? '700 ' : '500 '}${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(label, node.x, node.y + radius + (6 / Math.max(globalScale, 1)));
    },
    [selectedId, hoveredId]
  );

  const onEngineStop = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50);
    }
  };

  const nodePointerAreaPaint = useCallback((node, color, ctx) => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, radiusOf(node) + 5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  if (!inRing) return null;

  return (
    <div className="ring-graph">
      <div className="ring-detected-strip">
        <div className="ring-detected-kicker">Ring Detected</div>
        <div className="ring-detected-id mono">{graph.ringId}</div>
        <div className="ring-detected-meta" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
          {ringSeverity && <RiskBadge level={ringSeverity.toLowerCase()} />}
          <span className="ring-detected-score" style={{ fontFamily: 'var(--rg-font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--rg-text-secondary)' }}>Score {graph.ringScore}</span>
          <span className="ring-detected-count" style={{ fontSize: 13, color: 'var(--rg-text-secondary)' }}>
            {graph.members.length} member{graph.members.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <p className="ring-graph-summary">{textSummary}</p>

      <div className="ring-graph-canvas-wrap" ref={containerRef} style={{ height: 400, width: '100%', background: 'var(--rg-surface)', borderRadius: 4, border: '1px solid var(--rg-border)', overflow: 'hidden' }}>
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
            onEngineStop={onEngineStop}
            onNodeClick={setSelectedNode}
            onNodeHover={(node) => setHoveredId(node?.id || null)}
            linkDistance={80}
            d3Force="collide"
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.1}
          />
        )}
      </div>

      {selectedNode && (
        <div style={{ marginTop: 16, padding: 16, background: 'var(--rg-surface-hover)', borderRadius: 4, border: '1px solid var(--rg-border)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Node Details</h3>
          <p style={{ margin: 0, fontSize: 13, fontFamily: 'var(--rg-font-mono)' }}>{selectedNode.id} ({selectedNode.type})</p>
        </div>
      )}
    </div>
  );
}