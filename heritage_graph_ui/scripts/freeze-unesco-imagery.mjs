#!/usr/bin/env node
/**
 * Freeze the photography used by the UNESCO entry experience at `/`.
 *
 * WHY THIS IS SEPARATE FROM `freeze-heritage-corpus.mjs`
 * ─────────────────────────────────────────────────────────────────────────────
 * That script re-credits images that are *already* in the museum's demo corpus.
 * It cannot add one. The entry page needs a photograph for all eight cultural
 * subjects — the seven Kathmandu Valley monument zones plus Lumbini — and two
 * of those had no image anywhere in the project:
 *
 *   - Hanuman Dhoka Durbar Square: absent from the demo corpus entirely, and
 *     present in the reviewed graph only as two bare label-and-type stubs.
 *   - Lumbini: no image in either source.
 *
 * Rather than mutate the frozen demo corpus (whose narrative fields are
 * explicitly marked unciteable), this builds a small purpose-made manifest that
 * carries the same `ImageCredit` shape the museum already uses. The demo corpus
 * is left exactly as it is.
 *
 * WHAT IT DOES NOT DO
 * It never invents metadata. A file whose license or author cannot be
 * retrieved is written with `credit: null`, and the UI renders its explicit
 * "no photograph recorded" state rather than showing an uncredited image.
 *
 * Image selection is not editorial: each file is the lead image of the
 * corresponding English Wikipedia article, recorded below with the article it
 * came from so the choice is auditable and reproducible.
 *
 * Usage:  node scripts/freeze-unesco-imagery.mjs
 *         node scripts/freeze-unesco-imagery.mjs --check   (CI: fail if stale)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'src', 'data', 'unesco-imagery.json');
const API = 'https://en.wikipedia.org/w/api.php';
const UA =
  'HeritageGraph-CorpusFreezer/1.0 (https://github.com/CAIRNepal/heritagegraph; info@cair-nepal.org)';
const CHECK = process.argv.includes('--check');

/** Rendered width to request. Covers a full-bleed hero up to ~2560px CSS. */
const THUMB_WIDTH = 2000;

/**
 * subjectKey → the Wikipedia lead image to use.
 *
 * `sourceArticle` records where the file came from. It is provenance for the
 * *selection*, and is not rendered as a fact about the monument.
 *
 * Keys match `MonumentZone.key` in src/lib/unesco/ground-truth.ts, plus
 * `lumbini` for the second cultural property.
 */
const SUBJECTS = [
  { key: 'hanuman-dhoka', sourceArticle: 'Kathmandu Durbar Square', file: 'File:Basantapurpalace.JPG' },
  { key: 'patan-durbar-square', sourceArticle: 'Patan Durbar Square', file: 'File:Patan durbar square.jpg' },
  { key: 'bhaktapur-durbar-square', sourceArticle: 'Bhaktapur Durbar Square', file: 'File:View of Bhaktapur Durbar Square.jpg' },
  { key: 'swayambhu', sourceArticle: 'Swayambhunath', file: 'File:Swayambhunath 2018.jpg' },
  { key: 'bauddhanath', sourceArticle: 'Boudhanath', file: 'File:Boudhanath stupa , Kathmandu, Nepal.jpg' },
  { key: 'pashupati', sourceArticle: 'Pashupatinath Temple', file: 'File:Pashupatinath Temple-2020.jpg' },
  { key: 'changu-narayan', sourceArticle: 'Changu Narayan', file: 'File:Nepal - Changu Narayan (3566057331).jpg' },
  { key: 'lumbini', sourceArticle: 'Lumbini', file: 'File:BRP Lumbini Mayadevi temple.jpg' },
];

/** MediaWiki treats underscores and spaces as equivalent; canonicalize to one. */
function canon(title) {
  return title.replace(/_/g, ' ').trim();
}

/**
 * Drop the utm_* analytics parameters MediaWiki appends when the request comes
 * via en.wikipedia.org. They are tracking noise, not part of the file's
 * identity, and stored data should not carry them.
 */
function cleanUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (k.startsWith('utm_')) u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return url;
  }
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
    iiprop: 'url|size|extmetadata',
    // Ask for a width-bounded derivative, not the original. Some originals are
    // enormous — Swayambhunath_2018.jpg is 177 MB — and hot-linking originals
    // also gets rate-limited (HTTP 429) by upload.wikimedia.org. Either one
    // breaks the landing page's LCP budget.
    iiurlwidth: String(THUMB_WIDTH),
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Credit|AttributionRequired',
    titles: titles.join('|'),
    redirects: '1',
  });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`API ${res.status} for ${titles.length} titles`);
  const json = await res.json();
  const query = json?.query ?? {};

  const aliasToResolved = new Map();
  for (const n of query.normalized ?? []) aliasToResolved.set(canon(n.from), canon(n.to));
  for (const r of query.redirects ?? []) aliasToResolved.set(canon(r.from), canon(r.to));

  const resolved = new Map();
  for (const page of Object.values(query.pages ?? {})) {
    // Commons-hosted files report the local wiki page as "missing" yet still
    // return imageinfo, so presence of imageinfo — not absence of "missing" —
    // is what tells us the file exists.
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const ext = info.extmetadata ?? {};
    // thumburl/thumbwidth/thumbheight describe the derivative; url/width/height
    // describe the original. Store the derivative, and fall back to the
    // original only when MediaWiki declined to render one.
    resolved.set(canon(page.title), {
      url: cleanUrl(info.thumburl ?? info.url),
      width: info.thumbwidth ?? info.width,
      height: info.thumbheight ?? info.height,
      originalUrl: cleanUrl(info.url),
      originalBytes: info.size,
      credit: {
        license: plain(ext.LicenseShortName?.value),
        licenseUrl: plain(ext.LicenseUrl?.value),
        artist: plain(ext.Artist?.value) ?? plain(ext.Credit?.value),
        descriptionUrl: cleanUrl(info.descriptionurl),
        source: 'Wikimedia Commons',
      },
    });
  }

  const out = new Map();
  for (const requested of titles) {
    const key = canon(requested);
    out.set(key, resolved.get(aliasToResolved.get(key) ?? key) ?? null);
  }
  return out;
}

async function main() {
  const info = await fetchImageInfo(SUBJECTS.map((s) => s.file));
  const retrieved = new Date().toISOString().slice(0, 10);

  const subjects = {};
  let missing = 0;
  for (const s of SUBJECTS) {
    const hit = info.get(canon(s.file));
    if (!hit || !hit.credit?.license || !hit.credit?.artist) {
      // No fabricated attribution, and no uncredited image on screen.
      subjects[s.key] = { image: null, sourceArticle: s.sourceArticle, file: s.file };
      missing += 1;
      console.warn(`  ✗ ${s.key}: no usable credit for ${s.file} — will render the no-photograph state`);
      continue;
    }
    subjects[s.key] = {
      sourceArticle: s.sourceArticle,
      file: s.file,
      image: {
        url: hit.url,
        width: hit.width,
        height: hit.height,
        credit: { ...hit.credit, retrieved },
      },
      // Kept for auditability: which file this derivative came from.
      originalUrl: hit.originalUrl,
    };
    console.log(`  ✓ ${s.key}: ${hit.credit.license} — ${hit.credit.artist?.slice(0, 48)}`);
  }

  const doc = {
    _provenance: {
      generatedBy: 'scripts/freeze-unesco-imagery.mjs',
      retrieved,
      imageSource: 'Wikimedia (en.wikipedia.org imageinfo API)',
      selection:
        'Each file is the lead image of the English Wikipedia article named in `sourceArticle`. Recorded so the choice is auditable; it is provenance for the image, not a claim about the monument.',
      note: 'Per-image license/attribution captured at the date above. Verify before redistribution. Entries with `image: null` had no retrievable credit and must render the explicit no-photograph state.',
    },
    subjects,
  };

  const next = JSON.stringify(doc, null, 2) + '\n';

  if (CHECK) {
    let current = '';
    try {
      current = await readFile(OUT, 'utf8');
    } catch {
      /* file absent — treated as stale below */
    }
    // Ignore the retrieval date when diffing, or --check fails every new day.
    const strip = (s) => s.replace(/"retrieved": "\d{4}-\d{2}-\d{2}"/g, '"retrieved": "*"');
    if (strip(current) !== strip(next)) {
      console.error('unesco-imagery.json is stale — run: node scripts/freeze-unesco-imagery.mjs');
      process.exit(1);
    }
    console.log('unesco-imagery.json is current.');
    return;
  }

  await writeFile(OUT, next, 'utf8');
  console.log(`\nWrote ${OUT}`);
  console.log(`${SUBJECTS.length - missing}/${SUBJECTS.length} subjects have a credited photograph.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
