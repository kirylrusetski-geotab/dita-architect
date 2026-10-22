// @vitest-environment jsdom
/**
 * Tests for P2-6 MVP: xref href validation in both Monaco and Lexical editors.
 * The two `describe` blocks below are source-code inspection tests from the
 * feature's original build. BUG-38's fix (2026-10-22) is pinned behaviorally
 * instead, in the two new blocks that follow them.
 *
 * Environment: vitest + jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import React from 'react';
import { render, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { $getRoot, $isElementNode, type LexicalEditor, type LexicalNode } from 'lexical';
import { $isLinkNode } from '@lexical/link';
import { EDITOR_NODES } from '../constants/editor-nodes';
import { SyncManager } from '../components/SyncManager';
import { XrefValidationPlugin } from '../components/XrefValidationPlugin';
import { isBrokenXrefTag } from '../lib/xref-validation';

describe('P2-6 xref validation – XrefValidationPlugin', () => {
  let pluginContent: string;

  beforeEach(() => {
    const pluginPath = path.join(process.cwd(), 'components/XrefValidationPlugin.tsx');
    pluginContent = readFileSync(pluginPath, 'utf-8');
  });

  it('uses registerMutationListener on LinkNode', () => {
    expect(pluginContent).toContain('registerMutationListener');
    expect(pluginContent).toContain('LinkNode');
  });

  it('imports LinkNode and $isLinkNode from @lexical/link', () => {
    expect(pluginContent).toContain("import { LinkNode, $isLinkNode } from '@lexical/link'");
  });

  it('checks node URL via getURL()', () => {
    expect(pluginContent).toContain('getURL()');
  });

  it('toggles the dita-xref-broken CSS class', () => {
    expect(pluginContent).toContain('dita-xref-broken');
    expect(pluginContent).toContain('classList.add');
    expect(pluginContent).toContain('classList.remove');
  });

  it('skips destroyed mutations', () => {
    expect(pluginContent).toContain("'destroyed'");
  });

  it('returns null (headless plugin pattern)', () => {
    expect(pluginContent).toContain('return null');
  });
});

describe('P2-6 xref validation – Monaco validateDita()', () => {
  let monacoContent: string;

  beforeEach(() => {
    const monacoPath = path.join(process.cwd(), 'components/MonacoDitaEditor.tsx');
    monacoContent = readFileSync(monacoPath, 'utf-8');
  });

  it('scans for <xref> tags with a regex', () => {
    expect(monacoContent).toContain('<xref');
    expect(monacoContent).toMatch(/xrefRe|xref.*regex|<xref\\b/i);
  });

  it('checks for empty or missing href attribute', () => {
    expect(monacoContent).toContain('href');
    expect(monacoContent).toContain('empty or missing href');
  });

  it('creates Warning-severity markers for broken xrefs', () => {
    expect(monacoContent).toContain('MarkerSeverity.Warning');
  });
});

describe('P2-6 xref validation – CSS', () => {
  let cssContent: string;

  beforeEach(() => {
    const cssPath = path.join(process.cwd(), 'index.css');
    cssContent = readFileSync(cssPath, 'utf-8');
  });

  it('defines the .dita-xref-broken class', () => {
    expect(cssContent).toContain('.dita-xref-broken');
  });

  it('uses a wavy underline decoration', () => {
    expect(cssContent).toContain('underline wavy');
  });

  it('uses red error color for the underline', () => {
    expect(cssContent).toContain('#ef4444');
  });
});

describe('P2-6 xref validation – plugin mounting', () => {
  let mainContent: string;

  beforeEach(() => {
    const mainPath = path.join(process.cwd(), 'dita-architect.tsx');
    mainContent = readFileSync(mainPath, 'utf-8');
  });

  it('imports XrefValidationPlugin', () => {
    expect(mainContent).toContain("import { XrefValidationPlugin } from './components/XrefValidationPlugin'");
  });

  it('mounts <XrefValidationPlugin /> in the editor', () => {
    expect(mainContent).toContain('<XrefValidationPlugin />');
  });

  it('mounts it inside <SyncManager> so it can read originMap (BUG-38)', () => {
    const syncManagerOpen = mainContent.indexOf('<SyncManager');
    const xrefPluginMount = mainContent.indexOf('<XrefValidationPlugin />');
    const syncManagerClose = mainContent.indexOf('</SyncManager>');
    expect(syncManagerOpen).toBeGreaterThan(-1);
    expect(xrefPluginMount).toBeGreaterThan(syncManagerOpen);
    expect(xrefPluginMount).toBeLessThan(syncManagerClose);
  });
});

describe('BUG-38 — isBrokenXrefTag (lib/xref-validation.ts)', () => {
  it('flags an xref with no href', () => {
    expect(isBrokenXrefTag('<xref>')).toBe(true);
  });
  it('flags an xref with an empty href', () => {
    expect(isBrokenXrefTag('<xref href="">')).toBe(true);
  });
  it('flags an xref with a whitespace-only href', () => {
    expect(isBrokenXrefTag('<xref href="   ">')).toBe(true);
  });
  it('does not flag an xref with a real href', () => {
    expect(isBrokenXrefTag('<xref href="topic.dita">')).toBe(false);
  });
  it('does not flag a keyref xref with no href', () => {
    expect(isBrokenXrefTag('<xref keyref="k">')).toBe(false);
  });
  it('does not flag a conkeyref xref with no href', () => {
    expect(isBrokenXrefTag('<xref conkeyref="vars/k">')).toBe(false);
  });
  it('does not flag a conref xref with no href', () => {
    expect(isBrokenXrefTag('<xref conref="other.dita#id">')).toBe(false);
  });
  it('does not flag a self-closed keyref xref', () => {
    expect(isBrokenXrefTag('<xref keyref="k"/>')).toBe(false);
  });
  it('a keyref xref that ALSO carries href="" is still not flagged (keyref wins)', () => {
    expect(isBrokenXrefTag('<xref keyref="k" href="">')).toBe(false);
  });
});

describe('BUG-38 — XrefValidationPlugin: a keyref xref is not flagged broken (real tree)', () => {
  let editorRef: LexicalEditor | null = null;
  const Capture = () => { const [e] = useLexicalComposerContext(); editorRef = e; return null; };

  async function mount(xml: string) {
    render(
      <LexicalComposer initialConfig={{ namespace: 'bug38', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
        <RichTextPlugin contentEditable={<ContentEditable />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
        <LinkPlugin />
        <Capture />
        <SyncManager xmlContent={xml} onLexicalChange={() => {}} lastUpdatedBy="code">
          <XrefValidationPlugin />
        </SyncManager>
      </LexicalComposer>
    );
    await act(async () => { await new Promise(r => setTimeout(r, 300)); });
    return editorRef!;
  }

  function findLink(node: LexicalNode, text: string): LexicalNode | null {
    if ($isLinkNode(node) && node.getTextContent() === text) return node;
    if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findLink(c, text); if (r) return r; }
    return null;
  }

  const DOC = (body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;

  it('a keyref xref has no broken-link class; a genuinely href-less one does', async () => {
    const editor = await mount(DOC('<p><xref keyref="k">Go</xref> and <xref>Broken</xref>.</p>'));
    editor.getEditorState().read(() => {
      const keyrefLink = findLink($getRoot(), 'Go')!;
      const brokenLink = findLink($getRoot(), 'Broken')!;
      expect(editor.getElementByKey(keyrefLink.getKey())?.classList.contains('dita-xref-broken')).toBe(false);
      expect(editor.getElementByKey(brokenLink.getKey())?.classList.contains('dita-xref-broken')).toBe(true);
    });
  });

  it('a conkeyref xref is not flagged either', async () => {
    const editor = await mount(DOC('<p>See <xref conkeyref="vars/k">this</xref>.</p>'));
    editor.getEditorState().read(() => {
      const link = findLink($getRoot(), 'this')!;
      expect(editor.getElementByKey(link.getKey())?.classList.contains('dita-xref-broken')).toBe(false);
    });
  });

  it('an xref with a real href is not flagged', async () => {
    const editor = await mount(DOC('<p>See <xref href="topic.dita">this</xref>.</p>'));
    editor.getEditorState().read(() => {
      const link = findLink($getRoot(), 'this')!;
      expect(editor.getElementByKey(link.getKey())?.classList.contains('dita-xref-broken')).toBe(false);
    });
  });
});
