import type { GraphNode } from '../heritage-data';

export interface Beat {
  icon: string;
  title: string;
  lines: string[];
  type: 'intro' | 'facts' | 'story' | 'history' | 'culture' | 'arch' | 'rituals' | 'visit';
}

export function buildBeats(node: GraphNode): Beat[] {
  const beats: Beat[] = [];

  beats.push({ icon: '✨', title: node.label, lines: [node.description], type: 'intro' });

  if (node.keyFacts?.length) {
    beats.push({
      icon: '📋', title: 'Key Facts', type: 'facts',
      lines: node.keyFacts.map((f) => `${f.label}  ·  ${f.value}`),
    });
  }

  if (node.storyText) {
    const sentences = node.storyText.replace(/\n/g, ' ').split(/(?<=\.)\s+/);
    const chunks: string[] = [];
    let buf = '';
    for (const s of sentences) {
      if (buf.length + s.length > 300 && buf) { chunks.push(buf.trim()); buf = s + ' '; }
      else buf += s + ' ';
    }
    if (buf.trim()) chunks.push(buf.trim());
    chunks.forEach((c, i) =>
      beats.push({ icon: '📖', title: i === 0 ? 'The Story' : 'Continued…', lines: [c], type: 'story' })
    );
  }

  if (node.history)
    beats.push({ icon: '⏳', title: 'History', lines: [node.history], type: 'history' });

  if (node.culturalRole)
    beats.push({ icon: '🌐', title: 'Cultural Role', lines: [node.culturalRole], type: 'culture' });

  if (node.architecture)
    beats.push({ icon: '🏛', title: 'Architecture', lines: [node.architecture], type: 'arch' });

  if (node.significance)
    beats.push({ icon: '✦', title: 'Significance', lines: [node.significance], type: 'culture' });

  if (node.rituals?.length) {
    const half = Math.ceil(node.rituals.length / 2);
    beats.push({ icon: '🙏', title: 'Rituals & Traditions', lines: node.rituals.slice(0, half), type: 'rituals' });
    if (node.rituals.length > half)
      beats.push({ icon: '🙏', title: 'More Rituals', lines: node.rituals.slice(half), type: 'rituals' });
  }

  if (node.visitNote)
    beats.push({ icon: 'ℹ', title: 'Visitor Guide', lines: [node.visitNote], type: 'visit' });

  return beats;
}
