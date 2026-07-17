// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
