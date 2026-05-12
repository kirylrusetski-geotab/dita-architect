// @vitest-environment jsdom
/**
 * Tests for DITA terminology fix - validating Jamie's P2-10 implementation.
 * Tests the correction from "Post-Requisite" to "Postrequisites" in index.css
 * to match DITA standard terminology as specified in Anna's plan.
 *
 * Environment: vitest + jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

describe('DITA terminology fix for postrequisites', () => {
  let cssContent: string;

  beforeEach(() => {
    // Read the index.css file to test the terminology fix
    const cssPath = path.join(process.cwd(), 'index.css');
    cssContent = readFileSync(cssPath, 'utf-8');
  });

  describe('postrequisites terminology correction', () => {
    it('corrects the label from "Post-Requisite" to "Postrequisites" on line 555', () => {
      const lines = cssContent.split('\n');
      const line555 = lines[554]; // 0-indexed, so line 555 is index 554

      expect(line555).toContain('content: \'Postrequisites\';');
    });

    it('uses DITA standard terminology - "Postrequisites" is one word without hyphen', () => {
      expect(cssContent).toContain('content: \'Postrequisites\';');

      // Should not contain the old incorrect terminology
      expect(cssContent).not.toContain('content: \'Post-Requisite\';');
    });

    it('applies the correct terminology to the .dita-editor-postreq selector', () => {
      // Should have the correct selector and content
      const postreqMatch = cssContent.match(/\.dita-editor-postreq::after\s*\{\s*content: 'Postrequisites';\s*\}/);
      expect(postreqMatch).toBeTruthy();
    });

    it('maintains consistency with other DITA element terminology in the same section', () => {
      // Should be in the context of other DITA editor elements
      expect(cssContent).toContain('.dita-editor-prereq');
      expect(cssContent).toContain('.dita-editor-result');
      expect(cssContent).toContain('.dita-editor-postreq');

      // All should use consistent ::after pseudo-element pattern
      expect(cssContent).toContain('.dita-editor-postreq::after');
    });
  });

  describe('CSS structure and formatting preservation', () => {
    it('preserves the CSS selector structure around line 555', () => {
      const lines = cssContent.split('\n');

      // Line 554 should be the selector
      expect(lines[553]).toContain('.dita-editor-postreq::after');

      // Line 555 should be the content property
      expect(lines[554]).toContain('content: \'Postrequisites\';');

      // Line 556 should be the closing brace
      expect(lines[555]).toContain('}');
    });

    it('maintains proper CSS formatting and indentation', () => {
      const postreqSection = cssContent.match(/\.dita-editor-postreq::after\s*\{[\s\S]*?\}/);
      expect(postreqSection).toBeTruthy();

      // Should have proper formatting
      expect(cssContent).toContain('  content: \'Postrequisites\';');
    });

    it('does not affect other CSS rules in the same area', () => {
      // Preceding rule should still be intact
      expect(cssContent).toContain('.dita-editor-result::after');
      expect(cssContent).toContain('content: \'Result\';');

      // Following rule should still be intact
      expect(cssContent).toContain('.dita-editor-prereq:hover::after');
    });
  });

  describe('DITA standard compliance', () => {
    it('uses the plural form "Postrequisites" as specified in DITA standards', () => {
      expect(cssContent).toContain('Postrequisites');

      // DITA uses plural form, not singular (use word boundary to avoid matching "Prerequisite")
      expect(cssContent).not.toMatch(/\bPostrequisite\b/);
    });

    it('uses the one-word form without hyphenation', () => {
      expect(cssContent).toContain('Postrequisites');

      // Should not use hyphenated form
      expect(cssContent).not.toContain('Post-Requisite');
      expect(cssContent).not.toContain('Post-requisite');
    });

    it('matches the terminology used in DITA documentation and schemas', () => {
      // "Postrequisites" is the exact term used in DITA documentation
      expect(cssContent).toContain('content: \'Postrequisites\';');

      // Should maintain consistent capitalization
      expect(cssContent).toContain('Postrequisites');
    });
  });

  describe('WYSIWYG editor display consistency', () => {
    it('ensures postrequisites element displays with correct label in WYSIWYG mode', () => {
      // The CSS rule controls what users see in the WYSIWYG editor
      expect(cssContent).toContain('.dita-editor-postreq::after');
      expect(cssContent).toContain('content: \'Postrequisites\';');
    });

    it('maintains consistency with other task element labels', () => {
      // All task elements should use standard DITA terminology
      expect(cssContent).toContain('content: \'Result\';');
      expect(cssContent).toContain('content: \'Postrequisites\';');

      // Should be in the same section with other DITA editor elements
      const ditaEditorRulesMatch = cssContent.match(/\.dita-editor-\w+::/g);
      expect(ditaEditorRulesMatch).toBeTruthy();
      expect(ditaEditorRulesMatch!.length).toBeGreaterThan(1);
    });
  });

  describe('regression testing for terminology fixes', () => {
    it('completely removes the old incorrect terminology', () => {
      // Should have no trace of the old "Post-Requisite" anywhere
      expect(cssContent).not.toContain('Post-Requisite');

      // Case variations should also be removed
      expect(cssContent).not.toContain('post-requisite');
      expect(cssContent).not.toContain('POST-REQUISITE');
    });

    it('uses the exact spelling and capitalization required by DITA', () => {
      // Must be exact match for DITA compliance
      expect(cssContent).toContain('Postrequisites');

      // Should not have alternative spellings
      expect(cssContent).not.toContain('PostRequisites');
      expect(cssContent).not.toContain('postRequisites');
      expect(cssContent).not.toContain('POSTREQUISITES');
    });

    it('applies the fix only to the postreq element, not affecting other elements', () => {
      // Should have changed only the postreq element, not prerequisites (different element)
      expect(cssContent).toContain('content: \'Postrequisites\';'); // This should be present
      expect(cssContent).toContain('content: \'Prerequisite\';'); // Prerequisites should be separate and unchanged

      // Count occurrences to ensure only one change was made
      const postrequisitesCount = (cssContent.match(/Postrequisites/g) || []).length;
      expect(postrequisitesCount).toBe(1);
    });
  });

  describe('user experience and accessibility', () => {
    it('provides clear and accurate labeling for technical writers familiar with DITA', () => {
      // Technical writers expect standard DITA terminology
      expect(cssContent).toContain('content: \'Postrequisites\';');

      // This helps with WYSIWYG/DITA parity
      expect(cssContent).toContain('.dita-editor-postreq::after');
    });

    it('maintains visual consistency with other DITA element indicators', () => {
      // All DITA editor elements should follow the same pattern
      expect(cssContent).toContain('::after');

      // Should be part of a consistent set of visual indicators
      const afterPseudoElements = cssContent.match(/\.dita-editor-\w+::after/g);
      expect(afterPseudoElements).toBeTruthy();
      expect(afterPseudoElements!.length).toBeGreaterThan(1);
    });
  });
});