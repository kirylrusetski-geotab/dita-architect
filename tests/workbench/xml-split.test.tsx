// @vitest-environment jsdom
//
// ADR-017 W7 — the XML split keeps today's pane behaviour: its toolbar
// (syntax theme, word wrap, Format, close), one Monaco editor per tab, the
// ReviewBar + DiffViewer when a review is pending (ADR-008), and — the point
// of W7 — a closed split hides the column without unmounting a single editor,
// so a reopen is the same Monaco instance (cursor, scroll, undo stack intact).
// Replaces the v0.8-era source-grep test for the Format button.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createTab, type Tab } from '../../types/tab';

const monacoMounts: string[] = [];
const monacoUnmounts: string[] = [];

vi.mock('../../components/MonacoDitaEditor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/MonacoDitaEditor')>();
  const MonacoDitaEditor = ({ value }: { value: string }) => {
    React.useEffect(() => {
      monacoMounts.push(value);
      return () => { monacoUnmounts.push(value); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <div data-testid="monaco">{value}</div>;
  };
  return { ...actual, MonacoDitaEditor };
});
vi.mock('../../components/DiffViewer', () => ({
  DiffViewer: ({ originalContent, modifiedContent }: { originalContent: string; modifiedContent: string }) => (
    <div data-testid="diff">{originalContent} → {modifiedContent}</div>
  ),
}));

import { XmlSplit } from '../../components/workbench/XmlSplit';

function renderSplit(overrides: Partial<React.ComponentProps<typeof XmlSplit>> = {}, tabs?: Tab[]) {
  const ts = tabs ?? [createTab('<concept id="a"><title>A</title><conbody/></concept>')];
  const props: React.ComponentProps<typeof XmlSplit> = {
    open: true,
    sizePct: 50,
    containerRef: { current: null },
    onResize: vi.fn(),
    onClose: vi.fn(),
    tabs: ts,
    activeTabId: ts[0].id,
    activeTab: ts[0],
    updateTab: vi.fn(),
    appTheme: 'dark',
    syntaxTheme: 'material',
    onSyntaxThemeChange: vi.fn(),
    wordWrapEnabled: false,
    onToggleWordWrap: vi.fn(),
    currentTopicType: 'concept',
    onFormat: vi.fn(),
    onReviewAccept: vi.fn(),
    onReviewReject: vi.fn(),
    ...overrides,
  };
  const utils = render(<XmlSplit {...props} />);
  return { ...utils, props, rerenderWith: (next: Partial<typeof props>) => utils.rerender(<XmlSplit {...props} {...next} />) };
}

beforeEach(() => { monacoMounts.length = 0; monacoUnmounts.length = 0; });

describe('the toolbar', () => {
  it('Format XML calls onFormat and is labelled for assistive tech, with the shortcut in its tooltip', () => {
    const { props } = renderSplit();
    const btn = screen.getByRole('button', { name: 'Format XML' });
    fireEvent.click(btn);
    expect(props.onFormat).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Format XML (Shift+Alt+F)')).toBeInTheDocument();
  });

  it('the close control closes the split (one of W7\'s four gestures)', () => {
    const { props } = renderSplit();
    fireEvent.click(screen.getByRole('button', { name: 'Close XML' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('word wrap toggles through its handler and reports its pressed state', () => {
    const { props } = renderSplit({ wordWrapEnabled: true });
    const btn = screen.getByRole('button', { name: 'Toggle word wrap' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(props.onToggleWordWrap).toHaveBeenCalledTimes(1);
  });

  it('the syntax-theme menu lists every option and selects through onSyntaxThemeChange', async () => {
    const { props } = renderSplit();
    fireEvent.click(screen.getByRole('button', { name: /Select syntax theme/ }));
    const menu = await screen.findByRole('menu', { name: 'Syntax theme' });
    const items = menu.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(7);
    fireEvent.click(screen.getByRole('menuitem', { name: /Dracula/ }));
    expect(props.onSyntaxThemeChange).toHaveBeenCalledWith('dracula');
    expect(screen.queryByRole('menu', { name: 'Syntax theme' })).toBeNull();
  });

  it('shows the topic-type badge and the footer status', () => {
    renderSplit();
    expect(screen.getByText('concept')).toBeInTheDocument();
    expect(screen.getByText('Valid XML')).toBeInTheDocument();
    expect(screen.getByText('DITA 1.3')).toBeInTheDocument();
  });
});

describe('W7 — closing hides, never unmounts', () => {
  it('a closed split keeps every Monaco editor mounted and a reopen remounts nothing', () => {
    const tabs = [createTab('<a/>'), createTab('<b/>')];
    const { rerenderWith } = renderSplit({}, tabs);
    expect(monacoMounts).toEqual(['<a/>', '<b/>']);
    const column = screen.getByTestId('xml-split');
    expect(column.style.display).toBe('flex');

    rerenderWith({ open: false });
    expect(screen.getByTestId('xml-split').style.display).toBe('none');
    expect(screen.getByTestId('xml-split')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByTestId('xml-split-handle')).toBeNull();
    expect(monacoUnmounts).toEqual([]);
    expect(screen.getAllByTestId('monaco').length).toBe(2);

    rerenderWith({ open: true });
    expect(monacoMounts).toEqual(['<a/>', '<b/>']);    // no second mount
    expect(monacoUnmounts).toEqual([]);
    expect(screen.getByTestId('xml-split').style.display).toBe('flex');
    expect(screen.getByTestId('xml-split-handle')).toBeInTheDocument();
  });

  it('the split takes its persisted share of the container (clamped to 20–85 %)', () => {
    const { rerenderWith } = renderSplit({ sizePct: 62 });
    expect(screen.getByTestId('xml-split').style.flex).toBe('0 0 62%');
    rerenderWith({ sizePct: 99 });
    expect(screen.getByTestId('xml-split').style.flex).toBe('0 0 85%');
  });

  it('dragging the handle reports the share measured from the container\'s right edge', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ left: 100, right: 1100, width: 1000, top: 0, bottom: 800, height: 800, x: 100, y: 0, toJSON: () => ({}) });
    const { props } = renderSplit({ containerRef: { current: container } });
    fireEvent.mouseDown(screen.getByTestId('xml-split-handle'), { clientX: 600 });
    fireEvent.mouseMove(document, { clientX: 800 });
    expect(props.onResize).toHaveBeenLastCalledWith(30);     // (1100 - 800) / 1000
    fireEvent.mouseMove(document, { clientX: 1000 });
    expect(props.onResize).toHaveBeenLastCalledWith(10);     // below the minimum: the hook closes it
    fireEvent.mouseUp(document);
  });
});

describe('ADR-008 — a pending review swaps in the ReviewBar and the diff', () => {
  it('shows Accept / Reject and the diff instead of the editor for the reviewing tab', () => {
    const tab = createTab('<a/>');
    tab.pendingReview = { baseXml: '<a/>', proposedXml: '<a>new</a>', sourceLabel: 'AI draft' };
    const { props } = renderSplit({}, [tab]);
    expect(screen.getByTestId('diff')).toHaveTextContent('<a/> → <a>new</a>');
    expect(screen.queryByTestId('monaco')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Accept proposed change' }));
    expect(props.onReviewAccept).toHaveBeenCalledWith(tab.id);
    fireEvent.click(screen.getByRole('button', { name: 'Reject proposed change' }));
    expect(props.onReviewReject).toHaveBeenCalledWith(tab.id);
  });
});
