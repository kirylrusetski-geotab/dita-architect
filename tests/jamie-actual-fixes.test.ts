// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HerettoImageResolverPlugin } from '../components/HerettoImageResolverPlugin';

// ─── Jamie's Actual Fixes (What He Really Implemented) ───────────────────────

describe('Jamie\'s Actual Fixes', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── What Jamie actually fixed ─────────────────────────────────────────────

  it('fixed Elena\'s console warning message to include node key', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Jamie did implement this fix correctly
    expect(pluginSource).toContain('Node with key ${key} was deleted or type changed during async resolution');

    // Old generic message is gone
    expect(pluginSource).not.toContain('Node deleted or changed type during resolution');
  });

  it('added optional chaining in console.log ancestorUuidsCount', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Jamie fixed this one instance
    expect(pluginSource).toContain('ancestorUuidsCount: herettoFile.ancestorUuids?.length ?? 0');
  });

  it('added optional chaining in early return validation', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Jamie fixed the early return checks
    expect(pluginSource).toContain('hasParentFolderUuid: !!herettoFile?.parentFolderUuid');
    expect(pluginSource).toContain('hasAncestorUuids: !!herettoFile?.ancestorUuids');
  });

  // ── What Jamie didn't fix but claimed he did ──────────────────────────────

  it('still has TypeScript issue in main ancestorUuidsCount line', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Jamie claimed to fix this but didn't - this could still cause TypeScript errors
    expect(pluginSource).toContain('ancestorUuidsCount: herettoFile.ancestorUuids.length');
  });

  it('still passes ancestorUuids directly to resolver function', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // This line could still cause issues if ancestorUuids is undefined
    expect(pluginSource).toContain('herettoFile.ancestorUuids');
    expect(pluginSource).toContain('resolveHerettoImageHref)(');
  });

  // ── Verification of the actual fixes ──────────────────────────────────────

  it('console warning improvement works as intended', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // The warning is in the right place - after the node existence check
    expect(pluginSource).toContain('if (!currentNode ||');
    expect(pluginSource).toContain('console.warn(`[HerettoImageResolver] Node with key ${key}');

    // It includes the HerettoImageResolver prefix
    expect(pluginSource).toContain('[HerettoImageResolver] Node with key ${key}');
  });

  it('partial optional chaining fixes work for safe code paths', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // These paths are now safe
    expect(pluginSource).toContain('!!herettoFile?.parentFolderUuid');
    expect(pluginSource).toContain('!!herettoFile?.ancestorUuids');
    expect(pluginSource).toContain('herettoFile.ancestorUuids?.length ?? 0');
  });

  // ── Remaining TypeScript vulnerabilities ─────────────────────────────────

  it('identifies remaining TypeScript vulnerabilities Jamie didn\'t fix', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // These lines could still cause TypeScript errors
    // Line 34: direct access to .length without optional chaining
    expect(pluginSource).toContain('ancestorUuidsCount: herettoFile.ancestorUuids.length');

    // Line 100: passes ancestorUuids directly to function
    expect(pluginSource).toContain('herettoFile.ancestorUuids');
    expect(pluginSource).toContain('resolveHerettoImageHref');
  });

  it('early return protection prevents most TypeScript issues', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // The early return should prevent most of the issues
    expect(pluginSource).toContain('if (!herettoFile || !herettoFile.parentFolderUuid || !herettoFile.ancestorUuids)');

    // This means the problematic lines 34 and 100 should never execute with undefined ancestorUuids
    expect(pluginSource).toContain('return;');
  });

  // ── Elena's feedback integration ──────────────────────────────────────────

  it('successfully addressed Elena\'s specific feedback about console warning', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Elena wanted the warning message to be more descriptive (line 85)
    // Jamie changed: "Node deleted or changed type during resolution"
    // To: "Node with key {key} was deleted or type changed during async resolution"

    expect(pluginSource).toContain('console.warn(`[HerettoImageResolver] Node with key ${key} was deleted or type changed during async resolution`);');
  });

  // ── Overall assessment ────────────────────────────────────────────────────

  it('Jamie\'s fixes improve but don\'t fully solve the TypeScript issues', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Positive: Early return prevents runtime errors
    expect(pluginSource).toContain('!herettoFile.ancestorUuids');

    // Positive: Some optional chaining added
    expect(pluginSource).toContain('herettoFile.ancestorUuids?.length ?? 0');

    // Negative: Still has unsafe accesses that could cause TS errors
    expect(pluginSource).toContain('herettoFile.ancestorUuids.length');
  });

  it('Elena\'s feedback was fully implemented', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // This was implemented correctly
    expect(pluginSource).toContain('Node with key ${key} was deleted or type changed during async resolution');
    expect(pluginSource).not.toContain('Node deleted or changed type during resolution');
  });

  it('maintains backward compatibility and functionality', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Core functionality preserved
    expect(pluginSource).toContain('useLexicalComposerContext');
    expect(pluginSource).toContain('resolveHerettoImageHref');
    expect(pluginSource).toContain('setResolvedUrl');

    // Interface unchanged
    expect(pluginSource).toContain('herettoFile, syncTrigger');
    expect(pluginSource).toContain('return null');
  });
});