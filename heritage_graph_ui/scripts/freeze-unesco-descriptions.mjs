#!/usr/bin/env node
/**
 * Freeze a short, attributed description for each UNESCO cultural subject.
 *
 * WHY
 * The museum could state facts about a monument zone but had nothing that read
 * like a description — the demo corpus's prose is unsourced by its own
 * admission, and inventing more was never an option. Wikipedia lead paragraphs
 * are citable, CC BY-SA, and can be quoted with attribution.
 *
 * THE ONE EDIT MADE, AND WHY
 * These leads repeatedly say the Durbar Squares "are UNESCO World Heritage
 * Sites" — plural, as though each were its own property. They are not: all
 * seven are components of one serial property, which is the single distinction
 * this platform exists to get right, and which the page states precisely a few
 * lines above using UNESCO's own 121bis-00N numbering.
 *
 * So sentences mentioning World Heritage listing are dropped, and the fact that
 * they were dropped is recorded in the data and shown in the UI. Quoting a
 * source is fine; quietly reproducing a claim we have just corrected is not,
 * and silently editing a quotation would be worse than either.
 *
 * Usage:  node scripts/freeze-unesco-descriptions.mjs
 *         node scripts/freeze-unesco-descriptions.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'src', 'data', 'unesco-descriptions.json');
const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'HeritageGraph-CorpusFreezer/1.0 (https://github.com/CAIRNepal/heritagegraph; info@cair-nepal.org)';
const CHECK = process.argv.includes('--check');

const SUBJECTS = {
  'hanuman-dhoka': 'Kathmandu Durbar Square',
  'patan-durbar-square': 'Patan Durbar Square',
  'bhaktapur-durbar-square': 'Bhaktapur Durbar Square',
  swayambhu: 'Swayambhunath',
  bauddhanath: 'Boudhanath',
  pashupati: 'Pashupatinath Temple',
  'changu-narayan': 'Changu Narayan',
  lumbini: 'Lumbini',
  'kathmandu-valley': 'Kathmandu Valley',
};

/** Sentences asserting World Heritage status are handled by ground truth. */
const DROP = /world heritage|unesco/i;

const MAX = 620;

function toSentences(text) {
  // Naive but adequate for encyclopaedic prose: split on sentence-final
  // punctuation followed by a capital. Abbreviations are rare in these leads.
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const titles = Object.values(SUBJECTS);
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    exsectionformat: 'plain',
    titles: titles.join('|'),
    redirects: '1',
  });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  const q = json.query ?? {};

  const alias = new Map();
  for (const n of q.normalized ?? []) alias.set(n.from, n.to);
  for (const r of q.redirects ?? []) alias.set(r.from, r.to);

  const byTitle = new Map();
  for (const p of Object.values(q.pages ?? {})) {
    if (p.extract) byTitle.set(p.title, { extract: p.extract, pageid: p.pageid });
  }

  const retrieved = new Date().toISOString().slice(0, 10);
  const subjects = {};
  for (const [key, title] of Object.entries(SUBJECTS)) {
    const resolved = alias.get(title) ?? title;
    const hit = byTitle.get(resolved);
    if (!hit) {
      subjects[key] = null;
      console.warn(`  ✗ ${key}: no extract`);
      continue;
    }
    const all = toSentences(hit.extract);
    const kept = all.filter((s) => !DROP.test(s));
    const removed = all.length - kept.length;

    let text = '';
    for (const s of kept) {
      if (text && (text.length + s.length + 1) > MAX) break;
      text = text ? `${text} ${s}` : s;
    }
    if (!text) {
      subjects[key] = null;
      console.warn(`  ✗ ${key}: nothing left after filtering`);
      continue;
    }

    subjects[key] = {
      text,
      sentencesRemoved: removed,
      source: 'Wikipedia',
      sourceTitle: resolved,
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(resolved.replace(/ /g, '_'))}`,
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      retrieved,
    };
    console.log(`  ✓ ${key.padEnd(24)} ${text.length} chars, ${removed} sentence(s) removed`);
  }

  const doc = {
    _provenance: {
      generatedBy: 'scripts/freeze-unesco-descriptions.mjs',
      retrieved,
      source: 'English Wikipedia lead sections, via the MediaWiki extracts API',
      license: 'CC BY-SA 4.0 — attribution shown with every description',
      editorialNote:
        'Sentences mentioning UNESCO or World Heritage listing are removed. Those leads describe the Durbar Squares as World Heritage Sites in the plural, as though each were its own property; all seven are components of one serial property, which this platform states separately using UNESCO\'s own reference numbers. The count of removed sentences is kept per subject and surfaced in the UI, so the trimming is visible rather than silent.',
    },
    subjects,
  };
  const next = JSON.stringify(doc, null, 2) + '\n';

  if (CHECK) {
    let cur = '';
    try { cur = await readFile(OUT, 'utf8'); } catch { /* absent */ }
    const strip = (s) => s.replace(/"retrieved": "\d{4}-\d{2}-\d{2}"/g, '"retrieved": "*"');
    if (strip(cur) !== strip(next)) {
      console.error('unesco-descriptions.json is stale');
      process.exit(1);
    }
    console.log('current.');
    return;
  }
  await writeFile(OUT, next, 'utf8');
  console.log(`\nWrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
