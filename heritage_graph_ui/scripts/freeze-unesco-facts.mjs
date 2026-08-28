#!/usr/bin/env node
/**
 * Freeze sourced structured facts for the UNESCO cultural subjects.
 *
 * WHY THIS EXISTS
 * The demo corpus's descriptive fields are unsourced by its own admission, so
 * the museum could show almost nothing defensible about a monument zone —
 * Hanuman Dhoka in particular rendered as little more than a title and a photo.
 *
 * Wikidata carries genuinely structured, citable claims for these subjects, and
 * one of them matters more than the rest: P757, the official UNESCO World
 * Heritage Site ID. Every Kathmandu Valley zone carries a component reference
 * of the form `121bis-00N`, which is the authoritative statement that these are
 * components of ONE property (121bis) rather than seven separate sites. That is
 * exactly the distinction this platform has to get right, and here it comes from
 * the source rather than from prose.
 *
 * Each fact is written with its source, the Wikidata property it came from, and
 * a retrieval date, so it can be re-checked. Nothing is inferred: a property
 * that is absent is simply not written.
 *
 * Usage:  node scripts/freeze-unesco-facts.mjs
 *         node scripts/freeze-unesco-facts.mjs --check   (CI: fail if stale)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'src', 'data', 'unesco-facts.json');
const UA = 'HeritageGraph-CorpusFreezer/1.0 (https://github.com/CAIRNepal/heritagegraph; info@cair-nepal.org)';
const CHECK = process.argv.includes('--check');

/** subjectKey → Wikidata QID, resolved from the English Wikipedia sitelink. */
const SUBJECTS = {
  'hanuman-dhoka': 'Q6122177',
  'patan-durbar-square': 'Q7144236',
  'bhaktapur-durbar-square': 'Q4900869',
  swayambhu: 'Q12946982',
  bauddhanath: 'Q889902',
  pashupati: 'Q380384',
  'changu-narayan': 'Q1062150',
  lumbini: 'Q9213',
  'kathmandu-valley': 'Q970717',
};

/**
 * Properties worth surfacing, in the order a reader wants them.
 * `kind` drives formatting; `item` values need a second lookup for their label.
 */
const PROPS = [
  { pid: 'P757', key: 'worldHeritageId', kind: 'string' },
  { pid: 'P31', key: 'instanceOf', kind: 'item' },
  { pid: 'P361', key: 'partOf', kind: 'item' },
  { pid: 'P131', key: 'locatedIn', kind: 'item' },
  { pid: 'P17', key: 'country', kind: 'item' },
  { pid: 'P571', key: 'inception', kind: 'time' },
  { pid: 'P2046', key: 'area', kind: 'quantity' },
  { pid: 'P149', key: 'architecturalStyle', kind: 'item' },
  { pid: 'P84', key: 'architect', kind: 'item' },
];

async function wd(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

/** Batch-resolve QIDs to English labels. */
async function labelsFor(ids) {
  const out = new Map();
  const list = [...ids];
  for (let i = 0; i < list.length; i += 45) {
    const chunk = list.slice(i, i + 45);
    const u = new URL('https://www.wikidata.org/w/api.php');
    u.searchParams.set('action', 'wbgetentities');
    u.searchParams.set('format', 'json');
    u.searchParams.set('props', 'labels');
    u.searchParams.set('languages', 'en');
    u.searchParams.set('ids', chunk.join('|'));
    const j = await wd(u.toString());
    for (const [qid, ent] of Object.entries(j.entities ?? {})) {
      const l = ent?.labels?.en?.value;
      if (l) out.set(qid, l);
    }
  }
  return out;
}

/** ISO time value → a year or date string, never a guess about precision. */
function formatTime(v) {
  // Wikidata precision: 9 = year, 10 = month, 11 = day.
  const m = /^([+-])(\d{4})-(\d{2})-(\d{2})/.exec(v.time || '');
  if (!m) return null;
  const [, sign, y, mo, d] = m;
  const era = sign === '-' ? ' BCE' : '';
  if (v.precision >= 11) return `${y}-${mo}-${d}${era}`;
  if (v.precision === 10) return `${y}-${mo}${era}`;
  if (v.precision === 9) return `${Number(y)}${era}`;
  return null; // coarser than a year — do not pretend to a value
}

const UNITS = { Q35852: 'ha', Q25343: 'm²', Q712226: 'km²' };

async function main() {
  const retrieved = new Date().toISOString().slice(0, 10);
  const raw = {};
  for (const [key, qid] of Object.entries(SUBJECTS)) {
    raw[key] = await wd(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  }

  // Collect every item-valued QID so labels can be fetched in one pass.
  const needLabels = new Set();
  for (const [key, doc] of Object.entries(raw)) {
    const claims = Object.values(doc.entities)[0].claims ?? {};
    for (const { pid, kind } of PROPS) {
      if (kind !== 'item') continue;
      for (const st of claims[pid] ?? []) {
        const id = st.mainsnak?.datavalue?.value?.id;
        if (id) needLabels.add(id);
      }
    }
    void key;
  }
  const labels = await labelsFor(needLabels);

  const subjects = {};
  for (const [key, qid] of Object.entries(SUBJECTS)) {
    const ent = Object.values(raw[key].entities)[0];
    const claims = ent.claims ?? {};
    const facts = {};
    for (const { pid, key: fk, kind } of PROPS) {
      const sts = (claims[pid] ?? []).filter((s) => s.mainsnak?.snaktype === 'value');
      if (!sts.length) continue;
      const values = [];
      for (const st of sts) {
        const v = st.mainsnak.datavalue.value;
        if (kind === 'string') values.push(String(v));
        else if (kind === 'item') { const l = labels.get(v.id); if (l) values.push(l); }
        else if (kind === 'time') { const t = formatTime(v); if (t) values.push(t); }
        else if (kind === 'quantity') {
          const unit = UNITS[String(v.unit).split('/').pop()];
          const amt = Number(v.amount);
          if (Number.isFinite(amt)) values.push(unit ? `${amt} ${unit}` : String(amt));
        }
      }
      if (values.length) facts[fk] = { values, property: pid };
    }
    subjects[key] = {
      wikidataId: qid,
      wikidataUrl: `https://www.wikidata.org/wiki/${qid}`,
      label: ent.labels?.en?.value ?? null,
      facts,
    };
    const n = Object.keys(facts).length;
    console.log(`  ${key.padEnd(24)} ${qid.padEnd(11)} ${n} facts${facts.worldHeritageId ? `  WHS ${facts.worldHeritageId.values[0]}` : ''}`);
  }

  const doc = {
    _provenance: {
      generatedBy: 'scripts/freeze-unesco-facts.mjs',
      retrieved,
      source: 'Wikidata',
      note:
        'Structured claims only — no prose. Each fact records the Wikidata property it came from so it can be re-checked at the wikidataUrl. A property that is absent for a subject is omitted rather than guessed. P757 is the official UNESCO World Heritage Site ID; for Kathmandu Valley zones it takes the form 121bis-00N, which is the authoritative statement that they are components of one property.',
    },
    subjects,
  };
  const next = JSON.stringify(doc, null, 2) + '\n';

  if (CHECK) {
    let cur = '';
    try { cur = await readFile(OUT, 'utf8'); } catch { /* absent → stale */ }
    const strip = (s) => s.replace(/"retrieved": "\d{4}-\d{2}-\d{2}"/g, '"retrieved": "*"');
    if (strip(cur) !== strip(next)) {
      console.error('unesco-facts.json is stale — run: node scripts/freeze-unesco-facts.mjs');
      process.exit(1);
    }
    console.log('unesco-facts.json is current.');
    return;
  }
  await writeFile(OUT, next, 'utf8');
  console.log(`\nWrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
