// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { DitaImageNode, $createDitaImageNode, $isDitaImageNode } from '../components/DitaImageNode';
import { createEditor, $getRoot } from 'lexical';

// ─── test utilities ──────────────────────────────────────────────────────────

function createTestEditor() {
  const editor = createEditor({
    nodes: [DitaImageNode],
    onError: console.error,
  });
  return editor;
}

function withEditor<T>(callback: () => T): T {
  const editor = createTestEditor();
  let result: T;
  editor.update(() => {
    result = callback();
  });
  return result!;
}

// ─── DitaImageNode resolved URL state management ─────────────────────────────

describe('DitaImageNode resolved URL functionality', () => {
  // ── constructor and initial state ────────────────────────────────────────

  it('initializes with null resolved URL by default', () => {
    withEditor(() => {
      const node = new DitaImageNode('image.png', 'Alt text', 'Title', false);

      expect(node.getResolvedUrl()).toBe(null);
      expect(node.__resolvedUrl).toBe(null);
    });
  });

  it('creates node with all required properties', () => {
    withEditor(() => {
      const node = new DitaImageNode('../assets/logo.png', 'Company logo', 'Our logo', true);

      expect(node.__href).toBe('../assets/logo.png');
      expect(node.__alt).toBe('Company logo');
      expect(node.__title).toBe('Our logo');
      expect(node.__isFig).toBe(true);
      expect(node.getResolvedUrl()).toBe(null);
    });
  });

  // ── setResolvedUrl and getResolvedUrl ────────────────────────────────────

  it('sets and gets resolved URL correctly', () => {
    withEditor(() => {
      const node = new DitaImageNode('image.png', 'Alt', 'Title', false);
      const resolvedUrl = '/heretto-api/all-files/uuid-123/content';

      node.setResolvedUrl(resolvedUrl);

      expect(node.getResolvedUrl()).toBe(resolvedUrl);
      expect(node.__resolvedUrl).toBe(resolvedUrl);
    });
  });

  it('handles empty string as resolved URL for failed resolution', () => {
    withEditor(() => {
      const node = new DitaImageNode('missing.png', 'Alt', 'Title', false);

      node.setResolvedUrl(''); // Empty string indicates resolution attempt completed but failed

      expect(node.getResolvedUrl()).toBe('');
      expect(node.__resolvedUrl).toBe('');
    });
  });

  it('allows null to be set as resolved URL', () => {
    withEditor(() => {
      const node = new DitaImageNode('image.png', 'Alt', 'Title', false);
      node.setResolvedUrl('/some-url'); // Set initially

      node.setResolvedUrl(null); // Clear it

      expect(node.getResolvedUrl()).toBe(null);
    });
  });

  it('setResolvedUrl creates a writable copy of the node', () => {
    withEditor(() => {
      const node = new DitaImageNode('image.png', 'Alt', 'Title', false);
      const originalKey = node.__key;

      node.setResolvedUrl('/heretto-api/all-files/uuid-456/content');

      // Node should still be the same instance but internally writable
      expect(node.__key).toBe(originalKey);
      expect(node.getResolvedUrl()).toBe('/heretto-api/all-files/uuid-456/content');
    });
  });

  // ── clone functionality ──────────────────────────────────────────────────

  it('clones node with resolved URL preserved', () => {
    withEditor(() => {
      const originalNode = new DitaImageNode('test.png', 'Test image', 'Test', false);
      originalNode.setResolvedUrl('/heretto-api/all-files/test-uuid/content');

      const clonedNode = DitaImageNode.clone(originalNode);

      expect(clonedNode.__href).toBe(originalNode.__href);
      expect(clonedNode.__alt).toBe(originalNode.__alt);
      expect(clonedNode.__title).toBe(originalNode.__title);
      expect(clonedNode.__isFig).toBe(originalNode.__isFig);
      expect(clonedNode.getResolvedUrl()).toBe(originalNode.getResolvedUrl());
      expect(clonedNode.__key).toBe(originalNode.__key);
    });
  });

  it('clones node with null resolved URL', () => {
    withEditor(() => {
      const originalNode = new DitaImageNode('unresolved.png', 'Alt', 'Title', true);

      const clonedNode = DitaImageNode.clone(originalNode);

      expect(clonedNode.getResolvedUrl()).toBe(null);
      expect(clonedNode.__resolvedUrl).toBe(null);
    });
  });

  it('clones node with empty string resolved URL', () => {
    withEditor(() => {
      const originalNode = new DitaImageNode('failed.png', 'Alt', 'Title', false);
      originalNode.setResolvedUrl(''); // Failed resolution

      const clonedNode = DitaImageNode.clone(originalNode);

      expect(clonedNode.getResolvedUrl()).toBe('');
    });
  });

  // ── serialization behavior (resolved URL excluded) ───────────────────────

  it('exportJSON excludes resolved URL from serialized data', () => {
    withEditor(() => {
      const node = new DitaImageNode('image.png', 'Alt text', 'Title text', true);
      node.setResolvedUrl('/heretto-api/all-files/uuid-789/content');

      const serialized = node.exportJSON();

      expect(serialized).toEqual({
        type: 'ditaimage',
        version: 1,
        href: 'image.png',
        alt: 'Alt text',
        title: 'Title text',
        isFig: true
      });
      expect(serialized).not.toHaveProperty('resolvedUrl');
      expect(serialized).not.toHaveProperty('__resolvedUrl');
    });
  });

  it('importJSON does not restore resolved URL state', () => {
    withEditor(() => {
      const serializedData = {
        type: 'ditaimage',
        version: 1,
        href: 'imported.png',
        alt: 'Imported alt',
        title: 'Imported title',
        isFig: false
      } as any;

      const importedNode = DitaImageNode.importJSON(serializedData);

      expect(importedNode.__href).toBe('imported.png');
      expect(importedNode.__alt).toBe('Imported alt');
      expect(importedNode.__title).toBe('Imported title');
      expect(importedNode.__isFig).toBe(false);
      expect(importedNode.getResolvedUrl()).toBe(null); // Always null after import
    });
  });

  // ── factory function ─────────────────────────────────────────────────────

  it('creates node via factory function with null resolved URL', () => {
    withEditor(() => {
      const node = $createDitaImageNode('factory.png', 'Factory alt', 'Factory title', true);

      expect($isDitaImageNode(node)).toBe(true);
      expect(node.__href).toBe('factory.png');
      expect(node.__alt).toBe('Factory alt');
      expect(node.__title).toBe('Factory title');
      expect(node.__isFig).toBe(true);
      expect(node.getResolvedUrl()).toBe(null);
    });
  });

  // ── type guard ───────────────────────────────────────────────────────────

  it('type guard correctly identifies DitaImageNode instances', () => {
    withEditor(() => {
      const imageNode = new DitaImageNode('test.png', 'Test', 'Test', false);
      const notImageNode = { __href: 'fake.png' }; // Mock object

      expect($isDitaImageNode(imageNode)).toBe(true);
      expect($isDitaImageNode(notImageNode)).toBe(false);
      expect($isDitaImageNode(null)).toBe(false);
      expect($isDitaImageNode(undefined)).toBe(false);
    });
  });

  // ── Lexical node properties ──────────────────────────────────────────────

  it('has correct static type identifier', () => {
    expect(DitaImageNode.getType()).toBe('ditaimage');
  });

  it('is not inline by default', () => {
    withEditor(() => {
      const node = new DitaImageNode('test.png', 'Test', 'Test', false);
      expect(node.isInline()).toBe(false);
    });
  });

  it('is keyboard selectable', () => {
    withEditor(() => {
      const node = new DitaImageNode('test.png', 'Test', 'Test', false);
      expect(node.isKeyboardSelectable()).toBe(true);
    });
  });

  it('updateDOM always returns false', () => {
    withEditor(() => {
      const node = new DitaImageNode('test.png', 'Test', 'Test', false);
      expect(node.updateDOM()).toBe(false);
    });
  });

  // ── resolved URL state transitions ───────────────────────────────────────

  it('supports state transition: null -> resolved URL -> empty (failed)', () => {
    withEditor(() => {
      const node = new DitaImageNode('transition.png', 'Alt', 'Title', false);

      // Initial state: null (not yet resolved)
      expect(node.getResolvedUrl()).toBe(null);

      // Resolved successfully
      node.setResolvedUrl('/heretto-api/all-files/success-uuid/content');
      expect(node.getResolvedUrl()).toBe('/heretto-api/all-files/success-uuid/content');

      // Later marked as failed
      node.setResolvedUrl('');
      expect(node.getResolvedUrl()).toBe('');
    });
  });

  it('supports state transition: null -> empty (failed) directly', () => {
    withEditor(() => {
      const node = new DitaImageNode('failed.png', 'Alt', 'Title', false);

      // Initial state: null (not yet resolved)
      expect(node.getResolvedUrl()).toBe(null);

      // Direct failure (couldn't resolve)
      node.setResolvedUrl('');
      expect(node.getResolvedUrl()).toBe('');
    });
  });

  // ── edge cases ───────────────────────────────────────────────────────────

  it('handles very long resolved URLs without issues', () => {
    withEditor(() => {
      const node = new DitaImageNode('image.png', 'Alt', 'Title', false);
      const veryLongUrl = '/heretto-api/all-files/' + 'x'.repeat(1000) + '/content';

      node.setResolvedUrl(veryLongUrl);

      expect(node.getResolvedUrl()).toBe(veryLongUrl);
    });
  });

  it('handles special characters in resolved URLs', () => {
    withEditor(() => {
      const node = new DitaImageNode('special.png', 'Alt', 'Title', false);
      const specialUrl = '/heretto-api/all-files/uuid-with-special%20chars%26more/content';

      node.setResolvedUrl(specialUrl);

      expect(node.getResolvedUrl()).toBe(specialUrl);
    });
  });

  it('maintains resolved URL state after multiple operations', () => {
    withEditor(() => {
      const node = new DitaImageNode('persistent.png', 'Alt', 'Title', false);
      const resolvedUrl = '/heretto-api/all-files/persistent-uuid/content';

      node.setResolvedUrl(resolvedUrl);

      // Simulate various operations that should not affect resolved URL
      const cloned = DitaImageNode.clone(node);
      const serialized = node.exportJSON();
      const domElement = node.createDOM({} as any);

      expect(node.getResolvedUrl()).toBe(resolvedUrl);
      expect(cloned.getResolvedUrl()).toBe(resolvedUrl);
      expect(serialized).not.toHaveProperty('resolvedUrl');
      expect(domElement).toBeDefined();
    });
  });
});