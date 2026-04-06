// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createEditor } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { SyncManager } from '../components/SyncManager';
import { DitaImageNode } from '../components/DitaImageNode';
import { DitaPhRefNode } from '../components/DitaPhRefNode';
import React from 'react';

// ─── test utilities ──────────────────────────────────────────────────────────

const mockNodes = [DitaImageNode, DitaPhRefNode];

function createTestConfig() {
  return {
    namespace: 'test-editor',
    nodes: mockNodes,
    onError: vi.fn(),
    theme: {},
  };
}

function renderSyncManager(props: {
  xmlContent: string;
  lastUpdatedBy: 'editor' | 'code' | 'api';
  editMode?: boolean;
  syncTrigger?: number;
}) {
  const config = createTestConfig();
  const mockOnLexicalChange = vi.fn();

  return render(
    <LexicalComposer initialConfig={config}>
      <SyncManager
        xmlContent={props.xmlContent}
        onLexicalChange={mockOnLexicalChange}
        lastUpdatedBy={props.lastUpdatedBy}
        editMode={props.editMode ?? false}
        syncTrigger={props.syncTrigger ?? 0}
      >
        <div data-testid="editor-content">Mock Editor Content</div>
      </SyncManager>
    </LexicalComposer>
  );
}

// ─── Out-of-sync banner functionality ───────────────────────────────────────

describe('SyncManager out-of-sync banner functionality', () => {
  // ── banner visibility logic ──────────────────────────────────────────────

  it('shows banner when visual editor is out of sync with XML code changes', async () => {
    const xmlContent = '<task><title>Updated by code editor</title></task>';

    renderSyncManager({
      xmlContent,
      lastUpdatedBy: 'code',
      editMode: false
    });

    // Should show the out-of-sync banner
    expect(screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).toBeInTheDocument();

    // Banner should have the correct CSS class
    const banner = screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh');
    expect(banner).toHaveClass('dita-sync-banner');
  });

  it('does not show banner when content was updated by visual editor', () => {
    const xmlContent = '<task><title>Updated by visual editor</title></task>';

    renderSyncManager({
      xmlContent,
      lastUpdatedBy: 'editor',
      editMode: false
    });

    // Should not show the banner
    expect(screen.queryByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).not.toBeInTheDocument();
  });

  it('does not show banner when content was updated by API', () => {
    const xmlContent = '<task><title>Updated by API</title></task>';

    renderSyncManager({
      xmlContent,
      lastUpdatedBy: 'api',
      editMode: false
    });

    // Should not show the banner when updated by API (API updates are already synced)
    expect(screen.queryByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).not.toBeInTheDocument();
  });

  it('does not show banner when in edit mode regardless of update source', () => {
    const xmlContent = '<task><title>Updated by code while in edit mode</title></task>';

    renderSyncManager({
      xmlContent,
      lastUpdatedBy: 'code',
      editMode: true
    });

    // Should not show banner in edit mode
    expect(screen.queryByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).not.toBeInTheDocument();
  });

  // ── banner positioning and styling ───────────────────────────────────────

  it('positions banner correctly with proper CSS classes', () => {
    const xmlContent = '<task><title>Code change</title></task>';

    renderSyncManager({
      xmlContent,
      lastUpdatedBy: 'code',
      editMode: false
    });

    const banner = screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh');

    // Should have the dita-sync-banner class for styling
    expect(banner).toHaveClass('dita-sync-banner');

    // Check that the banner is rendered as expected
    expect(banner).toBeInTheDocument();
    expect(banner.tagName).toBe('DIV');
  });

  // ── banner state transitions ─────────────────────────────────────────────

  it('shows banner after XML code change and hides after sync trigger', () => {
    const { rerender } = renderSyncManager({
      xmlContent: '<task><title>Original content</title></task>',
      lastUpdatedBy: 'editor',
      editMode: false,
      syncTrigger: 0
    });

    // Initially no banner (editor update)
    expect(screen.queryByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).not.toBeInTheDocument();

    // Content updated by code editor - should show banner
    rerender(
      <LexicalComposer initialConfig={createTestConfig()}>
        <SyncManager
          xmlContent="<task><title>Updated by code</title></task>"
          onLexicalChange={vi.fn()}
          lastUpdatedBy="code"
          editMode={false}
          syncTrigger={0}
        >
          <div data-testid="editor-content">Mock Editor Content</div>
        </SyncManager>
      </LexicalComposer>
    );

    expect(screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).toBeInTheDocument();

    // After sync trigger (simulating Ctrl+Enter) - banner should disappear
    rerender(
      <LexicalComposer initialConfig={createTestConfig()}>
        <SyncManager
          xmlContent="<task><title>Updated by code</title></task>"
          onLexicalChange={vi.fn()}
          lastUpdatedBy="editor" // After sync, lastUpdatedBy becomes 'editor'
          editMode={false}
          syncTrigger={1}
        >
          <div data-testid="editor-content">Mock Editor Content</div>
        </SyncManager>
      </LexicalComposer>
    );

    expect(screen.queryByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).not.toBeInTheDocument();
  });

  it('handles rapid state changes without banner flicker', () => {
    const { rerender } = renderSyncManager({
      xmlContent: '<task><title>Version 1</title></task>',
      lastUpdatedBy: 'editor',
      editMode: false
    });

    // Multiple rapid code changes
    const versions = [
      '<task><title>Version 2</title></task>',
      '<task><title>Version 3</title></task>',
      '<task><title>Version 4</title></task>'
    ];

    versions.forEach((content, index) => {
      rerender(
        <LexicalComposer initialConfig={createTestConfig()}>
          <SyncManager
            xmlContent={content}
            onLexicalChange={vi.fn()}
            lastUpdatedBy="code"
            editMode={false}
            syncTrigger={0}
          >
            <div data-testid="editor-content">Mock Editor Content</div>
          </SyncManager>
        </LexicalComposer>
      );

      // Banner should consistently show for all code changes
      expect(screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).toBeInTheDocument();
    });
  });

  // ── integration with edit mode ───────────────────────────────────────────

  it('respects edit mode transitions', () => {
    const { rerender } = renderSyncManager({
      xmlContent: '<task><title>Content changed by code</title></task>',
      lastUpdatedBy: 'code',
      editMode: false
    });

    // Should show banner initially
    expect(screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).toBeInTheDocument();

    // Enter edit mode - banner should disappear
    rerender(
      <LexicalComposer initialConfig={createTestConfig()}>
        <SyncManager
          xmlContent="<task><title>Content changed by code</title></task>"
          onLexicalChange={vi.fn()}
          lastUpdatedBy="code"
          editMode={true}
        >
          <div data-testid="editor-content">Mock Editor Content</div>
        </SyncManager>
      </LexicalComposer>
    );

    expect(screen.queryByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).not.toBeInTheDocument();

    // Exit edit mode - banner should reappear
    rerender(
      <LexicalComposer initialConfig={createTestConfig()}>
        <SyncManager
          xmlContent="<task><title>Content changed by code</title></task>"
          onLexicalChange={vi.fn()}
          lastUpdatedBy="code"
          editMode={false}
        >
          <div data-testid="editor-content">Mock Editor Content</div>
        </SyncManager>
      </LexicalComposer>
    );

    expect(screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).toBeInTheDocument();
  });

  // ── banner does not interfere with editor ────────────────────────────────

  it('does not block editor interaction when banner is shown', () => {
    renderSyncManager({
      xmlContent: '<task><title>Changed by code</title></task>',
      lastUpdatedBy: 'code',
      editMode: false
    });

    // Banner should be present
    const banner = screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh');
    expect(banner).toBeInTheDocument();

    // Editor content should still be accessible
    const editorContent = screen.getByTestId('editor-content');
    expect(editorContent).toBeInTheDocument();
    expect(editorContent).toBeVisible();

    // Should be able to interact with editor content
    fireEvent.click(editorContent);
    // No errors should be thrown, content should remain accessible
    expect(editorContent).toBeInTheDocument();
  });

  // ── accessibility ─────────────────────────────────────────────────────────

  it('provides appropriate accessibility attributes for banner', () => {
    renderSyncManager({
      xmlContent: '<task><title>Changed by code</title></task>',
      lastUpdatedBy: 'code',
      editMode: false
    });

    const banner = screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh');

    // Banner should be visible and readable by screen readers
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('class', 'dita-sync-banner');
  });

  // ── banner message accuracy ──────────────────────────────────────────────

  it('displays correct message with keyboard shortcut instruction', () => {
    renderSyncManager({
      xmlContent: '<task><title>Code update</title></task>',
      lastUpdatedBy: 'code',
      editMode: false
    });

    // Verify exact message text
    const expectedMessage = 'Visual editor is out of sync — press Ctrl+Enter to refresh';
    expect(screen.getByText(expectedMessage)).toBeInTheDocument();

    // Message should be clear and actionable
    const banner = screen.getByText(expectedMessage);
    expect(banner.textContent).toBe(expectedMessage);
  });

  // ── edge cases ────────────────────────────────────────────────────────────

  it('handles empty XML content with code updates', () => {
    renderSyncManager({
      xmlContent: '',
      lastUpdatedBy: 'code',
      editMode: false
    });

    // Should still show banner even with empty content
    expect(screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).toBeInTheDocument();
  });

  it('handles malformed XML content with code updates', () => {
    renderSyncManager({
      xmlContent: '<task><title>Unclosed tag',
      lastUpdatedBy: 'code',
      editMode: false
    });

    // Should show banner regardless of XML validity
    expect(screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).toBeInTheDocument();
  });

  it('handles very large XML content with code updates', () => {
    const largeXmlContent = `<task><title>Large Content</title><body>${'<p>Content </p>'.repeat(1000)}</body></task>`;

    renderSyncManager({
      xmlContent: largeXmlContent,
      lastUpdatedBy: 'code',
      editMode: false
    });

    // Should show banner even with large content
    expect(screen.getByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).toBeInTheDocument();
  });
});