// @vitest-environment jsdom
//
// ADR-017 W5 and decision 5 — the Explorer view: a folder is listed on first
// expand only, through herettoFolderCache; one expanded ten-deep path is
// exactly eleven listing requests; a topic click hands handleHerettoOpen a
// search-result-shaped item (path without the root's name, ancestors root
// first); Open Editors shows every tab with its dirty dot or review badge; the
// `…` menu reaches every command the retired dropdowns offered (W4).

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { serveHeretto, herettoRequests, type FakeTenant } from '../helpers/fakeHeretto';
import { herettoFolderCache } from '../../constants/heretto';
import { ExplorerView, type ExplorerCommands, type ExplorerTab, type FilenameSearch } from '../../components/workbench/views/ExplorerView';

/** root → d1 → d2 … → d10, each level also holding one topic. */
function deepTenant(depth: number): FakeTenant {
  const t: FakeTenant = { folders: { root: { name: 'Content', parent: null } }, files: {} };
  let parent = 'root';
  for (let i = 1; i <= depth; i++) {
    const id = `d${i}`;
    t.folders[id] = { name: `Level ${i}`, parent };
    t.files[`f${i}`] = { name: `topic-${i}.dita`, folder: id, content: `<concept id="c${i}"/>` };
    parent = id;
  }
  t.files.f0 = { name: 'root-topic.dita', folder: 'root', content: '<concept id="c0"/>' };
  return t;
}

const commands = (): ExplorerCommands & { calls: string[] } => {
  const calls: string[] = [];
  const c = (n: string) => () => { calls.push(n); };
  return {
    calls,
    onNewTopic: c('onNewTopic'), onOpenLocalFile: c('onOpenLocalFile'), onOpenFromHeretto: c('onOpenFromHeretto'),
    onSaveToHeretto: c('onSaveToHeretto'), onSaveLocalCopy: c('onSaveLocalCopy'), onReplace: c('onReplace'),
    onExportPdf: c('onExportPdf'), onConvertTopicType: c('onConvertTopicType'), onConnectMap: c('onConnectMap'),
    connectedMapName: null, onReloadMap: c('onReloadMap'), onDisconnectMap: c('onDisconnectMap'),
    onKeyboardShortcuts: c('onKeyboardShortcuts'),
  };
};

const tabs: ExplorerTab[] = [
  { id: 't1', name: 'topic-3.dita', dirty: false, pendingReview: false, herettoUuid: 'f3' },
  { id: 't2', name: 'draft.dita', dirty: true, pendingReview: false, herettoUuid: null },
  { id: 't3', name: 'reviewed.dita', dirty: true, pendingReview: true, herettoUuid: null },
];

function renderExplorer(over: Partial<React.ComponentProps<typeof ExplorerView>> = {}) {
  const cmds = commands();
  const props: React.ComponentProps<typeof ExplorerView> = {
    tabs, activeTabId: 't1', onActivateTab: vi.fn(), onCloseTab: vi.fn(),
    herettoConnected: true, rootUuid: 'root', host: 'example.heretto.com',
    onOpenTopic: vi.fn(), commands: cmds,
    filenameSearch: { run: vi.fn(), results: [], status: { phase: 'idle' }, abortRef: { current: null } } as FilenameSearch,
    ...over,
  };
  const utils = render(<ExplorerView {...props} />);
  return { ...utils, props, cmds };
}

beforeEach(() => { herettoFolderCache.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

const listings = () => herettoRequests.filter(u => /^\/heretto-api\/all-files\/[^/]+$/.test(u));

describe('W5 — lazy listing through the shared folder cache', () => {
  it('lists the root at mount, one request, and nothing else until a folder is expanded', async () => {
    serveHeretto(deepTenant(10));
    renderExplorer();
    await screen.findByText('Level 1');
    expect(listings()).toEqual(['/heretto-api/all-files/root']);
    expect(screen.queryByText('Level 2')).toBeNull();
  });

  it('one expanded ten-deep path is exactly eleven listing requests', async () => {
    serveHeretto(deepTenant(10));
    renderExplorer();
    for (let i = 1; i <= 10; i++) {
      const row = await screen.findByText(`Level ${i}`);
      fireEvent.click(row);
      await screen.findByText(`topic-${i}.dita`);
    }
    expect(listings().length).toBe(11);
    expect(new Set(listings()).size).toBe(11);
  });

  it('collapsing and re-expanding a folder makes no second request; a listing already in the cache makes none', async () => {
    const tenant = deepTenant(2);
    serveHeretto(tenant);
    renderExplorer();
    const l1 = await screen.findByText('Level 1');
    fireEvent.click(l1);
    await screen.findByText('Level 2');
    fireEvent.click(screen.getByText('Level 1'));                 // collapse
    expect(screen.queryByText('Level 2')).toBeNull();
    fireEvent.click(screen.getByText('Level 1'));                 // expand again
    await screen.findByText('Level 2');
    expect(listings().length).toBe(2);

    // The modal (or the image resolver) already listed d2: the tree reuses it.
    herettoFolderCache.set('d2', [{ uuid: 'cached', name: 'from-cache.dita', type: 'file' }]);
    fireEvent.click(screen.getByText('Level 2'));
    await screen.findByText('from-cache.dita');
    expect(listings().length).toBe(2);
  });

  it('a failed listing shows a retry that lists again', async () => {
    const tenant = deepTenant(1);
    serveHeretto(tenant, { '/heretto-api/all-files/d1': 500 });
    renderExplorer();
    fireEvent.click(await screen.findByText('Level 1'));
    const retry = await screen.findByRole('button', { name: 'Retry listing Level 1' });
    serveHeretto(tenant);                                          // the server recovers
    fireEvent.click(retry);
    await screen.findByText('topic-1.dita');
  });
});

describe('decision 5 — opening a topic', () => {
  it('hands handleHerettoOpen a search-result shape: path without the root name, ancestors root first', async () => {
    serveHeretto(deepTenant(3));
    const { props } = renderExplorer();
    // Open Editors also lists a tab named topic-3.dita: query inside the tree only.
    const tree = within(screen.getByTestId('folder-tree'));
    fireEvent.click(await tree.findByText('Level 1'));
    fireEvent.click(await tree.findByText('Level 2'));
    fireEvent.click(await tree.findByText('Level 3'));
    fireEvent.click(await tree.findByText('topic-3.dita'));
    expect(props.onOpenTopic).toHaveBeenCalledWith({
      uuid: 'f3', name: 'topic-3.dita', type: 'file',
      path: 'Level 1/Level 2/Level 3/topic-3.dita',
      ancestorUuids: ['root', 'd1', 'd2', 'd3'],
    });
  });

  it('a topic directly under the root has a bare path and the root as its only ancestor', async () => {
    serveHeretto(deepTenant(1));
    const { props } = renderExplorer();
    fireEvent.click(await screen.findByText('root-topic.dita'));
    expect(props.onOpenTopic).toHaveBeenCalledWith(expect.objectContaining({ path: 'root-topic.dita', ancestorUuids: ['root'] }));
  });

  it('highlights the active tab\'s Heretto file in the tree', async () => {
    serveHeretto(deepTenant(3));
    renderExplorer();
    fireEvent.click(await screen.findByText('Level 1'));
    fireEvent.click(await screen.findByText('Level 2'));
    fireEvent.click(await screen.findByText('Level 3'));
    const row = await screen.findByTestId('tree-f3');
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tree-f2')).not.toHaveAttribute('aria-selected');
  });

  it('keyboard: ArrowRight expands, ArrowLeft collapses, Enter opens', async () => {
    serveHeretto(deepTenant(2));
    const { props } = renderExplorer();
    const l1 = await screen.findByText('Level 1');
    const row = l1.closest('[role="treeitem"]')!;
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    await screen.findByText('Level 2');
    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    expect(screen.queryByText('Level 2')).toBeNull();
    fireEvent.keyDown(screen.getByText('root-topic.dita').closest('[role="treeitem"]')!, { key: 'Enter' });
    expect(props.onOpenTopic).toHaveBeenCalledTimes(1);
  });

  it('disconnected: no listing is requested and the tree says so', async () => {
    serveHeretto(deepTenant(1));
    renderExplorer({ herettoConnected: false });
    await waitFor(() => expect(screen.getByText(/Connect to Heretto to browse/)).toBeInTheDocument());
    expect(listings()).toEqual([]);
  });
});

describe('Open Editors', () => {
  it('lists every tab with its dirty dot or review badge; click activates, × closes', async () => {
    serveHeretto(deepTenant(1));
    const { props } = renderExplorer();
    await screen.findByText('root-topic.dita');                 // let the root listing settle
    const section = screen.getByTestId('open-editors');
    expect(within(section).getByText('topic-3.dita')).toBeInTheDocument();
    expect(within(section).getByText('draft.dita')).toBeInTheDocument();
    expect(within(section).getAllByTestId('open-editor-review-badge').length).toBe(1);
    expect(within(section).getByTitle('Unsaved changes')).toBeInTheDocument();     // t2: dirty, no review
    fireEvent.click(within(section).getByText('draft.dita'));
    expect(props.onActivateTab).toHaveBeenCalledWith('t2');
    fireEvent.click(within(section).getByRole('button', { name: 'Close draft.dita' }));
    expect(props.onCloseTab).toHaveBeenCalledWith('t2');
    expect(screen.getByTestId('open-editor-t1')).toHaveAttribute('aria-current', 'true');
  });
});

describe('W4 — the `…` menu reaches every retired-dropdown command', () => {
  it('runs each command and closes', async () => {
    serveHeretto(deepTenant(1));
    const { cmds } = renderExplorer();
    const labels: [RegExp, string][] = [
      [/^New Topic/, 'onNewTopic'], [/^Open Local File/, 'onOpenLocalFile'], [/^Open from Heretto/, 'onOpenFromHeretto'],
      [/^Save to Heretto/, 'onSaveToHeretto'], [/^Save Local Copy/, 'onSaveLocalCopy'], [/^Replace in Heretto/, 'onReplace'],
      [/^Export as PDF/, 'onExportPdf'], [/^Convert Topic Type/, 'onConvertTopicType'], [/^Connect a Map/, 'onConnectMap'],
      [/^Keyboard Shortcuts/, 'onKeyboardShortcuts'],
    ];
    for (const [label, name] of labels) {
      fireEvent.click(screen.getByTestId('explorer-menu-button'));
      const menu = await screen.findByRole('menu', { name: 'Explorer actions' });
      fireEvent.click(within(menu).getByRole('menuitem', { name: label }));
      expect(cmds.calls.at(-1)).toBe(name);
      expect(screen.queryByRole('menu', { name: 'Explorer actions' })).toBeNull();
    }
    expect(cmds.calls.length).toBe(labels.length);
  });

  it('with a map connected: the Connect label changes and Reload Map / Disconnect <map> appear (review finding 1, W4)', async () => {
    serveHeretto(deepTenant(1));
    const cmds = { ...commands(), connectedMapName: 'User Guide' };
    renderExplorer({ commands: cmds });
    fireEvent.click(screen.getByTestId('explorer-menu-button'));
    let menu = await screen.findByRole('menu', { name: 'Explorer actions' });
    expect(within(menu).getByRole('menuitem', { name: /^Connect a different map/ })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Reload Map/ }));
    expect(cmds.calls.at(-1)).toBe('onReloadMap');
    fireEvent.click(screen.getByTestId('explorer-menu-button'));
    menu = await screen.findByRole('menu', { name: 'Explorer actions' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Disconnect User Guide/ }));
    expect(cmds.calls.at(-1)).toBe('onDisconnectMap');
  });

  it('without a map the two map rows are absent', async () => {
    serveHeretto(deepTenant(1));
    renderExplorer();
    fireEvent.click(screen.getByTestId('explorer-menu-button'));
    const menu = await screen.findByRole('menu', { name: 'Explorer actions' });
    expect(within(menu).queryByRole('menuitem', { name: /^Reload Map/ })).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: /^Disconnect/ })).toBeNull();
  });

  it('the Heretto-only commands are disabled while disconnected', async () => {
    serveHeretto(deepTenant(1));
    renderExplorer({ herettoConnected: false });
    fireEvent.click(screen.getByTestId('explorer-menu-button'));
    const menu = await screen.findByRole('menu', { name: 'Explorer actions' });
    for (const l of [/^Open from Heretto/, /^Save to Heretto/, /^Replace in Heretto/, /^Connect a Map/]) {
      expect(within(menu).getByRole('menuitem', { name: l })).toBeDisabled();
    }
    expect(within(menu).getByRole('menuitem', { name: /^New Topic/ })).toBeEnabled();
  });
});

describe('ADR-013 amendment — "Search filenames in this folder" (the walk moved here from the dialog)', () => {
  it('runs the walk from the last folder expanded, debounced, and opens a result with its path from the content root', async () => {
    serveHeretto(deepTenant(3));
    const run = vi.fn();
    const result = { uuid: 'f3', name: 'topic-3.dita', type: 'file' as const, path: 'Level 3/topic-3.dita', ancestorUuids: ['d2', 'd3'] };
    const { props, rerender } = renderExplorer({ filenameSearch: { run, results: [], status: { phase: 'idle' }, abortRef: { current: null } } });
    const tree = within(screen.getByTestId('folder-tree'));
    fireEvent.click(await tree.findByText('Level 1'));
    fireEvent.click(await tree.findByText('Level 2'));
    await tree.findByText('Level 3');
    fireEvent.click(screen.getByTestId('explorer-filename-search'));
    const box = screen.getByRole('textbox', { name: 'Search filenames in Level 2' });
    fireEvent.change(box, { target: { value: 'topic' } });
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(run.mock.calls[0].slice(0, 2)).toEqual(['topic', 'd2']);
    rerender(<ExplorerView {...props} filenameSearch={{ run, results: [result], status: { phase: 'done', foldersVisited: 2, foldersFailed: 0 }, abortRef: { current: null } }} />);
    fireEvent.click(screen.getByTestId('filename-result-f3'));
    expect(props.onOpenTopic).toHaveBeenCalledWith({ ...result, path: 'Level 1/Level 2/Level 3/topic-3.dita', ancestorUuids: ['root', 'd1', 'd2', 'd3'] });
  });

  it('from the root the result opens as the walk reported it; Escape closes the box', async () => {
    serveHeretto(deepTenant(1));
    const run = vi.fn();
    const result = { uuid: 'f0', name: 'root-topic.dita', type: 'file' as const, path: 'root-topic.dita', ancestorUuids: ['root'] };
    const { props } = renderExplorer({ filenameSearch: { run, results: [result], status: { phase: 'done', foldersVisited: 1, foldersFailed: 0 }, abortRef: { current: null } } });
    await screen.findByText('Level 1');
    fireEvent.click(screen.getByTestId('explorer-filename-search'));
    const box = screen.getByRole('textbox', { name: /Search filenames in/ });
    fireEvent.change(box, { target: { value: 'root' } });
    await waitFor(() => expect(run).toHaveBeenCalledWith('root', 'root', expect.any(AbortSignal)), { timeout: 2000 });
    fireEvent.click(screen.getByTestId('filename-result-f0'));
    expect(props.onOpenTopic).toHaveBeenCalledWith(result);
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: /Search filenames in/ })).toBeNull();
    expect(screen.getByTestId('folder-tree')).toBeInTheDocument();
  });
});
