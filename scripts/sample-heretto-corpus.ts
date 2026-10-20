#!/usr/bin/env -S npx tsx
// FR-064 — sampled real-topic byte-stability corpus.
//
// Why this exists: BUG-25 (<p> wrapping a block) and BUG-26 (adjacent
// same-type lists merge) both lived in the serializer for months because no
// fixture in the hand-written corpus contained a pattern that most real
// Heretto topics contain. Synthetic fixtures encode what the author already
// knows to worry about. This script pulls a deterministic sample of real
// topics from Heretto, across every topic type, plus one topic per structural
// pattern not yet represented in the existing corpus, scrubs personal data,
// and writes them + a manifest under tests/sync/fixtures/sampled/.
//
// Run: npx tsx scripts/sample-heretto-corpus.ts
// (also wired as `npm run corpus:sample`)
//
// Reads ~/heretto.json ({ host, rootUuid, email, token }) — the same file the
// app itself reads. Nothing here is tenant-specific; the exclude list and
// sample size are the only hardcoded choices, both named in the manifest.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Deterministic seed — change only if you want a different sample. */
const SEED = 20261020;

/** How many topics to sample per resource `type`. */
const SAMPLE_PER_TYPE = 5;

/**
 * Folders excluded from sampling. Content_Warehouses/DITAVALs are reuse
 * infrastructure, not authored topics; support-center-test/Training/Pendo are
 * non-representative or lower-value for a round-trip corpus. This list is
 * recorded in the manifest so the choice is reviewable — it is not a secret,
 * just a sampling decision.
 */
const EXCLUDED_FOLDER_NAMES = new Set([
  'Content_Warehouses',
  'DITAVALs',
  'support-center-test',
  'Pendo',
  'Training',
]);

/**
 * Structural patterns the hand-written corpus does not yet cover, detected by
 * a regex over the raw XML. One extra topic is sampled per pattern still
 * missing after the per-type sample, keyed by a short label used in the
 * manifest and in generated test names.
 */
const STRUCTURE_PROBES: { label: string; test: (xml: string) => boolean }[] = [
  { label: 'dl', test: xml => /<dl[\s>]/.test(xml) },
  { label: 'simpletable', test: xml => /<simpletable[\s>]/.test(xml) },
  { label: 'fig', test: xml => /<fig[\s>]/.test(xml) },
  { label: 'choices', test: xml => /<choices[\s>]/.test(xml) },
  { label: 'substeps', test: xml => /<substeps[\s>]/.test(xml) },
  { label: 'stepxmp', test: xml => /<stepxmp[\s>]/.test(xml) },
  { label: 'stepresult', test: xml => /<stepresult[\s>]/.test(xml) },
  { label: 'example', test: xml => /<example[\s>]/.test(xml) },
  { label: 'nested-section', test: xml => /<section\b[^>]*>(?:(?!<\/?section\b)[\s\S])*<section[\s>]/.test(xml) },
  // The exact pattern that caused BUG-25: a <p> whose children include a
  // block element before the closing tag.
  { label: 'p-wraps-block', test: xml => /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?<(ul|ol|note|table|codeblock|dl)[\s>]/.test(xml) },
  // The exact pattern that caused BUG-26: two list elements of the same tag
  // as siblings with nothing but whitespace/other-non-list content between
  // close-of-one and open-of-next at the same nesting depth. Approximated:
  // look for "</ol>...<ol" or "</ul>...<ul" within a short window (same
  // parent is likely if there's no intervening block-level open tag).
  { label: 'adjacent-same-list', test: xml => /<\/(ol|ul)>(?:\s|<\?[^>]*\?>)*<\1[\s>]/.test(xml) },
  { label: 'review-pi', test: xml => /<\?ezd-review/.test(xml) },
  { label: 'block-conref', test: xml => /<(p|note|table|section)\b[^>]*\bconref="/.test(xml) },
  { label: 'image-in-p', test: xml => /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?<image[\s>]/.test(xml) },
];

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) — no dependency, stable across Node versions
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Heretto REST
// ---------------------------------------------------------------------------

interface HerettoConfig { host: string; rootUuid: string; email: string; token: string }

function loadConfig(): HerettoConfig {
  const path = join(homedir(), 'heretto.json');
  if (!existsSync(path)) {
    throw new Error(`~/heretto.json not found. This script reads the same credentials file the app uses.`);
  }
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  for (const key of ['host', 'rootUuid', 'email', 'token']) {
    if (!raw[key]) throw new Error(`~/heretto.json is missing "${key}".`);
  }
  return raw;
}

async function herettoGet(config: HerettoConfig, path: string): Promise<string> {
  const auth = Buffer.from(`${config.email}:${config.token}`).toString('base64');
  const res = await fetch(`https://${config.host}${path}`, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
  return res.text();
}

interface Resource { uuid: string; name: string; type: string; path: string }

/** Recursively enumerate the repository from rootUuid, skipping excluded folder names. */
async function enumerateRepository(config: HerettoConfig): Promise<{ resources: Resource[]; foldersScanned: number; foldersSkipped: string[] }> {
  const resources: Resource[] = [];
  const foldersSkipped: string[] = [];
  let foldersScanned = 0;
  const frontier: Array<{ uuid: string; path: string }> = [{ uuid: config.rootUuid, path: '' }];
  const seen = new Set<string>();

  while (frontier.length > 0) {
    const batch = frontier.splice(0, 40).filter(f => !seen.has(f.uuid));
    for (const f of batch) seen.add(f.uuid);

    await Promise.all(batch.map(async ({ uuid, path }) => {
      let xml: string;
      try {
        xml = await herettoGet(config, `/rest/all-files/${uuid}`);
      } catch {
        return;
      }
      foldersScanned++;
      for (const m of xml.matchAll(/<folder name="([^"]*)" id="([^"]+)"/g)) {
        const [, name, id] = m;
        if (EXCLUDED_FOLDER_NAMES.has(name)) { foldersSkipped.push(`${path}/${name}`); continue; }
        frontier.push({ uuid: id, path: `${path}/${name}` });
      }
      for (const m of xml.matchAll(/<resource name="([^"]*)" type="([^"]*)" id="([^"]+)"/g)) {
        const [, name, type, id] = m;
        if (name.toLowerCase().endsWith('.dita') && type) {
          resources.push({ uuid: id, name, type, path: `${path}/${name}` });
        }
      }
    }));
  }

  return { resources, foldersScanned, foldersSkipped };
}

// ---------------------------------------------------------------------------
// Scrubbing (I2: no real person's name or email in a fixture)
// ---------------------------------------------------------------------------

function scrub(xml: string): string {
  let out = xml;
  // <author ...>Real Name <email></author> and any bare <author>text</author>
  out = out.replace(/<author\b([^>]*)>[\s\S]*?<\/author>/g, '<author$1>Example Author &lt;author@example.com&gt;</author>');
  // Any email address anywhere else (e.g. inside prolog metadata, body text).
  out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'author@example.com');
  // Blank out free-text prolog metadata values (critdates/etc. are dates, not names — leave structure, clear text content only inside <metadata>).
  out = out.replace(/<metadata\b([^>]*)>[\s\S]*?<\/metadata>/g, (whole) => {
    // Keep structural children (keywords/prodinfo) but strip any inline text content.
    return whole.replace(/>([^<>]+)</g, (m2: string, text: string) => `>${text.trim() ? '' : text}<`);
  });
  return out;
}

function containsNonExampleEmail(xml: string): boolean {
  const emails = xml.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
  return emails.some(e => e.toLowerCase() !== 'author@example.com');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name.replace(/\.dita$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function typeSlug(type: string): string {
  return type.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function main() {
  const config = loadConfig();
  console.log(`Enumerating Heretto repository at ${config.host} from root ${config.rootUuid}...`);
  const { resources, foldersScanned, foldersSkipped } = await enumerateRepository(config);
  console.log(`Scanned ${foldersScanned} folders, skipped ${foldersSkipped.length} excluded folders, found ${resources.length} .dita resources.`);

  const byType = new Map<string, Resource[]>();
  for (const r of resources) {
    if (!byType.has(r.type)) byType.set(r.type, []);
    byType.get(r.type)!.push(r);
  }
  console.log('By type:', Object.fromEntries([...byType.entries()].map(([t, rs]) => [t, rs.length])));

  const rand = mulberry32(SEED);
  const selected = new Map<string, { resource: Resource; reason: string }>();

  // Per-type sample.
  for (const [type, rs] of byType) {
    const shuffled = seededShuffle(rs, rand);
    for (const r of shuffled.slice(0, SAMPLE_PER_TYPE)) {
      selected.set(r.uuid, { resource: r, reason: `type-sample:${type}` });
    }
  }

  // Fetch content for everything selected so far, to know which structures
  // are already covered, then look for one more topic per missing structure.
  const fetched = new Map<string, string>();
  async function fetchContent(uuid: string): Promise<string> {
    if (fetched.has(uuid)) return fetched.get(uuid)!;
    const xml = await herettoGet(config, `/rest/all-files/${uuid}/content`);
    fetched.set(uuid, xml);
    return xml;
  }

  console.log(`Fetching content for ${selected.size} per-type samples...`);
  for (const { resource } of selected.values()) {
    await fetchContent(resource.uuid).catch(() => fetched.set(resource.uuid, ''));
  }

  const coveredStructures = new Set<string>();
  for (const xml of fetched.values()) {
    for (const probe of STRUCTURE_PROBES) if (probe.test(xml)) coveredStructures.add(probe.label);
  }

  const missingStructures = STRUCTURE_PROBES.filter(p => !coveredStructures.has(p.label));
  console.log(`Structures still missing after per-type sample: ${missingStructures.map(p => p.label).join(', ') || '(none)'}`);

  if (missingStructures.length > 0) {
    // Search the full resource pool (not yet-fetched ones first) for each
    // missing structure, stopping once found or the pool is exhausted.
    const pool = seededShuffle(resources.filter(r => !selected.has(r.uuid)), rand);
    for (const probe of missingStructures) {
      for (const r of pool) {
        if (selected.has(r.uuid)) continue;
        const xml = await fetchContent(r.uuid).catch(() => '');
        if (xml && probe.test(xml)) {
          selected.set(r.uuid, { resource: r, reason: `structure:${probe.label}` });
          coveredStructures.add(probe.label);
          break;
        }
      }
    }
  }

  const stillMissing = STRUCTURE_PROBES.filter(p => !coveredStructures.has(p.label)).map(p => p.label);

  // Write fixtures + manifest.
  const fixturesRoot = join(__dirname, '..', 'tests', 'sync', 'fixtures', 'sampled');
  const manifestRows: string[] = [];
  const writtenPaths: string[] = [];

  for (const { resource, reason } of selected.values()) {
    const xml = fetched.get(resource.uuid);
    if (!xml) continue;
    const scrubbed = scrub(xml);
    if (containsNonExampleEmail(scrubbed)) {
      console.warn(`SKIPPING ${resource.path} — an email survived scrubbing. Investigate the scrub regex before re-running.`);
      continue;
    }
    const dir = join(fixturesRoot, typeSlug(resource.type));
    mkdirSync(dir, { recursive: true });
    const filename = `${slugify(resource.name)}.dita`;
    const fullPath = join(dir, filename);
    writeFileSync(fullPath, scrubbed, 'utf-8');
    const relPath = join(typeSlug(resource.type), filename);
    writtenPaths.push(relPath);

    const structuresPresent = STRUCTURE_PROBES.filter(p => p.test(scrubbed)).map(p => p.label);
    manifestRows.push(
      `| \`${relPath}\` | ${resource.type} | ${resource.uuid} | ${resource.path} | ${reason} | ${structuresPresent.join(', ') || '—'} |`,
    );
  }

  const manifest = `# Sampled corpus manifest

Generated by \`scripts/sample-heretto-corpus.ts\`, seed \`${SEED}\`, on ${new Date().toISOString().slice(0, 10)}.
Re-running with the same seed against an unchanged repository reproduces this exact sample (FR-064 invariant I1).

**Sampled folders:** everything under the configured \`rootUuid\` except: ${[...EXCLUDED_FOLDER_NAMES].join(', ')}.
**Repository scope at sample time:** ${foldersScanned} folders scanned, ${resources.length} \`.dita\` resources found across ${byType.size} types.
**Per-type sample size:** ${SAMPLE_PER_TYPE}.
**Structures still not represented after sampling:** ${stillMissing.join(', ') || '(none — every probed structure has at least one fixture)'}.

Every fixture has been scrubbed: \`<author>\` content and any email address replaced with \`author@example.com\`; prolog \`<metadata>\` free text cleared. Structure and class attributes are byte-exact to the source.

| Fixture | Type | Source UUID | Source path | Why sampled | Structures detected |
|---|---|---|---|---|---|
${manifestRows.join('\n')}
`;
  writeFileSync(join(fixturesRoot, 'MANIFEST.md'), manifest, 'utf-8');

  console.log(`\nWrote ${writtenPaths.length} fixtures to ${fixturesRoot}`);
  console.log(`Manifest: ${join(fixturesRoot, 'MANIFEST.md')}`);
  if (stillMissing.length > 0) {
    console.log(`\nNote: ${stillMissing.length} probed structure(s) found nowhere in the repository: ${stillMissing.join(', ')}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
