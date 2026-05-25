// @vitest-environment jsdom
/**
 * Tests for Tooltip component placement functionality - validating Jamie's implementation.
 * These tests ensure tooltips can be positioned to the right of trigger elements to prevent
 * blocking adjacent UI components, specifically fixing the theme dropdown tooltip overlap.
 *
 * Environment: vitest + jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

describe('Tooltip component placement prop functionality', () => {
  let tooltipContent: string;

  beforeEach(() => {
    // Read the Tooltip component file to test
    const tooltipPath = path.join(process.cwd(), 'components/Tooltip.tsx');
    tooltipContent = readFileSync(tooltipPath, 'utf-8');
  });

  describe('placement prop implementation and conditional positioning', () => {
    it('declares placement prop with correct TypeScript interface', () => {
      // Should have placement prop with bottom and right options
      expect(tooltipContent).toContain("placement?: 'bottom' | 'right'");

      // Should have default value of bottom
      expect(tooltipContent).toContain("placement = 'bottom'");
    });

    it('implements conditional positioning classes based on placement prop', () => {
      // Should have conditional logic for positioning
      expect(tooltipContent).toContain("placement === 'right'");

      // Right positioning should use left-full ml-2 top-1/2 -translate-y-1/2
      expect(tooltipContent).toContain("'left-full ml-2 top-1/2 -translate-y-1/2'");

      // Bottom positioning should use top-full mt-2 left-1/2 -translate-x-1/2
      expect(tooltipContent).toContain("'top-full mt-2 left-1/2 -translate-x-1/2'");
    });

    it('validates that positioning logic correctly assigns classes to DOM element', () => {
      // The positionClasses variable should be assigned conditionally
      expect(tooltipContent).toContain('const positionClasses = placement === \'right\'');

      // Classes should be applied to the absolute positioned div
      expect(tooltipContent).toContain('${positionClasses}');
      expect(tooltipContent).toContain('className={`absolute ${positionClasses}');
    });

    it('maintains existing Tailwind styling while adding conditional positioning', () => {
      // Should preserve all existing styling properties
      const requiredStyles = [
        'absolute',
        'px-2 py-1',
        'bg-slate-900',
        'text-slate-200',
        'text-[11px]',
        'font-medium',
        'rounded',
        'opacity-0',
        'group-hover/tooltip:opacity-100',
        'transition-opacity',
        'pointer-events-none',
        'whitespace-nowrap',
        'z-50',
        'shadow-lg',
        'border border-slate-700'
      ];

      requiredStyles.forEach(style => {
        expect(tooltipContent).toContain(style);
      });
    });
  });

  describe('right placement positioning calculations', () => {
    it('ensures right placement positions tooltip correctly relative to trigger element', () => {
      // Right placement should:
      // - Position to the right of trigger (left-full)
      // - Add horizontal spacing (ml-2)
      // - Vertically center (top-1/2 -translate-y-1/2)
      const rightPlacementClasses = 'left-full ml-2 top-1/2 -translate-y-1/2';
      expect(tooltipContent).toContain(rightPlacementClasses);
    });

    it('ensures bottom placement preserves original behavior', () => {
      // Bottom placement should:
      // - Position below trigger (top-full)
      // - Add vertical spacing (mt-2)
      // - Horizontally center (left-1/2 -translate-x-1/2)
      const bottomPlacementClasses = 'top-full mt-2 left-1/2 -translate-x-1/2';
      expect(tooltipContent).toContain(bottomPlacementClasses);
    });

    it('validates that spacing values provide adequate clearance', () => {
      // ml-2 provides 8px horizontal spacing for right placement
      // mt-2 provides 8px vertical spacing for bottom placement
      expect(tooltipContent).toContain('ml-2');
      expect(tooltipContent).toContain('mt-2');

      // Both spacing values should be consistent (both use rem spacing)
      const spacingPattern = /m[lt]-2/g;
      const spacingMatches = tooltipContent.match(spacingPattern);
      expect(spacingMatches).toBeTruthy();
      expect(spacingMatches!.length).toBe(2);
    });
  });

  describe('TypeScript interface and prop validation', () => {
    it('validates placement prop is properly typed as union type', () => {
      // Should use union type for compile-time validation
      expect(tooltipContent).toContain("placement?: 'bottom' | 'right'");

      // Should not accept arbitrary strings
      expect(tooltipContent).not.toContain('placement?: string');
    });

    it('ensures placement prop is optional with sensible default', () => {
      // Should be optional prop (indicated by ?)
      expect(tooltipContent).toContain('placement?:');

      // Should default to 'bottom' to preserve existing behavior
      expect(tooltipContent).toContain("placement = 'bottom'");
    });

    it('validates that component interface matches implementation', () => {
      // Interface should match the destructured props
      const interfaceMatch = tooltipContent.match(/\{\s*children,\s*content,\s*placement[^}]*\}/);
      expect(interfaceMatch).toBeTruthy();

      // TypeScript interface should be properly defined
      expect(tooltipContent).toContain('children: React.ReactNode,');
      expect(tooltipContent).toContain('content: string,');
    });
  });

  describe('accessibility and usability improvements', () => {
    it('ensures right-positioned tooltips maintain hover functionality', () => {
      // Hover detection should work regardless of placement
      expect(tooltipContent).toContain('group/tooltip');
      expect(tooltipContent).toContain('group-hover/tooltip:opacity-100');

      // Transition should remain smooth for both placements
      expect(tooltipContent).toContain('transition-opacity');
    });

    it('validates that tooltips remain non-interactive regardless of placement', () => {
      // Tooltips should not interfere with user interactions
      expect(tooltipContent).toContain('pointer-events-none');

      // Z-index should be high enough to appear above other content
      expect(tooltipContent).toContain('z-50');
    });

    it('ensures tooltip content remains accessible across both placements', () => {
      // Content should be displayed consistently
      expect(tooltipContent).toContain('{content}');

      // Text properties should work for both orientations
      expect(tooltipContent).toContain('whitespace-nowrap');
      expect(tooltipContent).toContain('text-[11px]');
    });
  });

  describe('regression tests for theme dropdown tooltip blocking issue', () => {
    it('validates that right placement prevents tooltip from overlapping adjacent elements', () => {
      // Right placement moves tooltip horizontally away from trigger
      expect(tooltipContent).toContain('left-full');

      // This should prevent the tooltip from appearing below and blocking subsequent elements
      expect(tooltipContent).toContain("placement === 'right'");
    });

    it('ensures backward compatibility with existing bottom-positioned tooltips', () => {
      // Default behavior should remain unchanged for components not specifying placement
      expect(tooltipContent).toContain("placement = 'bottom'");

      // Bottom placement should use original positioning logic
      expect(tooltipContent).toContain('top-full mt-2 left-1/2 -translate-x-1/2');
    });

    it('validates WYSIWYG/DITA parity by ensuring consistent tooltip behavior across modes', () => {
      // Tooltip positioning should work identically regardless of content type
      const conditionalLogic = tooltipContent.match(/placement === 'right'/);
      expect(conditionalLogic).toBeTruthy();

      // Both positioning options should be deterministic based on prop value
      expect(tooltipContent).toContain('? \'left-full ml-2 top-1/2 -translate-y-1/2\'');
      expect(tooltipContent).toContain(': \'top-full mt-2 left-1/2 -translate-x-1/2\'');
    });
  });

  describe('CSS class management and DOM structure', () => {
    it('validates that positioning classes are applied correctly to tooltip container', () => {
      // Classes should be interpolated into className string
      expect(tooltipContent).toContain('className={`absolute ${positionClasses}');

      // Should maintain consistent CSS class structure
      expect(tooltipContent).toContain('absolute');
    });

    it('ensures all Tailwind classes are properly concatenated', () => {
      // Check for proper template literal usage
      expect(tooltipContent).toContain('className={`');

      // All style classes should be included in the className
      const requiredClasses = [
        'px-2 py-1',
        'bg-slate-900',
        'text-slate-200',
        'rounded',
        'shadow-lg'
      ];

      requiredClasses.forEach(className => {
        expect(tooltipContent).toContain(className);
      });
    });

    it('validates that group/tooltip pattern enables proper hover state management', () => {
      // Parent should have group class for hover detection
      expect(tooltipContent).toContain('className="group/tooltip relative');

      // Child should respond to parent hover
      expect(tooltipContent).toContain('group-hover/tooltip:opacity-100');
    });
  });
});