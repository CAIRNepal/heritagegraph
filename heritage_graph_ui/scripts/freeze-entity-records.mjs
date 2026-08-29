#!/usr/bin/env node
/**
 * Build a sourced record for every corpus entity that can have one.
 *
 * Only the eight UNESCO subjects had facts and a description; the other
 * thirty-eight showed a photo, a type and nothing else. This walks every node
 * in heritage-demo.json that carries a wikipediaTitle, resolves it to a
 * Wikidata item, and stores that item's structured claims plus the article's
 * lead paragraph.
 *
 * Two rules, same as the UNESCO scripts:
 *  - A property that is absent is omitted, never guessed.
 *  - Sentences asserting UNESCO World Heritage status are dropped, because the
 *    source articles say "World Heritage Sites" in the plural about the Durbar
 *    Squares. The count of dropped sentences is stored and shown in the UI.
 *
 * Usage:  node scripts/freeze-entity-records.mjs
 *         node scripts/freeze-entity-records.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(__dirname, '..', 'src', 'data', 'heritage-demo.json');
const OUT = path.join(__dirname, '..', 'src', 'data', 'entity-records.json');
const WP = 'https://en.wikipedia.org/w/api.php';
const WD = 'https://www.wikidata.org/w/api.php';
const UA = 'HeritageGraph-CorpusFreezer/1.0 (https://github.com/CAIRNepal/heritagegraph; info@cair-nepal.org)';
const CHECK = process.argv.includes('--check');

/**
 * Properties worth showing a general reader, in reading order.
 * Deliberately broader than the UNESCO set: the corpus holds deities,
 * festivals, people and periods as well as buildings.
 */
const PROPS = [
  { pid: 'P757', key: 'worldHeritageId', kind: 'string' },
  { pid: 'P31', key: 'instanceOf', kind: 'item' },
  { pid: 'P571', key: 'inception', kind: 'time' },
  { pid: 'P1435', key: 'heritageDesignation', kind: 'item' },
  { pid: 'P361', key: 'partOf', kind: 'item' },
  { pid: 'P131', key: 'locatedIn', kind: 'item' },
  { pid: 'P17', key: 'country', kind: 'item' },
  { pid: 'P2046', key: 'area', kind: 'quantity' },
  { pid: 'P2044', key: 'elevation', kind: 'quantity' },
  { pid: 'P149', key: 'architecturalStyle', kind: 'item' },
  { pid: 'P84', key: 'architect', kind: 'item' },
  { pid: 'P140', key: 'religion', kind: 'item' },
  { pid: 'P1049', key: 'venerated', kind: 'item' },
  { pid: 'P569', key: 'birth', kind: 'time' },
  { pid: 'P570', key: 'death', kind: 'time' },
  { pid: 'P106', key: 'occupation', kind: 'item' },
  { pid: 'P27', key: 'citizenship', kind: 'item' },
  { pid: 'P97', key: 'title', kind: 'item' },
  { pid: 'P2348', key: 'period', kind: 'item' },
  { pid: 'P580', key: 'startTime', kind: 'time' },
  { pid: 'P582', key: 'endTime', kind: 'time' },
];

const UNITS = { Q35852: 'ha', Q25343: 'm²', Q712226: 'km²', Q11573: 'm', Q828224: 'km' };
const DROP = /world heritage|unesco/i;
const MAX_TEXT = 620;
const MAX_VALUES = 3;

async function api(base, params) {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${base} → ${res.status}`);
  return res.json();
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function formatTime(v) {
  const m = /^([+-])(\d+)-(\d{2})-(\d{2})/.exec(v.time || '');
  if (!m) return null;
  const [, sign, y, mo, d] = m;
  const era = sign === '-' ? ' BCE' : '';
  if (v.precision >= 11) return `${y}-${mo}-${d}${era}`;
  if (v.precision === 10) return `${y}-${mo}${era}`;
  if (v.precision === 9) return `${Number(y)}${era}`;
  if (v.precision === 8) return `${Number(y)}s${era}`;
  if (v.precision === 7) return `${Math.ceil(Number(y) / 100)}th century${era}`;
  return null;
}

function sentences(text) {
  return text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z(])/).map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const corpus = JSON.parse(await readFile(CORPUS, 'utf8'));
  const nodes = (corpus['@graph'] ?? []).filter((n) => n.nodeType && n.wikipediaTitle);
  console.log(`${nodes.length} entities carry a wikipediaTitle`);

  const titles = [...new Set(nodes.map((n) => n.wikipediaTitle))];

  // ── titles → QIDs and lead extracts, in batches ──
  const qidByTitle = new Map();
  const extractByTitle = new Map();
  const resolved = new Map(); // requested title -> canonical title
  for (const batch of chunk(titles, 20)) {
    const j = await api(WP, {
      action: 'query', format: 'json', redirects: '1',
      prop: 'pageprops|extracts', ppprop: 'wikibase_item',
      exintro: '1', explaintext: '1', exsectionformat: 'plain',
      titles: batch.join('|'),
    });
    const q = j.query ?? {};
    const alias = new Map();
    for (const n of q.normalized ?? []) alias.set(n.from, n.to);
    for (const r of q.redirects ?? []) alias.set(r.from, r.to);
    for (const t of batch) resolved.set(t, alias.get(t) ?? t);
    for (const p of Object.values(q.pages ?? {})) {
      const qid = p.pageprops?.wikibase_item;
      if (qid) qidByTitle.set(p.title, qid);
      if (p.extract) extractByTitle.set(p.title, p.extract);
    }
  }

  // ── QIDs → claims ──
  const claimsByQid = new Map();
  const allQids = [...new Set([...qidByTitle.values()])];
  for (const batch of chunk(allQids, 40)) {
    const j = await api(WD, {
      action: 'wbgetentities', format: 'json', props: 'claims', ids: batch.join('|'),
    });
    for (const [qid, ent] of Object.entries(j.entities ?? {})) {
      if (ent.claims) claimsByQid.set(qid, ent.claims);
    }
  }

  // ── item-valued QIDs → labels ──
  const needLabels = new Set();
  for (const claims of claimsByQid.values()) {
    for (const { pid, kind } of PROPS) {
      if (kind !== 'item') continue;
      for (const st of (claims[pid] ?? []).slice(0, MAX_VALUES)) {
        const id = st.mainsnak?.datavalue?.value?.id;
        if (id) needLabels.add(id);
      }
    }
  }
  const labels = new Map();
  for (const batch of chunk([...needLabels], 45)) {
    const j = await api(WD, {
      action: 'wbgetentities', format: 'json', props: 'labels', languages: 'en',
      ids: batch.join('|'),
    });
    for (const [qid, ent] of Object.entries(j.entities ?? {})) {
      const l = ent?.labels?.en?.value;
      if (l) labels.set(qid, l);
    }
  }

  const retrieved = new Date().toISOString().slice(0, 10);
  const entities = {};
  let withFacts = 0, withText = 0;

  for (const node of nodes) {
    const canonical = resolved.get(node.wikipediaTitle) ?? node.wikipediaTitle;
    const qid = qidByTitle.get(canonical) ?? null;
    const claims = qid ? claimsByQid.get(qid) : null;

    const facts = {};
    if (claims) {
      for (const { pid, key, kind } of PROPS) {
        const sts = (claims[pid] ?? []).filter((s) => s.mainsnak?.snaktype === 'value').slice(0, MAX_VALUES);
        if (!sts.length) continue;
        const values = [];
        for (const st of sts) {
          const v = st.mainsnak.datavalue.value;
          if (kind === 'string') values.push(String(v));
          else if (kind === 'item') { const l = labels.get(v.id); if (l) values.push(l); }
          else if (kind === 'time') { const tt = formatTime(v); if (tt) values.push(tt); }
          else if (kind === 'quantity') {
            const unit = UNITS[String(v.unit).split('/').pop()];
            const amt = Number(v.amount);
            if (Number.isFinite(amt)) values.push(unit ? `${amt} ${unit}` : String(amt));
          }
        }
        if (values.length) facts[key] = { values, property: pid };
      }
    }

    let description = null;
    const raw = extractByTitle.get(canonical);
    if (raw) {
      const all = sentences(raw);
      const kept = all.filter((s) => !DROP.test(s));
      let text = '';
      for (const s of kept) {
        if (text && text.length + s.length + 1 > MAX_TEXT) break;
        text = text ? `${text} ${s}` : s;
      }
      if (text) {
        description = {
          text,
          sentencesRemoved: all.length - kept.length,
          sourceTitle: canonical,
          sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(canonical.replace(/ /g, '_'))}`,
          license: 'CC BY-SA 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
          retrieved,
        };
      }
    }

    if (Object.keys(facts).length) withFacts += 1;
    if (description) withText += 1;

    entities[node['@id']] = {
      label: node.label,
      wikidataId: qid,
      wikidataUrl: qid ? `https://www.wikidata.org/wiki/${qid}` : null,
      facts,
      description,
    };
  }

  const doc = {
    _provenance: {
      generatedBy: 'scripts/freeze-entity-records.mjs',
      retrieved,
      sources: 'Wikidata claims; English Wikipedia lead sections (CC BY-SA 4.0)',
      note:
        'Keyed by corpus @id. Every fact records the Wikidata property it came from. Sentences mentioning UNESCO or World Heritage listing are removed from descriptions and the count is kept per entity, because the source articles describe the Kathmandu Valley Durbar Squares as separate World Heritage Sites when they are components of one property.',
    },
    entities,
  };
  const next = JSON.stringify(doc, null, 2) + '\n';

  if (CHECK) {
    let cur = '';
    try { cur = await readFile(OUT, 'utf8'); } catch { /* absent */ }
    const strip = (s) => s.replace(/"retrieved": "\d{4}-\d{2}-\d{2}"/g, '"retrieved": "*"');
    if (strip(cur) !== strip(next)) { console.error('entity-records.json is stale'); process.exit(1); }
    console.log('current.'); return;
  }
  await writeFile(OUT, next, 'utf8');
  console.log(`\n${withFacts} entities with facts, ${withText} with a description`);
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
