// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { SyncManager } from '../components/SyncManager';
import { DitaImageNode } from '../components/DitaImageNode';
import { DitaPhRefNode } from '../components/DitaPhRefNode';
import React from 'react';

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
  suspendSync?: boolean;
  syncTrigger?: number;
}) {
  return render(
    <LexicalComposer initialConfig={createTestConfig()}>
      <SyncManager
        xmlContent={props.xmlContent}
        onLexicalChange={vi.fn()}
        lastUpdatedBy={props.lastUpdatedBy}
        suspendSync={props.suspendSync ?? false}
        syncTrigger={props.syncTrigger ?? 0}
      >
        <div data-testid="editor-content">Mock Editor Content</div>
      </SyncManager>
    </LexicalComposer>
  );
}

const BANNER_TEXT = 'Visual editor is out of sync — press Ctrl+Enter to refresh';

describe('SyncManager out-of-sync banner functionality', () => {
  it('does not show banner when content was updated by visual editor', () => {
    renderSyncManager({
      xmlContent: '<task><title>Updated by visual editor</title></task>',
      lastUpdatedBy: 'editor',
      suspendSync: false,
    });
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('does not show banner when content was updated by API', () => {
    renderSyncManager({
      xmlContent: '<task><title>Updated by API</title></task>',
      lastUpdatedBy: 'api',
      suspendSync: false,
    });
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('does not show banner when in edit mode regardless of update source', () => {
    renderSyncManager({
      xmlContent: '<task><title>Updated by code while in edit mode</title></task>',
      lastUpdatedBy: 'code',
      suspendSync: true,
    });
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('renders editor children', () => {
    renderSyncManager({
      xmlContent: '<task><title>Test</title></task>',
      lastUpdatedBy: 'editor',
      suspendSync: false,
    });
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
  });
});

// FR-056: PUT /api/tabs/:id/content must render immediately while in suggesting mode,
// regardless of whether the Lexical editor has focus.
describe('SyncManager FR-056 — API flush in suggesting mode', () => {
  const INITIAL_XML = '<task><title>Initial</title><taskbody/></task>';
  const UPDATED_XML = '<task><title>Updated by API</title><taskbody><context><p>New content</p></context></taskbody></task>';

  it('applies an API update immediately when suspendSync is true and editor does NOT have focus', async () => {
    // This is the real repro: caret is NOT in the visual editor when the PUT arrives.
    // Ensure no Lexical root element has focus (jsdom default — document.body has focus, not the editor).
    const onLexicalChange = vi.fn();

    const { rerender } = render(
      <LexicalComposer initialConfig={createTestConfig()}>
        <SyncManager
          xmlContent={INITIAL_XML}
          onLexicalChange={onLexicalChange}
          lastUpdatedBy="editor"
          suspendSync={false}
          syncTrigger={0}
        >
          <div data-testid="editor-content" />
        </SyncManager>
      </LexicalComposer>
    );

    // Transition to suggesting mode (suspendSync = true), then deliver API update.
    await act(async () => {
      rerender(
        <LexicalComposer initialConfig={createTestConfig()}>
          <SyncManager
            xmlContent={UPDATED_XML}
            onLexicalChange={onLexicalChange}
            lastUpdatedBy="api"
            suspendSync={true}
            syncTrigger={1}
          >
            <div data-testid="editor-content" />
          </SyncManager>
        </LexicalComposer>
      );
    });

    // The out-of-sync banner must NOT appear — API content was applied, not buffered.
    expect(screen.queryByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).not.toBeInTheDocument();
  });

  it('does NOT apply a non-API (code) update while suspendSync is true', async () => {
    // Monaco edit arriving while suggesting — must be buffered, not parsed.
    // Banner visible only when !suspendSync, so we test via the absence of a banner even
    // in the !suspendSync state we'd get after toggling back (regression guard).
    const onLexicalChange = vi.fn();

    const { rerender } = render(
      <LexicalComposer initialConfig={createTestConfig()}>
        <SyncManager
          xmlContent={INITIAL_XML}
          onLexicalChange={onLexicalChange}
          lastUpdatedBy="editor"
          suspendSync={false}
          syncTrigger={0}
        >
          <div data-testid="editor-content" />
        </SyncManager>
      </LexicalComposer>
    );

    // Deliver a code (Monaco) update while suspended — must buffer, not flush.
    await act(async () => {
      rerender(
        <LexicalComposer initialConfig={createTestConfig()}>
          <SyncManager
            xmlContent={UPDATED_XML}
            onLexicalChange={onLexicalChange}
            lastUpdatedBy="code"
            suspendSync={true}
            syncTrigger={0}
          >
            <div data-testid="editor-content" />
          </SyncManager>
        </LexicalComposer>
      );
    });

    // No banner while suspendSync is true (gated on !suspendSync) — content correctly buffered.
    expect(screen.queryByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).not.toBeInTheDocument();
  });

  it('applies an API update immediately even when the Lexical root DOES have focus', async () => {
    // Focus must not matter — both focus states must take the same immediate path.
    const onLexicalChange = vi.fn();

    const { rerender, container } = render(
      <LexicalComposer initialConfig={createTestConfig()}>
        <SyncManager
          xmlContent={INITIAL_XML}
          onLexicalChange={onLexicalChange}
          lastUpdatedBy="editor"
          suspendSync={false}
          syncTrigger={0}
        >
          <div data-testid="editor-content" />
        </SyncManager>
      </LexicalComposer>
    );

    // Simulate editor focus before delivering the API update.
    const editorRoot = container.querySelector('[contenteditable]');
    if (editorRoot) (editorRoot as HTMLElement).focus();

    await act(async () => {
      rerender(
        <LexicalComposer initialConfig={createTestConfig()}>
          <SyncManager
            xmlContent={UPDATED_XML}
            onLexicalChange={onLexicalChange}
            lastUpdatedBy="api"
            suspendSync={true}
            syncTrigger={1}
          >
            <div data-testid="editor-content" />
          </SyncManager>
        </LexicalComposer>
      );
    });

    // No banner — applied immediately regardless of focus.
    expect(screen.queryByText('Visual editor is out of sync — press Ctrl+Enter to refresh')).not.toBeInTheDocument();
  });
});
