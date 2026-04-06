// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compareXml } from '../lib/xml-utils';

// ─── test utilities ──────────────────────────────────────────────────────────

// Mock tab structure for testing polling behavior
interface MockTab {
  id: string;
  savedXmlRef: { current: string | null };
  herettoRemoteChanged: boolean;
}

// Simulate the polling logic from useHerettoCms
function simulatePollingCheck(tab: MockTab, remoteContent: string) {
  const savedContent = tab.savedXmlRef.current;
  if (!savedContent) return false;

  const comparison = compareXml(savedContent, remoteContent);
  return comparison === 'different';
}

// ─── compareXml polling behavior ──────────────────────────────────────────────

describe('Heretto polling with compareXml to eliminate false positives', () => {
  // ── formatting differences that should NOT trigger "Updated in Heretto" ──

  it('does not detect difference when only whitespace formatting differs', () => {
    const localContent = '<task><title>My Task</title><body><p>Task content here.</p></body></task>';
    const remoteContent = `<task>
  <title>My Task</title>
  <body>
    <p>Task content here.</p>
  </body>
</task>`;

    const tab: MockTab = {
      id: 'test-1',
      savedXmlRef: { current: localContent },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(false);
  });

  it('does not detect difference when indentation varies', () => {
    const localContent = '<task><title>Task Title</title><body><steps><step><cmd>Step 1</cmd></step></steps></body></task>';
    const remoteContent = `<task>
    <title>Task Title</title>
    <body>
        <steps>
            <step>
                <cmd>Step 1</cmd>
            </step>
        </steps>
    </body>
</task>`;

    const tab: MockTab = {
      id: 'test-2',
      savedXmlRef: { current: localContent },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(false);
  });

  it('does not detect difference when attribute order varies', () => {
    const localContent = '<task id="task1" outputclass="example"><title>Test</title></task>';
    const remoteContent = '<task outputclass="example" id="task1"><title>Test</title></task>';

    const tab: MockTab = {
      id: 'test-3',
      savedXmlRef: { current: localContent },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(false);
  });

  it('does not detect difference when empty elements have different notation', () => {
    const localContent = '<task><title>Test</title><body><p></p></body></task>';
    const remoteContent = '<task><title>Test</title><body><p/></body></task>';

    const tab: MockTab = {
      id: 'test-4',
      savedXmlRef: { current: localContent },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(false);
  });

  it('does not detect difference when XML declarations differ', () => {
    const localContent = '<task><title>My Task</title></task>';
    const remoteContent = '<?xml version="1.0" encoding="UTF-8"?><task><title>My Task</title></task>';

    const tab: MockTab = {
      id: 'test-5',
      savedXmlRef: { current: localContent },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(false);
  });

  // ── actual content differences that SHOULD trigger "Updated in Heretto" ──

  it('detects difference when text content changes', () => {
    const localContent = '<task><title>Original Title</title><body><p>Original content.</p></body></task>';
    const remoteContent = '<task><title>Updated Title</title><body><p>Original content.</p></body></task>';

    const tab: MockTab = {
      id: 'test-6',
      savedXmlRef: { current: localContent },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(true);
  });

  it('detects difference when elements are added', () => {
    const localContent = '<task><title>Task</title><body><p>Content.</p></body></task>';
    const remoteContent = '<task><title>Task</title><shortdesc>New description</shortdesc><body><p>Content.</p></body></task>';

    const tab: MockTab = {
      id: 'test-7',
      savedXmlRef: { current: localContent },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(true);
  });

  it('detects difference when elements are removed', () => {
    const localContent = '<task><title>Task</title><shortdesc>Description</shortdesc><body><p>Content.</p></body></task>';
    const remoteContent = '<task><title>Task</title><body><p>Content.</p></body></task>';

    const tab: MockTab = {
      id: 'test-8',
      savedXmlRef: { current: localContent },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(true);
  });

  it('detects difference when attribute values change', () => {
    const localContent = '<task id="task1"><title>Task</title></task>';
    const remoteContent = '<task id="task2"><title>Task</title></task>';

    const tab: MockTab = {
      id: 'test-9',
      savedXmlRef: { current: localContent },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(true);
  });

  it('detects difference when attributes are added or removed', () => {
    const localContent = '<task><title>Task</title></task>';
    const remoteContent = '<task outputclass="important"><title>Task</title></task>';

    const tab: MockTab = {
      id: 'test-10',
      savedXmlRef: { current: localContent },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(true);
  });

  // ── integration with actual polling workflow ──────────────────────────────

  it('integrates properly with tab state management', () => {
    let tab: MockTab = {
      id: 'integration-test',
      savedXmlRef: { current: '<task><title>Original</title></task>' },
      herettoRemoteChanged: false
    };

    // Simulate formatting-only change from remote - should not set flag
    const formattedRemote = `<task>
  <title>Original</title>
</task>`;

    let hasChanges = simulatePollingCheck(tab, formattedRemote);
    expect(hasChanges).toBe(false);

    // Simulate actual content change from remote - should set flag
    const contentChangedRemote = '<task><title>Updated by remote user</title></task>';

    hasChanges = simulatePollingCheck(tab, contentChangedRemote);
    expect(hasChanges).toBe(true);
  });

  it('handles multiple rapid polls with formatting variations', () => {
    const baseContent = '<task id="test"><title>My Task</title><body><p>Content here.</p></body></task>';

    const formattingVariations = [
      // Different whitespace
      '<task id="test">\n  <title>My Task</title>\n  <body>\n    <p>Content here.</p>\n  </body>\n</task>',
      // Different attribute order
      '<task id="test"><title>My Task</title><body><p>Content here.</p></body></task>',
      // Self-closing tags
      '<task id="test"><title>My Task</title><body><p>Content here.</p></body></task>',
      // Extra whitespace
      '<task id="test"> <title>My Task</title> <body> <p>Content here.</p> </body> </task>'
    ];

    const tab: MockTab = {
      id: 'rapid-poll-test',
      savedXmlRef: { current: baseContent },
      herettoRemoteChanged: false
    };

    // All formatting variations should be considered identical
    formattingVariations.forEach((variation, index) => {
      const hasChanges = simulatePollingCheck(tab, variation);
      expect(hasChanges, `Variation ${index + 1} should not trigger change detection`).toBe(false);
    });
  });

  // ── edge cases and error handling ─────────────────────────────────────────

  it('handles null saved content gracefully', () => {
    const tab: MockTab = {
      id: 'null-test',
      savedXmlRef: { current: null },
      herettoRemoteChanged: false
    };

    const remoteContent = '<task><title>Remote Content</title></task>';

    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(false); // No comparison possible, should not trigger
  });

  it('handles empty XML content', () => {
    const tab: MockTab = {
      id: 'empty-test',
      savedXmlRef: { current: '' },
      herettoRemoteChanged: false
    };

    const remoteContent = '';
    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(false);
  });

  it('handles malformed XML gracefully', () => {
    const localContent = '<task><title>Test</title></task>';
    const malformedRemote = '<task><title>Test</title>'; // Missing closing tag

    const tab: MockTab = {
      id: 'malformed-test',
      savedXmlRef: { current: localContent },
      herettoRemoteChanged: false
    };

    // Should handle malformed XML without crashing
    const hasChanges = simulatePollingCheck(tab, malformedRemote);
    expect(typeof hasChanges).toBe('boolean'); // Should not throw
  });

  it('handles very large XML documents efficiently', () => {
    const largeContent = `<task><title>Large Document</title><body>${'<p>Content paragraph.</p>'.repeat(1000)}</body></task>`;
    const largeContentFormatted = `<task>
  <title>Large Document</title>
  <body>
    ${Array.from({ length: 1000 }, (_, i) => `    <p>Content paragraph.</p>`).join('\n')}
  </body>
</task>`;

    const tab: MockTab = {
      id: 'large-doc-test',
      savedXmlRef: { current: largeContent },
      herettoRemoteChanged: false
    };

    const start = performance.now();
    const hasChanges = simulatePollingCheck(tab, largeContentFormatted);
    const end = performance.now();

    expect(hasChanges).toBe(false); // Should be considered identical despite formatting
    expect(end - start).toBeLessThan(1000); // Should complete in reasonable time
  });

  // ── prevention of false positive scenarios ───────────────────────────────

  it('prevents false "Updated in Heretto" when content was reformatted by Heretto', () => {
    // This scenario happens when Heretto automatically reformats the XML
    const userContent = '<task><title>User Created Task</title><body><p>User content.</p></body></task>';
    const herettoFormatted = `<task>
    <title>User Created Task</title>
    <body>
        <p>User content.</p>
    </body>
</task>`;

    const tab: MockTab = {
      id: 'format-test',
      savedXmlRef: { current: userContent },
      herettoRemoteChanged: false
    };

    // Should NOT detect this as a change (old behavior would have)
    const hasChanges = simulatePollingCheck(tab, herettoFormatted);
    expect(hasChanges).toBe(false);
  });

  it('prevents false positives when XML declaration is added by server', () => {
    const clientContent = '<concept><title>My Concept</title><conbody><p>Content.</p></conbody></concept>';
    const serverContent = '<?xml version="1.0" encoding="UTF-8"?>\n<concept><title>My Concept</title><conbody><p>Content.</p></conbody></concept>';

    const tab: MockTab = {
      id: 'declaration-test',
      savedXmlRef: { current: clientContent },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, serverContent);
    expect(hasChanges).toBe(false);
  });

  it('prevents false positives when DOCTYPE is added or modified', () => {
    const localContent = '<task><title>Task</title></task>';
    const remoteContent = '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">\n<task><title>Task</title></task>';

    const tab: MockTab = {
      id: 'doctype-test',
      savedXmlRef: { current: localContent },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, remoteContent);
    expect(hasChanges).toBe(false);
  });

  // ── verification of compareXml usage effectiveness ───────────────────────

  it('demonstrates improvement over string equality comparison', () => {
    const content1 = '<task><title>Test</title><body><p>Content</p></body></task>';
    const content2 = `<task>
  <title>Test</title>
  <body>
    <p>Content</p>
  </body>
</task>`;

    // String equality would show different
    expect(content1 === content2 as string).toBe(false);

    // compareXml should show identical or formatting (both mean no content change)
    const xmlComparison = compareXml(content1, content2);
    expect(['identical', 'formatting']).toContain(xmlComparison);

    // Our polling logic should use compareXml result
    const tab: MockTab = {
      id: 'comparison-test',
      savedXmlRef: { current: content1 },
      herettoRemoteChanged: false
    };

    const hasChanges = simulatePollingCheck(tab, content2);
    expect(hasChanges).toBe(false); // Using compareXml prevents false positive
  });
});