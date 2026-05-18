'use client';

import { useEffect, useRef } from 'react';
import { NODE_TYPE_CONFIG, RELATION_LABELS, type GraphNode, type GraphData } from '../heritage-data';
import { MediaViewer } from './MediaViewer';

interface StoryPanelProps {
  node: GraphNode | null;
  graphData: GraphData;
  onRelatedNodeClick: (nodeId: string) => void;
}

export function StoryPanel({ node, graphData, onRelatedNodeClick }: StoryPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [node?.id]);

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-6">
        <div className="w-20 h-20 rounded-full border-2 border-amber-500/30 flex items-center justify-center text-4xl animate-pulse">
          ☸
        </div>
        <div>
          <p className="text-amber-400 font-semibold text-lg mb-2">Explore the Knowledge Graph</p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Click any node in the graph to unveil its story — temples, deities, festivals, and
            epochs of Nepal&apos;s living heritage.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
          {Object.entries(NODE_TYPE_CONFIG).map(([type, cfg]) => (
            <div key={type} className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 rounded-lg px-3 py-2">
              <span>{cfg.emoji}</span>
              <span style={{ color: cfg.color }}>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cfg = NODE_TYPE_CONFIG[node.nodeType];

  const relatedNodes = node.relations
    .map((r) => ({ rel: r, rn: graphData.nodes.find((n) => n.id === r.targetId) }))
    .filter((x) => x.rn !== undefined);

  const grouped = relatedNodes.reduce<Record<string, GraphNode[]>>((acc, { rel, rn }) => {
    if (!rn) return acc;
    if (!acc[rel.predicate]) acc[rel.predicate] = [];
    acc[rel.predicate].push(rn);
    return acc;
  }, {});

  return (
    <div
      ref={panelRef}
      className="h-full overflow-y-auto"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
    >
      {/* Hero image + narration */}
      <MediaViewer node={node} />

      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 px-6 py-5 border-b border-white/10"
        style={{
          background: `linear-gradient(135deg, ${cfg.color}22 0%, #0f172a 100%)`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${cfg.glowColor}, ${cfg.color})`,
              boxShadow: `0 0 20px ${cfg.color}66`,
            }}
          >
            {cfg.emoji}
          </div>
          <div className="min-w-0">
            <span
              className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1"
              style={{ background: `${cfg.color}33`, color: cfg.glowColor }}
            >
              {cfg.label}
            </span>
            <h2 className="text-white font-bold text-lg leading-tight">{node.label}</h2>
            {node.unescoStatus && (
              <div className="flex items-center gap-1 mt-1">
                <span className="w-3 h-3 bg-blue-600 rounded-full inline-block" />
                <span className="text-blue-300 text-xs">{node.unescoStatus}</span>
              </div>
            )}
          </div>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {node.religion      && <Chip label={node.religion}                  icon="🕉"  color="#a78bfa" />}
          {node.dynasty       && <Chip label={`${node.dynasty} dynasty`}      icon="👑"  color="#fcd34d" />}
          {node.inceptionYear && <Chip label={`c. ${node.inceptionYear} CE`}  icon="📅"  color="#6ee7b7" />}
          {node.period        && <Chip label={node.period}                     icon="🗓"  color="#fb923c" />}
          {node.ethnicity     && <Chip label={node.ethnicity}                  icon="🎨"  color="#22d3ee" />}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-6">
        <p className="text-gray-300 text-sm leading-relaxed">{node.description}</p>

        {/* ── Ontology Mapping (HeritageGraph / CIDOC-CRM) ── */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
            Ontology Mapping
          </h3>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 text-xs">
              <span className="text-gray-500 shrink-0 w-24">HG Class</span>
              <code className="text-[11px] px-1.5 py-0.5 rounded bg-white/[0.07] border border-white/10 font-mono break-all" style={{ color: cfg.glowColor }}>
                hg:{node.nodeType}
              </code>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="text-gray-500 shrink-0 w-24">CIDOC-CRM</span>
              <code className="text-[11px] px-1.5 py-0.5 rounded bg-white/[0.07] border border-white/10 font-mono break-all text-blue-300">
                {node.cidocMapping}
              </code>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="text-gray-500 shrink-0 w-24">Category</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded border font-medium capitalize"
                style={{ color: cfg.glowColor, borderColor: `${cfg.color}44`, background: `${cfg.color}11` }}>
                {node.hgCategory}
              </span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="text-gray-500 shrink-0 w-24">Namespace</span>
              <code className="text-[11px] text-gray-500 font-mono break-all">
                https://w3id.org/heritagegraph/
              </code>
            </div>
          </div>
        </div>

        <Divider color={cfg.color} />

        {node.keyFacts && node.keyFacts.length > 0 && (
          <Section title="Key Facts" icon="📋" color={cfg.color}>
            <div className="grid grid-cols-1 gap-1.5">
              {node.keyFacts.map((f, i) => (
                <div key={i} className="flex items-baseline gap-2 text-xs rounded-lg px-3 py-2 bg-white/[0.04] border border-white/[0.08]">
                  <span className="text-gray-500 shrink-0 w-28 truncate">{f.label}</span>
                  <span className="text-gray-200 font-medium">{f.value}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="The Story" icon="📖" color={cfg.color}>
          <p className="text-gray-200 text-sm leading-7 whitespace-pre-line">{node.storyText}</p>
        </Section>

        {node.history && (
          <Section title="History" icon="⏳" color={cfg.color}>
            <p className="text-gray-300 text-sm leading-6">{node.history}</p>
          </Section>
        )}

        {node.culturalRole && (
          <Section title="Cultural Role" icon="🌐" color={cfg.color}>
            <p className="text-gray-300 text-sm leading-6">{node.culturalRole}</p>
          </Section>
        )}

        {node.architecture && (
          <Section title="Architecture" icon="🏛" color={cfg.color}>
            <p className="text-gray-300 text-sm leading-6">{node.architecture}</p>
          </Section>
        )}

        {node.significance && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: cfg.glowColor }}
            >
              ✦ Significance
            </h3>
            <p className="text-gray-300 text-sm">{node.significance}</p>
          </div>
        )}

        {node.rituals && node.rituals.length > 0 && (
          <Section title="Rituals & Traditions" icon="🙏" color={cfg.color}>
            <ul className="space-y-1.5">
              {node.rituals.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                  {r}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {node.visitNote && (
          <div
            className="rounded-xl p-4 border"
            style={{ borderColor: `${cfg.color}44`, background: `${cfg.color}0d` }}
          >
            <h3
              className="text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5"
              style={{ color: cfg.glowColor }}
            >
              <span>ℹ</span> Visitor Guide
            </h3>
            <p className="text-gray-300 text-sm leading-6">{node.visitNote}</p>
          </div>
        )}

        {node.tags && node.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {node.tags.map((tag) => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {node.lat && node.long && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>📍</span>
            <span>{parseFloat(node.lat).toFixed(4)}°N, {parseFloat(node.long).toFixed(4)}°E</span>
            <a
              href={`https://www.openstreetmap.org/?mlat=${node.lat}&mlon=${node.long}&zoom=15`}
              target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 ml-auto"
            >
              Map ↗
            </a>
          </div>
        )}

        {Object.keys(grouped).length > 0 && (
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: cfg.glowColor }}
            >
              🔗 Connections
            </h3>
            <div className="space-y-3">
              {Object.entries(grouped).map(([pred, nodes]) => (
                <div key={pred}>
                  <p className="text-xs text-gray-500 mb-1.5">{RELATION_LABELS[pred] || pred}</p>
                  <div className="flex flex-wrap gap-2">
                    {nodes.map((rn) => {
                      const rcfg = NODE_TYPE_CONFIG[rn.nodeType];
                      return (
                        <button
                          key={rn.id}
                          onClick={() => onRelatedNodeClick(rn.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all hover:scale-105 active:scale-95"
                          style={{
                            borderColor: `${rcfg.color}66`,
                            background: `${rcfg.color}11`,
                            color: rcfg.glowColor,
                          }}
                        >
                          <span>{rcfg.emoji}</span>
                          <span>{rn.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5"
        style={{ color }}
      >
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function Divider({ color }: { color: string }) {
  return (
    <div
      className="h-px w-full"
      style={{ background: `linear-gradient(to right, transparent, ${color}66, transparent)` }}
    />
  );
}

function Chip({ label, icon, color }: { label: string; icon: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
      style={{ background: `${color}22`, color }}
    >
      <span>{icon}</span>
      {label}
    </span>
  );
}
