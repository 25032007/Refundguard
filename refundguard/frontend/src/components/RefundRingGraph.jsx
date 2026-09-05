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
  background: '#14120F',
  border: '#3A342A',
  textPrimary: '#F2EDE4',
  textSecondary: '#A69C8D',
  accent: '#E08A3E',
  accentHover: '#F0A05C',
  member: 'rgba(224, 138, 62, 0.8)',
  teal: '#4A8B7C',
  neutral: '#8A8173',
};

const RELATIONSHIP_LABELS = {
  shared_ip: 'SHARED IP',
  shared_device: 'SHARED DEVICE',
};

function radiusOf(node) {
  if (node.type === 'customer') return node.id === undefined ? 9 : 9;
  if (node.type === 'device') return 7;
  return 6;
}

export default function RefundRingGraph({ investigation }) {
  const graph = investigation.graph;
  const inRing = !!graph.inRing;
  const selectedId = investigation.customer.customerId;

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
      const fontSize = 11 / globalScale;
      ctx.font = `${isSelected ? '700 ' : '500 '}${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle =
        node.type === 'customer' && isSelected ? COLORS.textPrimary : COLORS.textSecondary;
      ctx.fillText(label, node.x, node.y + radius + (6 / globalScale));
      if (isHovered) {
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = COLORS.textPrimary;
        ctx.fillText(RELATIONSHIP_LABELS[node.type] || node.type.toUpperCase(), node.x, node.y + radius + (22 / globalScale));
      }
    },
    [selectedId, hoveredId]
  );

  const nodePointerAreaPaint = useCallback((node, color, ctx) => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, radiusOf(node) + 5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  const nodeLabel = useCallback(
    (node) => {
      const line = `<b>${node.id}</b><br/><span style="color:${COLORS.textSecondary}">${RELATIONSHIP_LABELS[node.type] || node.type.toUpperCase()}</span>`;
      if (node.type === 'customer') {
        if (node.id === selectedId) {
          return `${line}<br/><span style="color:${COLORS.textSecondary}">Selected customer · ${investigation.summary.overallRisk.toUpperCase()}</span>`;
        }
        return `${line}<br/><span style="color:${COLORS.textSecondary}">Ring member</span>`;
      }
      if (node.connectedCustomers) {
        return `${line}<br/><span style="color:${COLORS.textSecondary}">${node.connectedCustomers.length} connected customer${node.connectedCustomers.length === 1 ? '' : 's'}</span>`;
      }
      return line;
    },
    [selectedId, investigation]
  );

  const linkLabel = useCallback(
    (link) =>
      `<span style="color:${COLORS.textSecondary}">${link.source.id} → ${link.target.id}</span><br/><b>${RELATIONSHIP_LABELS[link.type] || link.type.toUpperCase()}</b>`,
    []
  );

  const onNodeClick = useCallback((node) => {
    setSelectedNode(node);
  }, []);
  const onNodeHover = useCallback((node) => {
    setHoveredId(node ? node.id : null);
  }, []);
  const onBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (!inRing) {
    return (
      <div className="ring-graph">
        <div className="ring-graph-empty" role="status">
          <p className="ring-graph-empty-title">NO REFUND RING DETECTED</p>
          <p className="ring-graph-empty-text">
            This customer is not connected to a detected refund ring.
          </p>
        </div>
      </div>
    );
  }

  if (model.nodes.length === 0) {
    return (
      <div className="ring-graph">
        <div className="ring-graph-empty" role="status">
          <p className="ring-graph-empty-title">Graph evidence unavailable.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ring-graph">
      <div className="ring-detected-strip">
        <div className="ring-detected-kicker">Ring Detected</div>
        <div className="ring-detected-id mono">{graph.ringId}</div>
        <div className="ring-detected-meta">
          {ringSeverity && <RiskBadge level={ringSeverity.toLowerCase()} />}
          <span className="ring-detected-score">Score {graph.ringScore}</span>
          <span className="ring-detected-count">
            {graph.members.length} member{graph.members.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <p className="ring-graph-summary" aria-label="Graph summary">
        {textSummary}
      </p>

      <div className="ring-graph-canvas-wrap" ref={containerRef} aria-label="Refund ring network graph">
        {size.width > 0 && size.height > 0 && (
          <ForceGraph2D
            graphData={model}
            width={size.width}
            height={size.height}
            backgroundColor={COLORS.background}
            nodeCanvasObjectMode={() => 'replace'}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            nodeLabel={nodeLabel}
            linkLabel={linkLabel}
            linkColor={() => COLORS.border}
            linkWidth={() => 1.2}
            linkDirectionalArrowLength={() => 4}
            linkDirectionalArrowRelPos={1}
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
            onBackgroundClick={onBackgroundClick}
            linkDistance={58}
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.3}
            warmupTicks={60}
            cooldownTicks={120}
            cooldownTime={2500}
            minZoom={0.4}
            maxZoom={6}
          />
        )}
      </div>

      <div className="ring-graph-legend" aria-label="Graph legend">
        <span className="ring-legend-item">
          <i className="ring-legend-swatch ring-legend-swatch--customer" aria-hidden="true" />
          Customer
        </span>
        <span className="ring-legend-item">
          <i className="ring-legend-swatch ring-legend-swatch--device" aria-hidden="true" />
          Shared Device
        </span>
        <span className="ring-legend-item">
          <i className="ring-legend-swatch ring-legend-swatch--ip" aria-hidden="true" />
          Shared IP
        </span>
        <span className="ring-legend-item">
          <i className="ring-legend-line" aria-hidden="true" />
          Relationship
        </span>
        <span className="ring-legend-item">
          <i className="ring-legend-swatch ring-legend-swatch--selected" aria-hidden="true" />
          Selected node
        </span>
      </div>

      <div className="ring-graph-facts">
        <div className="ring-fact">
          <span className="ring-fact-label">Ring ID</span>
          <span className="ring-fact-value mono">{graph.ringId}</span>
        </div>
        <div className="ring-fact">
          <span className="ring-fact-label">Ring Score</span>
          <span className="ring-fact-value">{graph.ringScore}</span>
        </div>
        <div className="ring-fact">
          <span className="ring-fact-label">Members</span>
          <span className="ring-fact-value">{graph.members.length}</span>
        </div>
        <div className="ring-fact">
          <span className="ring-fact-label">Relationship Types</span>
          <span className="ring-fact-value">
            {relationshipTypes.length
              ? relationshipTypes.map((t) => RELATIONSHIP_LABELS[t] || t.toUpperCase()).join(', ')
              : 'None'}
          </span>
        </div>
      </div>

      {selectedNode && (
        <div className="ring-info-panel" role="region" aria-label="Selected node details">
          {selectedNode.type === 'customer' ? (
            <>
              <h3 className="ring-info-title">Customer</h3>
              <dl className="ring-info-list">
                <div>
                  <dt>Customer ID</dt>
                  <dd className="mono">{selectedNode.id}</dd>
                </div>
                <div>
                  <dt>Ring membership</dt>
                  <dd className="mono">
                    {selectedNode.ringMember ? graph.ringId : 'No ring membership'}
                  </dd>
                </div>
                {selectedNode.id === selectedId && (
                  <div>
                    <dt>Risk Level</dt>
                    <dd>
                      <RiskBadge level={investigation.summary.overallRisk} />
                    </dd>
                  </div>
                )}
              </dl>
            </>
          ) : (
            <>
              <h3 className="ring-info-title">
                {selectedNode.type === 'device' ? 'Shared Device' : 'Shared IP'}
              </h3>
              <dl className="ring-info-list">
                <div>
                  <dt>{selectedNode.type === 'device' ? 'Device ID' : 'IP identifier'}</dt>
                  <dd className="mono">{selectedNode.id}</dd>
                </div>
                <div>
                  <dt>Connected customers</dt>
                  <dd className="mono">
                    {(selectedNode.connectedCustomers || []).join(', ') || '\u2014'}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>
      )}
    </div>
  );
}