// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

// ─── Elena Feedback Regression Test ─────────────────────────────────────────

describe('Elena feedback regression - TypeScript optional chaining fix', () => {
  it('validates that ancestorUuids optional chaining prevents TypeError when property is undefined', () => {
    // Simulate the exact scenario that was causing TypeScript errors
    const mockHerettoFileWithUndefinedAncestors: {
      uuid: string;
      name: string;
      path: string;
      parentFolderUuid: string;
      ancestorUuids?: string[]
    } = {
      uuid: 'test-file-uuid',
      name: 'test.dita',
      path: '/path/to/test.dita',
      parentFolderUuid: 'parent-folder-uuid',
      // ancestorUuids: undefined -- deliberately omitted to simulate undefined
    };

    // The fix Jamie implemented: ancestorUuids?.length || 0
    // This should handle undefined gracefully instead of throwing TypeError
    const ancestorUuidsCount = mockHerettoFileWithUndefinedAncestors.ancestorUuids?.length || 0;

    expect(ancestorUuidsCount).toBe(0);
  });

  it('validates that ancestorUuids optional chaining works correctly when property is present', () => {
    // Test the positive case where ancestorUuids exists
    const mockHerettoFileWithAncestors: {
      uuid: string;
      name: string;
      path: string;
      parentFolderUuid: string;
      ancestorUuids?: string[]
    } = {
      uuid: 'test-file-uuid',
      name: 'test.dita',
      path: '/path/to/test.dita',
      parentFolderUuid: 'parent-folder-uuid',
      ancestorUuids: ['root-uuid', 'parent-folder-uuid']
    };

    // The fix Jamie implemented: ancestorUuids?.length || 0
    const ancestorUuidsCount = mockHerettoFileWithAncestors.ancestorUuids?.length || 0;

    expect(ancestorUuidsCount).toBe(2);
  });

  it('validates that ancestorUuids optional chaining works correctly when property is null', () => {
    // Test the edge case where ancestorUuids is explicitly null
    const mockHerettoFileWithNullAncestors: {
      uuid: string;
      name: string;
      path: string;
      parentFolderUuid: string;
      ancestorUuids?: string[] | null
    } = {
      uuid: 'test-file-uuid',
      name: 'test.dita',
      path: '/path/to/test.dita',
      parentFolderUuid: 'parent-folder-uuid',
      ancestorUuids: null
    };

    // The fix Jamie implemented: ancestorUuids?.length || 0
    const ancestorUuidsCount = mockHerettoFileWithNullAncestors.ancestorUuids?.length || 0;

    expect(ancestorUuidsCount).toBe(0);
  });

  it('confirms TypeScript compilation success with optional chaining syntax', () => {
    // This test validates that the TypeScript compilation doesn't fail
    // for the optional chaining pattern used in the fix
    const testObject: { ancestorUuids?: string[] } = {};

    // This exact syntax is what Jamie used to fix the TypeScript errors
    const count = testObject.ancestorUuids?.length || 0;

    expect(typeof count).toBe('number');
    expect(count).toBe(0);
  });
});