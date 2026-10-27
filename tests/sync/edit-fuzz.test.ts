// @vitest-environment jsdom
//
// Edit fuzz over the byte-stability corpus (BUG-36 / BUG-34, 2026-10-22).
// Opt-in — about 18 s — so it is skipped in `npm test`; run it with
// `npm run test:edit-fuzz` after any change to the parser, the serializer, or
// the inline reconciler.
//
// For EVERY editable text node of EVERY fixture it appends a word in a fresh
// editor, serializes, and checks: no element appears or disappears (tag counts
// unchanged — appending text never needs either), the re-parsed text equals
// the editor's text (nothing lost, duplicated, or reordered), the word appears
// exactly once, and the reconciler did not bail. Failures are allowed only for
// causes already filed in KNOWN_FIXTURES below.
//
// Baseline when added: 1405 edits; before the BUG-36 fix 162 failed, after it
// 132 — every one of them in a known fixture or the BUG-37 pattern, 0 new.
// After BUG-29 (v0.10.2): 73 failed and 0 bailed (was 6) — 43 BUG-26, 30 the
// BUG-37 pattern; the four BUG-29 fixtures left KNOWN_FIXTURES.
// After BUG-37 (v0.10.3, bug sweep): the BUG-37 pattern allowance is gone — a
// <b>/<i>/<codeph> is spliced into like ordinary text, so appending to one no
// longer changes tag counts. 43 failures remain, all BUG-26; after BUG-26 the
// one left was BUG-44 (a <b> with a nested <i>, inline-elements.dita).
// After BUG-44 (v0.10.4): 1407 edits (a <b>'s nested <i> is its own text
// node now), 0 failed, 0 bailed; KNOWN_FIXTURES is empty.
// BUG-31 (ADR-012 B2): every edit also checks that the source-spelling pass
// left the document tree unchanged; at v0.10.4 the pass ran on all 1407 edits
// and re-spelled the output of 608, every one with the same tree.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';
import { $getRoot, $getNodeByKey, $isElementNode, $isTextNode, type LexicalNode } from 'lexical';
import { createTestEditor } from '../helpers/createTestEditor';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';
import { setReconcileObserver } from '../../sync/inline-reconcile';
import { setSourceSpellingObserver } from '../../sync/source-spelling';

/** The tree as XMLSerializer sees it: equal strings mean the same document. */
const tree = (xml: string): string =>
  new XMLSerializer().serializeToString(new DOMParser().parseFromString(xml, 'text/xml'));

const FIXTURES = join(__dirname, 'fixtures');

/** Fixtures whose edits are known to fail, and the bug that owns the failure. */
const KNOWN_FIXTURES: Record<string, string> = {};

const WORD = 'ZQXFUZZ';

const listFixtures = (dir: string): string[] =>
  readdirSync(dir).flatMap(e => {
    const f = join(dir, e);
    return statSync(f).isDirectory() ? listFixtures(f) : e.endsWith('.dita') ? [f] : [];
  }).sort();

const tagCounts = (xml: string): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const t of xml.replace(/<!--[\s\S]*?-->/g, '').match(/<[A-Za-z][\w-]*/g) ?? []) m[t.slice(1)] = (m[t.slice(1)] ?? 0) + 1;
  return m;
};

const textNodeKeys = (n: LexicalNode, out: string[]): void => {
  if ($isTextNode(n) && n.getType() === 'text' && n.getTextContent().trim()) out.push(n.getKey());
  if ($isElementNode(n)) n.getChildren().forEach(c => textNodeKeys(c, out));
};

interface Finding { fixture: string; index: number; detail: string }

describe.skipIf(!process.env.EDIT_FUZZ)('edit fuzz — append a word to every text node of every fixture', () => {
  it('no edit loses, duplicates, or reorders content outside already-filed causes', { timeout: 600_000 }, () => {
    const findings: Finding[] = [];
    let edits = 0;
    for (const file of listFixtures(FIXTURES)) {
      const xml = readFileSync(file, 'utf-8');
      const fixture = file.slice(FIXTURES.length + 1).split(sep).join('/');
      const count = (() => {
        const e = createTestEditor();
        parseXmlToLexical(xml, e, createNodeOriginMap(), true);
        const ks: string[] = [];
        e.getEditorState().read(() => textNodeKeys($getRoot(), ks));
        return ks.length;
      })();

      for (let index = 0; index < count; index++) {
        // A fresh editor per edit; the parse is deterministic, so the index-th
        // text node is the same node every time.
        const editor = createTestEditor();
        const originMap = createNodeOriginMap();
        parseXmlToLexical(xml, editor, originMap, true);
        const keys: string[] = [];
        editor.getEditorState().read(() => textNodeKeys($getRoot(), keys));
        editor.update(() => {
          const node = $getNodeByKey(keys[index]);
          if ($isTextNode(node)) node.setTextContent(`${node.getTextContent()} ${WORD}`);
        }, { discrete: true });

        const bails: string[] = [];
        setReconcileObserver(r => { if (r.status === 'bail') bails.push(`${r.tag}: ${r.reason} ${r.detail ?? ''}`); });
        // ADR-012 B2: the source-spelling pass may change spelling, never the document.
        let respelled = true;
        setSourceSpellingObserver((before, after) => { respelled = tree(before) === tree(after); });
        const out = serializeLexicalToXml(editor.getEditorState(), xml, originMap, createXmlMetaCache());
        setReconcileObserver(null);
        setSourceSpellingObserver(null);
        if (!respelled) bails.push('source-spelling pass changed the document tree');
        edits++;

        const before = tagCounts(xml);
        const after = tagCounts(out);
        const tagDiff = Object.keys({ ...before, ...after }).sort().filter(t => (before[t] ?? 0) !== (after[t] ?? 0));
        const reparsed = createTestEditor();
        parseXmlToLexical(out, reparsed, createNodeOriginMap(), true);
        const want = editor.getEditorState().read(() => $getRoot().getTextContent());
        const got = reparsed.getEditorState().read(() => $getRoot().getTextContent());
        const words = out.split(WORD).length - 1;

        if (tagDiff.length || got !== want || words !== 1 || bails.length) {
          findings.push({
            fixture,
            index,
            detail: `tags[${tagDiff.map(t => `${t} ${before[t] ?? 0}->${after[t] ?? 0}`).join(', ')}] text=${got === want ? 'ok' : 'DIFF'} word=${words} bails=[${bails.join(' | ')}]`,
          });
        }
      }
    }

    expect(edits).toBeGreaterThan(1000);
    const unexplained = findings.filter(f => !KNOWN_FIXTURES[f.fixture]);
    expect(unexplained.map(f => `${f.fixture}#${f.index}: ${f.detail}`)).toEqual([]);
  });
});
