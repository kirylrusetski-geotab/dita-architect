// @vitest-environment jsdom
//
// ADR-013 decision 8 / I6 (P2-27 item 7): cross-file xref validation. Written
// before the code. For a tab opened from Heretto, an xref to another file is
// resolved from the tab's folder, the target fetched once, and the fragment
// checked the DITA way (#topicid, #topicid/elementid). A missing file or
// fragment underlines; a network error marks nothing; same-document #anchor
// validation is unchanged; local-file tabs are not checked.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $getRoot, $isElementNode, type LexicalEditor, type LexicalNode } from 'lexical';
import { $isLinkNode } from '@lexical/link';
import { EDITOR_NODES } from '../constants/editor-nodes';
import { SyncManager } from '../components/SyncManager';
import { InlineValidationPlugin } from '../components/InlineValidationPlugin';
import { isCrossFileHref, checkCrossFileHref, clearCrossFileCache } from '../lib/cross-file-xref';
import { clearHerettoPathCache } from '../lib/heretto-path';
import { herettoFolderCache } from '../constants/heretto';
import { serveHeretto, herettoRequests, type FakeTenant } from './helpers/fakeHeretto';

const TOPIC = (id: string, inner: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<concept id="${id}" class="- topic/topic concept/concept "><title class="- topic/title ">T</title><conbody class="- topic/body concept/conbody ">${inner}</conbody></concept>`;

/** a/ holds the open topic and other.dita; a sibling folder B holds far.dita. */
const tenant = (): FakeTenant => ({
  folders: {
    root: { name: 'master', parent: null },
    a: { name: 'A', parent: 'root' },
    b: { name: 'B', parent: 'root' },
  },
  files: {
    other: { name: 'other.dita', folder: 'a', content: TOPIC('other-topic', '<p id="present" class="- topic/p ">x</p>') },
    far: { name: 'far.dita', folder: 'b', content: TOPIC('far', '<section id="el" class="- topic/section "><p class="- topic/p ">y</p></section>') },
  },
});

beforeEach(() => {
  clearCrossFileCache();
  clearHerettoPathCache();
  herettoFolderCache.clear();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('isCrossFileHref', () => {
  it('a relative file path is cross-file; #anchors, URLs, and empty hrefs are not', () => {
    expect(isCrossFileHref('other.dita')).toBe(true);
    expect(isCrossFileHref('../B/far.dita#far/el')).toBe(true);
    expect(isCrossFileHref('#local')).toBe(false);
    expect(isCrossFileHref('')).toBe(false);
    expect(isCrossFileHref('https://example.com/a.dita')).toBe(false);
    expect(isCrossFileHref('mailto:someone@example.com')).toBe(false);
  });

  it('scope external/peer, format html, or a key reference opt out', () => {
    expect(isCrossFileHref('other.dita', { scope: 'external' })).toBe(false);
    expect(isCrossFileHref('other.dita', { scope: 'peer' })).toBe(false);
    expect(isCrossFileHref('other.html', { format: 'html' })).toBe(false);
    expect(isCrossFileHref('other.dita', { keyref: 'k' })).toBe(false);
    expect(isCrossFileHref('other.dita', { format: 'dita', scope: 'local' })).toBe(true);
  });
});

describe('checkCrossFileHref', () => {
  it('a present #topicid/elementid is ok', async () => {
    serveHeretto(tenant());
    expect(await checkCrossFileHref('other.dita#other-topic/present', 'a')).toEqual({ status: 'ok' });
  });

  it('a file with no fragment is ok when the file exists', async () => {
    serveHeretto(tenant());
    expect(await checkCrossFileHref('other.dita', 'a')).toEqual({ status: 'ok' });
  });

  it('a present #topicid is ok; a path that climbs resolves', async () => {
    serveHeretto(tenant());
    expect(await checkCrossFileHref('other.dita#other-topic', 'a')).toEqual({ status: 'ok' });
    expect(await checkCrossFileHref('../B/far.dita#far/el', 'a')).toEqual({ status: 'ok' });
  });

  it('a missing element id is broken, naming the target and the file', async () => {
    serveHeretto(tenant());
    expect(await checkCrossFileHref('other.dita#other-topic/absent', 'a')).toEqual({ status: 'broken', message: "Target 'other-topic/absent' not found in other.dita" });
  });

  it('a missing topic id is broken', async () => {
    serveHeretto(tenant());
    expect(await checkCrossFileHref('other.dita#wrong-topic', 'a')).toEqual({ status: 'broken', message: "Topic 'wrong-topic' not found in other.dita" });
  });

  it('an element id that exists only outside the named topic is broken', async () => {
    serveHeretto(tenant());
    expect((await checkCrossFileHref('far.dita#other-topic/el', 'b')).status).toBe('broken');
  });

  it('a missing file is broken', async () => {
    serveHeretto(tenant());
    expect(await checkCrossFileHref('missing.dita#x', 'a')).toEqual({ status: 'broken', message: "File 'missing.dita' not found in Heretto" });
  });

  it('a network error on the folder listing is unknown, never broken', async () => {
    serveHeretto(tenant(), { '/heretto-api/all-files/a': 'network' });
    expect(await checkCrossFileHref('other.dita#other-topic/absent', 'a')).toEqual({ status: 'unknown' });
  });

  it('a server error on the target content is unknown, never broken', async () => {
    serveHeretto(tenant(), { '/heretto-api/all-files/other/content': 500 });
    expect(await checkCrossFileHref('other.dita#other-topic/absent', 'a')).toEqual({ status: 'unknown' });
  });

  it('the target is fetched once per file, whatever fragments point into it', async () => {
    serveHeretto(tenant());
    await Promise.all([
      checkCrossFileHref('other.dita#other-topic/present', 'a'),
      checkCrossFileHref('other.dita#other-topic/absent', 'a'),
      checkCrossFileHref('other.dita#other-topic', 'a'),
    ]);
    await checkCrossFileHref('other.dita#other-topic/present', 'a');
    expect(herettoRequests.filter(r => r === '/heretto-api/all-files/other/content')).toHaveLength(1);
  });

  it('an unknown result is not cached: the next check tries again', async () => {
    serveHeretto(tenant(), { '/heretto-api/all-files/other/content': 500 });
    expect((await checkCrossFileHref('other.dita#other-topic/absent', 'a')).status).toBe('unknown');
    serveHeretto(tenant());
    expect((await checkCrossFileHref('other.dita#other-topic/absent', 'a')).status).toBe('broken');
  });
});

// ─── The underline is visible on a link (v0.11.0 smoke) ──────────────────────

describe('the broken-xref style wins over the link style', () => {
  // A source check, on purpose: jsdom does not expand the `text-decoration`
  // shorthand into its longhands, so a computed-style test passes even when a
  // browser shows a plain underline. The v0.11.0 smoke found exactly that —
  // `.dita-editor-text-link { text-decoration: underline }` (P2-30) comes later
  // than `.dita-validation-broken-xref` with the same specificity, so no broken
  // link, same-document or cross-file, ever showed its wavy underline.
  const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf-8');

  it('a rule more specific than the link rule draws the wavy underline, after the link rules', () => {
    const rule = css.match(/\.dita-editor-text-link\.dita-validation-broken-xref[^{]*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/text-decoration:\s*underline wavy var\(--validation-broken-xref\)/);
    expect(css.indexOf('.dita-editor-text-link.dita-validation-broken-xref')).toBeGreaterThan(css.indexOf('.dita-editor-text-link:hover'));
    expect(rule![0]).toContain(':hover');
  });
});

// ─── Through the mounted plugin ──────────────────────────────────────────────

const DOC = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="here"><title>T</title><conbody>${body}</conbody></concept>`;

describe('I6: InlineValidationPlugin marks cross-file xrefs', () => {
  let editorRef: LexicalEditor | null = null;
  const Capture = () => { const [e] = useLexicalComposerContext(); editorRef = e; return null; };

  async function mount(xml: string, folderUuid: string | null) {
    render(
      <LexicalComposer initialConfig={{ namespace: 'i6', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
        <RichTextPlugin contentEditable={<ContentEditable />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
        <Capture />
        <SyncManager xmlContent={xml} onLexicalChange={vi.fn()} lastUpdatedBy="code">
          <InlineValidationPlugin xmlContent={xml} validationTrigger={0} herettoFolderUuid={folderUuid} />
        </SyncManager>
      </LexicalComposer>,
    );
    // Debounce (300 ms) + the fetches + the re-validation they trigger.
    await act(async () => { await new Promise(r => setTimeout(r, 900)); });
    return editorRef!;
  }

  /** [href, has broken class, title] for every link. */
  const links = (editor: LexicalEditor) => editor.getEditorState().read(() => {
    const out: [string, boolean, string][] = [];
    const visit = (n: LexicalNode) => {
      if ($isLinkNode(n)) {
        const el = editor.getElementByKey(n.getKey())!;
        out.push([n.getURL(), el.classList.contains('dita-validation-broken-xref'), el.title]);
      }
      if ($isElementNode(n)) n.getChildren().forEach(visit);
    };
    $getRoot().getChildren().forEach(visit);
    return out;
  });

  it('underlines a missing fragment and a missing file; leaves a present target alone; same-document check unchanged', async () => {
    serveHeretto(tenant());
    const editor = await mount(DOC(
      '<p id="local">See <xref href="other.dita#other-topic/present">a</xref>, ' +
      '<xref href="other.dita#other-topic/absent">b</xref>, ' +
      '<xref href="missing.dita">c</xref>, ' +
      '<xref href="#local">d</xref>, and <xref href="#nowhere">e</xref>.</p>',
    ), 'a');
    expect(links(editor)).toEqual([
      ['other.dita#other-topic/present', false, 'Links open in published output — not in the editor'],
      ['other.dita#other-topic/absent', true, "Target 'other-topic/absent' not found in other.dita"],
      ['missing.dita', true, "File 'missing.dita' not found in Heretto"],
      ['#local', false, 'Links open in published output — not in the editor'],
      ['#nowhere', true, "Target 'nowhere' not found"],
    ]);
  });

  it('a network error marks nothing', async () => {
    serveHeretto(tenant(), { '/heretto-api/all-files/a': 'network' });
    const editor = await mount(DOC('<p>See <xref href="other.dita#other-topic/absent">b</xref>.</p>'), 'a');
    expect(links(editor)[0][1]).toBe(false);
  });

  it('an external-scope link is not fetched', async () => {
    serveHeretto(tenant());
    await mount(DOC('<p>See <xref href="other.dita#x" scope="external" format="html">b</xref>.</p>'), 'a');
    expect(herettoRequests).toEqual([]);
  });

  it('a Heretto tab that knows only its file UUID (API load, Replace) finds its folder from the file', async () => {
    serveHeretto({ ...tenant(), files: { ...tenant().files, here: { name: 'here.dita', folder: 'a', content: '' } } });
    render(
      <LexicalComposer initialConfig={{ namespace: 'i6b', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
        <RichTextPlugin contentEditable={<ContentEditable />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
        <Capture />
        <SyncManager xmlContent={DOC('<p>See <xref href="other.dita#other-topic/absent">b</xref>.</p>')} onLexicalChange={vi.fn()} lastUpdatedBy="code">
          <InlineValidationPlugin xmlContent="" validationTrigger={0} herettoFileUuid="here" />
        </SyncManager>
      </LexicalComposer>,
    );
    await act(async () => { await new Promise(r => setTimeout(r, 900)); });
    expect(links(editorRef!)[0][1]).toBe(true);
    expect(herettoRequests).toContain('/heretto-api/all-files/here');
  });

  it('a local-file tab (no Heretto folder) checks nothing across files', async () => {
    serveHeretto(tenant());
    const editor = await mount(DOC('<p>See <xref href="missing.dita">c</xref>.</p>'), null);
    expect(herettoRequests).toEqual([]);
    expect(links(editor)[0][1]).toBe(false);
  });
});
