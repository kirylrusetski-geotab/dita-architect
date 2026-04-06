// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HerettoImageResolverPlugin } from '../components/HerettoImageResolverPlugin';

// ─── Elena's Feedback Regression Tests ───────────────────────────────────────

describe('Elena\'s Feedback Regression Tests', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Issue 1: Console warning message improvement ─────────────────────────

  it('displays descriptive console warning with specific node key (Elena issue #1)', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Elena's feedback: make the console warning more descriptive
    // Should include the specific node key in the warning message
    expect(pluginSource).toContain('Node with key ${key} was deleted or type changed during async resolution');

    // Should be in a console.warn call
    expect(pluginSource).toMatch(/console\.warn.*Node with key \$\{key\}/);
  });

  it('warning message includes the specific node key, not generic text', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Should interpolate the actual node key
    expect(pluginSource).toContain('${key}');

    // The message should be helpful for debugging
    expect(pluginSource).toContain('was deleted or type changed during async resolution');
  });

  it('old generic warning message is no longer used', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Should NOT contain the old generic message Elena flagged
    expect(pluginSource).not.toContain('Node deleted or changed type during resolution');

    // Should contain the new descriptive message with key interpolation
    expect(pluginSource).toContain('Node with key ${key} was deleted or type changed during async resolution');
  });

  it('warning message format is consistent and helpful for debugging', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Should follow the pattern Elena requested
    const expectedPattern = /console\.warn\(\s*`\[HerettoImageResolver\] Node with key \$\{key\} was deleted or type changed during async resolution`\s*\)/;
    expect(pluginSource).toMatch(expectedPattern);
  });

  // ── Issue 2: Message provides debugging value (Elena's intent) ────────────

  it('improved message helps developers identify which specific node failed', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // The warning should be in the context where we have the node key
    expect(pluginSource).toContain('currentNode = editor.getEditorState().read');
    expect(pluginSource).toContain('console.warn(`[HerettoImageResolver] Node with key ${key}');

    // Should be called when the node is missing or wrong type (in compiled form)
    expect(pluginSource).toContain('if (!currentNode ||');
  });

  it('warning context provides actionable debugging information', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Should include prefix for easy log filtering
    expect(pluginSource).toContain('[HerettoImageResolver]');

    // Should describe what happened
    expect(pluginSource).toContain('was deleted or type changed during async resolution');

    // Should identify the specific node
    expect(pluginSource).toContain('Node with key ${key}');
  });

  // ── Regression prevention ─────────────────────────────────────────────────

  it('ensures Elena\'s feedback is fully addressed in the implementation', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Elena's specific feedback from line 85: make the message more descriptive
    // Old: "Node deleted or changed type during resolution"
    // New: "Node with key {key} was deleted or type changed during async resolution"

    // Verify the improvement exists
    expect(pluginSource).toContain('Node with key ${key} was deleted or type changed during async resolution');

    // Verify the old generic message is gone
    expect(pluginSource).not.toContain('Node deleted or changed type during resolution');
  });

  it('maintains the same logging context and error handling behavior', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Should still have try-catch blocks for error handling
    expect(pluginSource).toContain('try {');
    expect(pluginSource).toContain('} catch (error) {');

    // Should still have the other console.warn for resolution failures
    expect(pluginSource).toContain('[HerettoImageResolver] Failed to resolve image href:');

    // Should still check node existence (in compiled form)
    expect(pluginSource).toContain('$getNodeByKey');
    expect(pluginSource).toContain('$isDitaImageNode');
  });

  it('improved warning is in the correct async context', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Should be in the forEach async callback where nodes might be deleted
    expect(pluginSource).toContain('nodeQueue.forEach(async (key) => {');
    expect(pluginSource).toMatch(/try \{[\s\S]*?currentNode = editor\.getEditorState\(\)\.read\([\s\S]*?console\.warn\(`\[HerettoImageResolver\] Node with key \$\{key\}/);
  });

  // ── Code quality verification ─────────────────────────────────────────────

  it('Jamie correctly implemented Elena\'s specific feedback from line 85', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Elena's comment was specifically about HerettoImageResolverPlugin.tsx:85
    // The console warning should be more descriptive with the node key
    expect(pluginSource).toContain('console.warn(`[HerettoImageResolver] Node with key ${key} was deleted or type changed during async resolution`);');
  });

  it('maintains proper async error handling while improving messages', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Should still handle the case where nodes are deleted during async operations
    expect(pluginSource).toContain('if (!currentNode ||');
    expect(pluginSource).toContain('$isDitaImageNode');
    expect(pluginSource).toContain('return;');

    // The improved warning should be right before the return
    expect(pluginSource).toMatch(/console\.warn.*Node with key \$\{key\}[\s\S]*?return;/);
  });

  it('warning message follows consistent logging patterns in the codebase', () => {
    const pluginSource = HerettoImageResolverPlugin.toString();

    // Should use the same prefix as other log messages in the plugin
    expect(pluginSource).toContain('[HerettoImageResolver]');

    // Should use template literals for string interpolation
    expect(pluginSource).toContain('`[HerettoImageResolver] Node with key ${key}');

    // Should be descriptive about the async timing issue
    expect(pluginSource).toContain('during async resolution');
  });
});