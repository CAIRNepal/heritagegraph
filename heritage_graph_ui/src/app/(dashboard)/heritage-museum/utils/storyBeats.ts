import {
  NODE_TYPE_CONFIG,
  RELATION_LABELS,
  type GraphNode,
} from '../heritage-data';

export interface Beat {
  icon: string;
  title: string;
  lines: string[];
  type: 'intro' | 'facts' | 'story' | 'history' | 'culture' | 'arch' | 'rituals' | 'visit';
}

function nonEmptyLines(lines: string[]): string[] {
  return lines.map((l) => (l ?? '').trim()).filter(Boolean);
}

export function clampBeatIndex(idx: number, beatCount: number): number {
  if (beatCount <= 0) return 0;
  return ((idx % beatCount) + beatCount) % beatCount;
}

function introLine(node: GraphNode): string {
  const fromFields = node.description?.trim() || node.storyText?.trim();
  if (fromFields) return fromFields;
  const typeLabel = NODE_TYPE_CONFIG[node.nodeType]?.label ?? node.nodeType;
  return `${node.label} — ${typeLabel} in the HeritageGraph knowledge graph.`;
}

export function buildBeats(node: GraphNode): Beat[] {
  const beats: Beat[] = [];

  beats.push({
    icon: '✨',
    title: node.label,
    lines: [introLine(node)],
    type: 'intro',
  });

  const factLines: string[] = [];
  if (node.keyFacts?.length) {
    for (const f of node.keyFacts) {
      if (f.label && f.value) factLines.push(`${f.label}  ·  ${f.value}`);
    }
  } else {
    const cfg = NODE_TYPE_CONFIG[node.nodeType];
    if (cfg?.label) factLines.push(`Entity type  ·  ${cfg.label}`);
    if (node.cidocMapping) factLines.push(`CIDOC-CRM  ·  ${node.cidocMapping}`);
    if (node.inceptionYear?.trim()) factLines.push(`Temporal  ·  ${node.inceptionYear.trim()}`);
    if (node.lat?.trim() && node.long?.trim()) {
      factLines.push(`Coordinates  ·  ${node.lat.trim()}, ${node.long.trim()}`);
    }
  }
  if (factLines.length) {
    beats.push({
      icon: '📋',
      title: 'Key Facts',
      type: 'facts',
      lines: factLines,
    });
  }

  if (node.storyText?.trim() && node.storyText.trim() !== introLine(node)) {
    const sentences = node.storyText.replace(/\n/g, ' ').split(/(?<=\.)\s+/);
    const chunks: string[] = [];
    let buf = '';
    for (const s of sentences) {
      if (buf.length + s.length > 300 && buf) {
        chunks.push(buf.trim());
        buf = `${s} `;
      } else {
        buf += `${s} `;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
    chunks.forEach((c, i) =>
      beats.push({
        icon: '📖',
        title: i === 0 ? 'The Story' : 'Continued…',
        lines: [c],
        type: 'story',
      }),
    );
  }

  if (node.history?.trim()) {
    beats.push({ icon: '⏳', title: 'History', lines: [node.history], type: 'history' });
  }

  if (node.culturalRole?.trim()) {
    beats.push({
      icon: '🌐',
      title: 'Cultural Role',
      lines: [node.culturalRole],
      type: 'culture',
    });
  }

  if (node.architecture?.trim()) {
    beats.push({
      icon: '🏛',
      title: 'Architecture',
      lines: [node.architecture],
      type: 'arch',
    });
  }

  if (node.significance?.trim()) {
    beats.push({
      icon: '✦',
      title: 'Significance',
      lines: [node.significance],
      type: 'culture',
    });
  }

  if (node.relations?.length) {
    const lines = node.relations.slice(0, 10).map((r) => {
      const pred =
        RELATION_LABELS[r.predicate] ?? r.predicate.replace(/_/g, ' ');
      const target = r.targetLabel?.trim() || r.targetId;
      return `${pred}  ·  ${target}`;
    });
    beats.push({
      icon: '🔗',
      title: 'Connections',
      lines,
      type: 'culture',
    });
  }

  if (node.rituals?.length) {
    const half = Math.ceil(node.rituals.length / 2);
    beats.push({
      icon: '🙏',
      title: 'Rituals & Traditions',
      lines: node.rituals.slice(0, half),
      type: 'rituals',
    });
    if (node.rituals.length > half) {
      beats.push({
        icon: '🙏',
        title: 'More Rituals',
        lines: node.rituals.slice(half),
        type: 'rituals',
      });
    }
  }

  if (node.visitNote?.trim()) {
    beats.push({ icon: 'ℹ', title: 'Visitor Guide', lines: [node.visitNote], type: 'visit' });
  }

  const filtered = beats
    .map((b) => ({ ...b, lines: nonEmptyLines(b.lines) }))
    .filter((b) => b.lines.length > 0);

  if (filtered.length === 0) {
    return [
      {
        icon: '✨',
        title: node.label,
        lines: [
          `Explore connections and provenance for ${node.label} in the HeritageGraph knowledge graph.`,
        ],
        type: 'intro',
      },
    ];
  }

  return filtered;
}
