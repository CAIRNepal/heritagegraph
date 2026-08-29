#!/usr/bin/env node
/**
 * Assert that every locale carries exactly the same message keys.
 *
 * Parity is currently perfect and nothing protected it, so the first PR to add
 * an English string without its Nepali counterpart would have shipped a page
 * that renders a raw key path to Nepali readers. `next-intl` does not fail the
 * build for a missing key — it falls back and logs — so this has to be an
 * explicit gate.
 *
 * Reports every difference in both directions rather than the first, so one run
 * tells a contributor everything they need to add.
 *
 * Usage:  node scripts/check-locale-parity.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'messages');
/** The locale every other locale is compared against. */
const BASE = 'en';

/** Flatten to dotted leaf paths. Arrays count as leaves — order is content. */
function leaves(value, prefix = '', out = []) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of Object.keys(value)) {
      leaves(value[key], prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.push(prefix);
  }
  return out;
}

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
const locales = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [
      path.basename(f, '.json'),
      new Set(leaves(JSON.parse(await readFile(path.join(DIR, f), 'utf8')))),
    ]),
  ),
);

if (!locales[BASE]) {
  console.error(`No ${BASE}.json in ${DIR}`);
  process.exit(1);
}

const base = locales[BASE];
let failed = false;

for (const [locale, keys] of Object.entries(locales)) {
  if (locale === BASE) continue;
  const missing = [...base].filter((k) => !keys.has(k)).sort();
  const extra = [...keys].filter((k) => !base.has(k)).sort();
  if (missing.length === 0 && extra.length === 0) {
    console.log(`  ${locale}: ${keys.size} keys — parity with ${BASE}`);
    continue;
  }
  failed = true;
  console.error(`\n  ${locale}: ${keys.size} keys vs ${base.size} in ${BASE}`);
  for (const k of missing) console.error(`    missing in ${locale}:  ${k}`);
  for (const k of extra) console.error(`    not in ${BASE}:        ${k}`);
}

if (failed) {
  console.error('\nLocale parity check failed. Every string needs a real translation in every locale.');
  process.exit(1);
}
console.log(`Locale parity OK (${base.size} keys).`);
