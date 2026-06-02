#!/usr/bin/env node
/**
 * Freeze the heritage-museum demo corpus with real per-image provenance.
 *
 * For every image URL in `src/data/heritage-demo.json` that points at a
 * Wikimedia file (en.wikipedia.org/.../Special:FilePath/<File>), this queries
 * the MediaWiki imageinfo API for the *actual* license, author, and file
 * description page, then writes that metadata back onto each node as
 * `imageCredits` (keyed by image URL). A top-level `_provenance` block records
 * when and how the corpus was frozen.
 *
 * This makes the demo dataset self-describing and citable (FAIR + CC-BY-SA
 * attribution) instead of relying on live, undated Wikipedia pulls. It never
 * invents metadata: files whose license/author cannot be retrieved are left
 * without a credit rather than given a fabricated one.
 *
 * Usage:  node scripts/freeze-heritage-corpus.mjs
 *         node scripts/freeze-heritage-corpus.mjs --check   (CI: fail if stale)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(__dirname, '..', 'src', 'data', 'heritage-demo.json');
const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'HeritageGraph-CorpusFreezer/1.0 (https://github.com/CAIRNepal/heritagegraph; info@cair-nepal.org)';
const CHECK = process.argv.includes('--check');

/** Pull the "File:Name.jpg" title out of a Special:FilePath URL. */
function fileTitle(url) {
  const m = /Special:FilePath\/([^?#]+)/.exec(url);
  if (!m) return null;
  return 'File:' + decodeURIComponent(m[1]);
}

/** MediaWiki treats underscores and spaces as equivalent; canonicalize to one. */
function canon(title) {
  return title.replace(/^File:/i, 'File:').replace(/_/g, ' ').trim();
}

/** Strip HTML tags / collapse whitespace from extmetadata values. */
function plain(html) {
  if (!html) return undefined;
  const text = String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return text || undefined;
}

async function fetchImageInfo(titles) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Credit|AttributionRequired',
    titles: titles.join('|'),
    redirects: '1',
  });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`API ${res.status} for ${titles.length} titles`);
  const json = await res.json();
  const credits = new Map(); // canon(requested title) -> credit
  const present = new Set(); // canon(requested title) of files that actually exist
  const query = json?.query ?? {};

  // Map any title the API normalized/redirected back to its resolved page title.
  const aliasToResolved = new Map();
  for (const n of query.normalized ?? []) aliasToResolved.set(canon(n.from), canon(n.to));
  for (const r of query.redirects ?? []) aliasToResolved.set(canon(r.from), canon(r.to));

  const resolvedExists = new Set();
  const resolvedToCredit = new Map();
  for (const page of Object.values(query.pages ?? {})) {
    // Existence = imageinfo is present. Commons-hosted files report the local
    // wiki page as missing ("missing": "") yet still return imageinfo, so the
    // `missing` flag alone is not a reliable existence signal.
    const info = page.imageinfo?.[0];
    if (!info) continue;
    resolvedExists.add(canon(page.title));
    const ext = info.extmetadata ?? {};
    const credit = {
      license: plain(ext.LicenseShortName?.value),
      licenseUrl: ext.LicenseUrl?.value || undefined,
      artist: plain(ext.Artist?.value) || plain(ext.Credit?.value),
      descriptionUrl: info.descriptionurl || undefined,
      source: 'Wikimedia',
      retrieved: new Date().toISOString().slice(0, 10),
    };
    // Drop empties so we never store a hollow credit object.
    if (credit.license || credit.artist || credit.descriptionUrl) {
      resolvedToCredit.set(canon(page.title), credit);
    }
  }

  // Re-key by every requested title, following any alias chain.
  for (const requested of titles) {
    const key = canon(requested);
    const resolved = aliasToResolved.get(key) ?? key;
    if (resolvedExists.has(resolved)) present.add(key);
    const credit = resolvedToCredit.get(resolved);
    if (credit) credits.set(key, credit);
  }
  return { credits, present };
}

async function main() {
  const raw = JSON.parse(await readFile(CORPUS, 'utf8'));
  const graph = raw['@graph'] ?? [];

  // Collect unique titles across all nodes.
  const urlToTitle = new Map();
  for (const node of graph) {
    const urls = [node.imageUrl, ...(Array.isArray(node.images) ? node.images : [])].filter(Boolean);
    for (const u of urls) {
      const title = fileTitle(u);
      if (title) urlToTitle.set(u, title);
    }
  }
  const uniqueTitles = [...new Set(urlToTitle.values())];
  console.log(`Resolving ${urlToTitle.size} image URLs (${uniqueTitles.length} unique files)…`);

  // Batch the API (50 titles per request) with a small delay between calls.
  const titleToCredit = new Map(); // canon(title) -> credit
  const presentTitles = new Set(); // canon(title) of files confirmed to exist
  for (let i = 0; i < uniqueTitles.length; i += 50) {
    const batch = uniqueTitles.slice(i, i + 50);
    const { credits, present } = await fetchImageInfo(batch);
    for (const [k, v] of credits) titleToCredit.set(k, v);
    for (const k of present) presentTitles.add(k);
    if (i + 50 < uniqueTitles.length) await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`Files: ${presentTitles.size} exist, ${uniqueTitles.length - presentTitles.size} missing (404).`);
  console.log(`License/attribution captured for ${titleToCredit.size} files.`);

  // Prune dead image references and attach imageCredits per node. We only drop
  // URLs the API positively reports as missing — never on a transient failure.
  let withCredit = 0, pruned = 0;
  const keepUrl = (u) => presentTitles.has(canon(urlToTitle.get(u) ?? ''));
  for (const node of graph) {
    if (node.imageUrl && !keepUrl(node.imageUrl)) { delete node.imageUrl; pruned++; }
    if (Array.isArray(node.images)) {
      const before = node.images.length;
      node.images = node.images.filter(keepUrl);
      pruned += before - node.images.length;
      if (!node.images.length) delete node.images;
      else if (!node.imageUrl) node.imageUrl = node.images[0]; // keep a hero image
    }

    const urls = [node.imageUrl, ...(Array.isArray(node.images) ? node.images : [])].filter(Boolean);
    const credits = {};
    for (const u of urls) {
      const credit = titleToCredit.get(canon(urlToTitle.get(u)));
      if (credit) { credits[u] = credit; withCredit++; }
    }
    if (Object.keys(credits).length) node.imageCredits = credits;
    else delete node.imageCredits;
  }
  console.log(`Pruned ${pruned} dead image reference(s).`);

  raw._provenance = {
    generatedBy: 'scripts/freeze-heritage-corpus.mjs',
    retrieved: new Date().toISOString().slice(0, 10),
    imageSource: 'Wikimedia (en.wikipedia.org imageinfo API)',
    note: 'Per-image license/attribution captured at the date above. Verify before redistribution.',
  };

  const serialized = JSON.stringify(raw, null, 2) + '\n';

  if (CHECK) {
    const current = await readFile(CORPUS, 'utf8');
    if (current !== serialized) {
      console.error('✗ heritage-demo.json is stale — run: node scripts/freeze-heritage-corpus.mjs');
      process.exit(1);
    }
    console.log('✓ corpus provenance is up to date');
    return;
  }

  await writeFile(CORPUS, serialized);
  console.log(`✓ Wrote ${withCredit} image credits into ${path.relative(process.cwd(), CORPUS)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
