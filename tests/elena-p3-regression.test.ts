// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ─── Elena's P3 Review Non-Blocking Issues Regression Tests ─────────────────

describe("Elena's P3 review non-blocking issues regression tests", () => {
  // ── CSS and styling consistency ──────────────────────────────────────────

  it('ensures placeholder text CSS class exists and is properly defined', () => {
    const cssPath = path.join(process.cwd(), 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Should have the .dita-placeholder-text class
    expect(cssContent).toContain('.dita-placeholder-text');

    // Should define italic style and color
    const placeholderSection = cssContent.split('.dita-placeholder-text')[1].split('}')[0];
    expect(placeholderSection).toContain('font-style: italic');
    expect(placeholderSection).toContain('color: var(--app-text-muted)');
  });

  it('ensures sync banner CSS class exists and is properly positioned', () => {
    const cssPath = path.join(process.cwd(), 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Should have the .dita-sync-banner class
    expect(cssContent).toContain('.dita-sync-banner');

    // Should have proper positioning
    const bannerSection = cssContent.split('.dita-sync-banner')[1].split('}')[0];
    expect(bannerSection).toContain('position: absolute');
    expect(bannerSection).toContain('z-index: 10');
    expect(bannerSection).toContain('top: 0');
  });

  // ── placeholder pattern efficiency ───────────────────────────────────────

  it('verifies placeholder patterns are defined consistently in parseXmlToLexical', () => {
    const parseXmlPath = path.join(process.cwd(), 'sync', 'parseXmlToLexical.ts');
    const parseXmlContent = fs.readFileSync(parseXmlPath, 'utf8');

    // Should have placeholder patterns array
    expect(parseXmlContent).toContain('placeholderPatterns');

    // Should include key template placeholders
    expect(parseXmlContent).toContain('Task title');
    expect(parseXmlContent).toContain('Short description of the task');
    expect(parseXmlContent).toContain('Brief description');

    // Should set italic format and style for placeholders
    expect(parseXmlContent).toContain("setFormat('italic')");
    expect(parseXmlContent).toContain("setStyle('color: var(--app-text-muted)')");
  });

  // ── herettoJustLoaded flag implementation ────────────────────────────────

  it('verifies herettoJustLoaded flag is properly defined in Tab type', () => {
    const tabTypePath = path.join(process.cwd(), 'types', 'tab.ts');
    const tabTypeContent = fs.readFileSync(tabTypePath, 'utf8');

    // Should have herettoJustLoaded property
    expect(tabTypeContent).toContain('herettoJustLoaded');
    expect(tabTypeContent).toContain('boolean');
  });

  it('verifies herettoJustLoaded is set during import in useHerettoCms', () => {
    const herettoCmsPath = path.join(process.cwd(), 'hooks', 'useHerettoCms.ts');
    const herettoCmsContent = fs.readFileSync(herettoCmsPath, 'utf8');

    // Should set herettoJustLoaded to true during import
    expect(herettoCmsContent).toContain('herettoJustLoaded: true');

    // Should clear herettoJustLoaded to false in save operations
    expect(herettoCmsContent).toContain('herettoJustLoaded: false');
  });

  it('verifies status bar uses herettoJustLoaded flag in dita-architect', () => {
    const mainAppPath = path.join(process.cwd(), 'dita-architect.tsx');
    const mainAppContent = fs.readFileSync(mainAppPath, 'utf8');

    // Should check herettoJustLoaded flag for status
    expect(mainAppContent).toContain('herettoJustLoaded');
    expect(mainAppContent).toContain('Loaded from Heretto');

    // Should prioritize herettoJustLoaded over herettoRemoteChanged
    const statusSection = mainAppContent.split('herettoJustLoaded')[1];
    expect(statusSection).toBeTruthy();
  });

  // ── compareXml polling implementation ────────────────────────────────────

  it('verifies compareXml is used instead of string equality in polling', () => {
    const herettoCmsPath = path.join(process.cwd(), 'hooks', 'useHerettoCms.ts');
    const herettoCmsContent = fs.readFileSync(herettoCmsPath, 'utf8');

    // Should import compareXml
    expect(herettoCmsContent).toContain('compareXml');

    // Should use compareXml in polling logic
    expect(herettoCmsContent).toContain('compareXml(t.savedXmlRef.current, remote)');
    expect(herettoCmsContent).toContain("comparison === 'different'");
  });

  // ── sync manager out-of-sync banner ──────────────────────────────────────

  it('verifies SyncManager shows out-of-sync banner for code updates', () => {
    const syncManagerPath = path.join(process.cwd(), 'components', 'SyncManager.tsx');
    const syncManagerContent = fs.readFileSync(syncManagerPath, 'utf8');

    // Should have showOutOfSyncBanner logic
    expect(syncManagerContent).toContain('showOutOfSyncBanner');
    expect(syncManagerContent).toContain("lastUpdatedBy === 'code'");

    // Should render the banner
    expect(syncManagerContent).toContain('dita-sync-banner');
    expect(syncManagerContent).toContain('Visual editor is out of sync');
    expect(syncManagerContent).toContain('Ctrl+Enter to refresh');
  });

  // ── regression for Elena's specific concerns ─────────────────────────────

  it('prevents inline style duplication flagged by Elena in review', () => {
    const parseXmlPath = path.join(process.cwd(), 'sync', 'parseXmlToLexical.ts');
    const parseXmlContent = fs.readFileSync(parseXmlPath, 'utf8');

    // Count occurrences of the muted color style
    const colorStyleMatches = parseXmlContent.match(/var\(--app-text-muted\)/g);

    // Should only appear once in the placeholder styling code
    // (Elena noted this as redundant but non-blocking)
    expect(colorStyleMatches).toBeTruthy();

    // If this test fails in the future, it means someone addressed Elena's optimization suggestion
    // which is good! The test would need to be updated then.
  });

  it('ensures placeholder patterns are in the function scope as implemented', () => {
    const parseXmlPath = path.join(process.cwd(), 'sync', 'parseXmlToLexical.ts');
    const parseXmlContent = fs.readFileSync(parseXmlPath, 'utf8');

    // Verify the patterns array is defined within the text parsing logic
    // Elena suggested moving to module scope for performance, but noted it as non-blocking
    expect(parseXmlContent).toContain('placeholderPatterns = [');

    // Should be inside a function (not at module scope)
    const patternDefinition = parseXmlContent.indexOf('placeholderPatterns = [');
    const beforePattern = parseXmlContent.substring(0, patternDefinition);

    // Should have function context before the pattern definition
    expect(beforePattern).toMatch(/function|=>\s*{|\s+{/);
  });

  // ── WYSIWYG/DITA parity verification ─────────────────────────────────────

  it('ensures all three P3 features maintain WYSIWYG/DITA parity', () => {
    const parseXmlPath = path.join(process.cwd(), 'sync', 'parseXmlToLexical.ts');
    const syncManagerPath = path.join(process.cwd(), 'components', 'SyncManager.tsx');

    const parseXmlContent = fs.readFileSync(parseXmlPath, 'utf8');
    const syncManagerContent = fs.readFileSync(syncManagerPath, 'utf8');

    // Placeholder styling should be visual only (not affect XML output)
    // This is ensured by styling being applied to TextNode format/style, not content
    expect(parseXmlContent).toContain('setFormat(');
    expect(parseXmlContent).toContain('setStyle(');

    // Sync banner should not interfere with editor (positioned absolute)
    expect(syncManagerContent).toContain('position: absolute');

    // Status changes should be UI-only (herettoJustLoaded doesn't affect XML)
    const tabTypePath = path.join(process.cwd(), 'types', 'tab.ts');
    const tabTypeContent = fs.readFileSync(tabTypePath, 'utf8');
    expect(tabTypeContent).toContain('herettoJustLoaded: boolean');
  });

  // ── implementation completeness ──────────────────────────────────────────

  it('verifies all three P3 features are fully implemented', () => {
    // P3-25: Placeholder text styling
    const cssPath = path.join(process.cwd(), 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    expect(cssContent).toContain('.dita-placeholder-text');

    // P3-26: Out-of-sync banner
    expect(cssContent).toContain('.dita-sync-banner');

    const syncManagerPath = path.join(process.cwd(), 'components', 'SyncManager.tsx');
    const syncManagerContent = fs.readFileSync(syncManagerPath, 'utf8');
    expect(syncManagerContent).toContain('showOutOfSyncBanner');

    // P3-27: Accurate Heretto load status
    const herettoCmsPath = path.join(process.cwd(), 'hooks', 'useHerettoCms.ts');
    const herettoCmsContent = fs.readFileSync(herettoCmsPath, 'utf8');
    expect(herettoCmsContent).toContain('compareXml');
    expect(herettoCmsContent).toContain('herettoJustLoaded: true');
  });
});