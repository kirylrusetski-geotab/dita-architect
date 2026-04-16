// @vitest-environment jsdom
/**
 * Tests for P2-6 MVP: xref href validation in both Monaco and Lexical editors.
 * Source-code inspection tests following the established project pattern.
 *
 * Environment: vitest + jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

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
});
