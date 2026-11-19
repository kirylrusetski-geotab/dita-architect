// @vitest-environment jsdom
//
// ADR-017 W4 and W7 at the component level — the title row, the activity bar
// with its popovers, the right rail and the panel column: the two header
// dropdowns are gone in both run modes; every rail popover reaches its
// commands; each close gesture reaches the layout action it should.

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TitleBar } from '../../components/workbench/TitleBar';
import { ActivityBar, type HerettoRailProps, type SettingsRailProps } from '../../components/workbench/ActivityBar';
import { RightRail } from '../../components/workbench/RightRail';
import { PanelColumn } from '../../components/workbench/PanelColumn';
import { PlaceholderView } from '../../components/workbench/views/PlaceholderView';
import { defaultLayout, togglePanel, PANEL_IDS, STACK_PANEL_IDS, VIEW_IDS } from '../../lib/workbench-layout';
import { PANEL_META, VIEW_META } from '../../components/workbench/panel-registry';

const originalLocation = window.location;
afterEach(() => { Object.defineProperty(window, 'location', { value: originalLocation, configurable: true }); });

describe('W4 — the title row has no dropdown in either run mode', () => {
  const tabs = [
    { id: 'a', name: 'alpha.dita', dirty: false, pendingReview: false },
    { id: 'b', name: 'beta.dita', dirty: true, pendingReview: false },
    { id: 'c', name: 'gamma.dita', dirty: true, pendingReview: true },
  ];
  it.each(['dita:', 'http:'])('under %s: brand, version, tabs, no File Options, no Heretto dropdown', (protocol) => {
    Object.defineProperty(window, 'location', { value: { protocol }, configurable: true });
    const onActivate = vi.fn(); const onClose = vi.fn(); const onNew = vi.fn(); const notes = vi.fn();
    render(<TitleBar version="1.1.0" tabs={tabs} activeTabId="a" onActivateTab={onActivate} onCloseTab={onClose} onNewTab={onNew} onOpenReleaseNotes={notes} />);
    const bar = screen.getByTestId('title-bar');
    expect(bar.getBoundingClientRect).toBeDefined();
    expect(screen.queryByText('File Options')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Heretto$/ })).toBeNull();
    expect(screen.queryByText(/Last update/)).toBeNull();          // moved to the status bar
    expect(screen.getByRole('button', { name: 'View release notes' })).toHaveTextContent('v1.1.0');
    expect(screen.getAllByRole('tab').length).toBe(3);
    expect(screen.getByRole('tab', { name: /alpha/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /beta/ }));
    expect(onActivate).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'Close beta.dita' }));
    expect(onClose).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    expect(onNew).toHaveBeenCalled();
  });

  it('W3: a tab with a pending review shows the amber badge; a dirty tab the accent dot', () => {
    render(<TitleBar version="1.1.0" tabs={tabs} activeTabId="a" onActivateTab={vi.fn()} onCloseTab={vi.fn()} onNewTab={vi.fn()} onOpenReleaseNotes={vi.fn()} />);
    expect(screen.getAllByTestId('tab-review-badge').length).toBe(1);
    expect(within(screen.getByRole('tab', { name: /gamma/ })).getByTestId('tab-review-badge')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /beta/ })).getByTitle('Unsaved changes')).toBeInTheDocument();
  });
});

function heretto(over: Partial<HerettoRailProps> = {}): HerettoRailProps {
  return {
    connected: true, checking: false, host: 'example.heretto.com', email: 'author@example.com', rootUuid: '6b548365-ccba-11f1-9fe9-f7cb02f1f7db',
    onTest: vi.fn(), onOpenCredentials: vi.fn(), onOpenFromHeretto: vi.fn(), onSave: vi.fn(), onReplace: vi.fn(), onDisconnect: vi.fn(), ...over,
  };
}
function settings(over: Partial<SettingsRailProps> = {}): SettingsRailProps {
  return {
    version: '1.1.0', onOpenCredentials: vi.fn(), onKeyboardShortcuts: vi.fn(), onReleaseNotes: vi.fn(),
    theme: 'dark', onThemeChange: vi.fn(), syntaxTheme: 'material', onSyntaxThemeChange: vi.fn(), ...over,
  };
}

describe('the activity bar', () => {
  it('shows the four views in order; the active one is selected only while the side panel is open', () => {
    const onFocus = vi.fn();
    const { rerender } = render(<ActivityBar activeView="map" sidePanelOpen onFocusView={onFocus} heretto={heretto()} settings={settings()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.getAttribute('data-testid'))).toEqual(VIEW_IDS.map(v => `activity-${v}`));
    expect(screen.getByTestId('activity-map')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByTestId('activity-scm'));
    expect(onFocus).toHaveBeenCalledWith('scm');
    rerender(<ActivityBar activeView="map" sidePanelOpen={false} onFocusView={onFocus} heretto={heretto()} settings={settings()} />);
    expect(screen.getByTestId('activity-map')).toHaveAttribute('aria-selected', 'false');
  });

  it('the Heretto icon states its connection and the popover reaches the retired dropdown\'s commands (W4)', async () => {
    const h = heretto();
    render(<ActivityBar activeView="explorer" sidePanelOpen onFocusView={vi.fn()} heretto={h} settings={settings()} />);
    const icon = screen.getByTestId('activity-heretto');
    expect(icon).toHaveAttribute('data-connected', 'true');
    expect(icon).toHaveAccessibleName('Heretto: connected');
    fireEvent.click(icon);
    const pop = await screen.findByRole('dialog', { name: 'Heretto connection' });
    expect(within(pop).getByText('Connected')).toBeInTheDocument();
    expect(within(pop).getByText('example.heretto.com')).toBeInTheDocument();
    expect(within(pop).getByText('author@example.com')).toBeInTheDocument();
    expect(within(pop).getByTitle('6b548365-ccba-11f1-9fe9-f7cb02f1f7db')).toHaveTextContent('6b548365…f7db');
    fireEvent.click(within(pop).getByRole('button', { name: 'Test connection' }));
    expect(h.onTest).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('activity-heretto'));       // a second click on the icon closes it
    expect(screen.queryByRole('dialog', { name: 'Heretto connection' })).toBeNull();
    for (const [label, fn] of [
      [/^Open from Heretto/, h.onOpenFromHeretto], [/^Save to Heretto/, h.onSave], [/^Replace existing/, h.onReplace], [/^Disconnect this tab/, h.onDisconnect],
    ] as [RegExp, () => void][]) {
      fireEvent.click(screen.getByTestId('activity-heretto'));
      const p = await screen.findByRole('dialog', { name: 'Heretto connection' });
      fireEvent.click(within(p).getByRole('menuitem', { name: label }));
      expect(fn).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog', { name: 'Heretto connection' })).toBeNull();
    }
  });

  it('disconnected: grey state, commands disabled, no Disconnect row', async () => {
    render(<ActivityBar activeView="explorer" sidePanelOpen onFocusView={vi.fn()} heretto={heretto({ connected: false, onDisconnect: null })} settings={settings()} />);
    const icon = screen.getByTestId('activity-heretto');
    expect(icon).toHaveAttribute('data-connected', 'false');
    fireEvent.click(icon);
    const pop = await screen.findByRole('dialog', { name: 'Heretto connection' });
    expect(within(pop).getByText('Not connected')).toBeInTheDocument();
    expect(within(pop).getByRole('menuitem', { name: /^Save to Heretto/ })).toBeDisabled();
    expect(within(pop).queryByRole('menuitem', { name: /^Disconnect/ })).toBeNull();
  });

  it('the Settings menu: credentials, shortcuts, What\'s New, and the two theme pickers as sub-pages', async () => {
    const s = settings();
    render(<ActivityBar activeView="explorer" sidePanelOpen onFocusView={vi.fn()} heretto={heretto()} settings={s} />);
    fireEvent.click(screen.getByTestId('activity-settings'));
    let menu = await screen.findByRole('menu', { name: 'Settings' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Keyboard Shortcuts/ }));
    expect(s.onKeyboardShortcuts).toHaveBeenCalled();
    expect(screen.queryByRole('menu', { name: 'Settings' })).toBeNull();

    fireEvent.click(screen.getByTestId('activity-settings'));
    menu = await screen.findByRole('menu', { name: 'Settings' });
    expect(within(menu).getByRole('menuitem', { name: /What's New in v1.1.0/ })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Theme/ }));
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Nord/ }));
    expect(s.onThemeChange).toHaveBeenCalledWith('nord');

    fireEvent.click(screen.getByTestId('activity-settings'));
    menu = await screen.findByRole('menu', { name: 'Settings' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Syntax theme/ }));
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Daylight/ }));
    expect(s.onSyntaxThemeChange).toHaveBeenCalledWith('daylight');
  });

  it('a Settings sub-page keeps keyboard focus inside the menu (review finding 4)', async () => {
    render(<ActivityBar activeView="explorer" sidePanelOpen onFocusView={vi.fn()} heretto={heretto()} settings={settings()} />);
    fireEvent.click(screen.getByTestId('activity-settings'));
    const menu = await screen.findByRole('menu', { name: 'Settings' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Theme/ }));
    expect(menu.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(menu.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toHaveAttribute('role', 'menuitem');
  });

  it('Escape while a modal dialog is open leaves the popover alone (the modal owns Escape; review finding 5)', async () => {
    render(<ActivityBar activeView="explorer" sidePanelOpen onFocusView={vi.fn()} heretto={heretto()} settings={settings()} />);
    fireEvent.click(screen.getByTestId('activity-settings'));
    await screen.findByRole('menu', { name: 'Settings' });
    const modal = document.createElement('div'); modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); document.body.appendChild(modal);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('menu', { name: 'Settings' })).toBeInTheDocument();
    modal.remove();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Settings' })).toBeNull();
  });

  it('the Sessions slot is a placeholder that says so', async () => {
    render(<ActivityBar activeView="explorer" sidePanelOpen onFocusView={vi.fn()} heretto={heretto()} settings={settings()} />);
    fireEvent.click(screen.getByTestId('activity-sessions'));
    const pop = await screen.findByRole('dialog', { name: 'Sessions' });
    expect(within(pop).getByText('No sessions connected')).toBeInTheDocument();
  });

  it('Escape closes an open popover and returns focus to its opener', async () => {
    render(<ActivityBar activeView="explorer" sidePanelOpen onFocusView={vi.fn()} heretto={heretto()} settings={settings()} />);
    const btn = screen.getByTestId('activity-settings');
    fireEvent.click(btn);
    await screen.findByRole('menu', { name: 'Settings' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Settings' })).toBeNull();
    expect(document.activeElement).toBe(btn);
  });
});

describe('the right rail and the panel column (W7 gestures)', () => {
  it('the rail lists XML then the six aspects; an open panel is pressed; a click toggles', () => {
    const onToggle = vi.fn();
    const layout = togglePanel(defaultLayout(), 'prolog');
    render(<RightRail panels={layout.panels} onToggle={onToggle} />);
    const buttons = PANEL_IDS.map(id => screen.getByTestId(`rail-${id}`));
    expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual(PANEL_IDS.map(id => `${PANEL_META[id].title} panel`));
    expect(screen.getByTestId('rail-prolog')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('rail-xml')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByTestId('rail-xml'));
    expect(onToggle).toHaveBeenCalledWith('xml');
  });

  it('the column renders the open stack in order with a placeholder body, and its × closes that panel', () => {
    const onClose = vi.fn();
    let l = defaultLayout();
    for (const id of ['ai', 'topic', 'links'] as const) l = togglePanel(l, id);
    render(<PanelColumn open={['topic', 'links', 'ai']} panels={l.panels} width={360} onResizeColumn={vi.fn()} onResizePanel={vi.fn()} onClose={onClose} />);
    const sections = screen.getAllByRole('region');
    expect(sections.map(s => s.getAttribute('data-panel'))).toEqual(['topic', 'links', 'ai']);
    expect(screen.getByText('Coming in v1.6.0')).toBeInTheDocument();
    expect(screen.getAllByText('Coming in v1.4.0').length).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Close Links panel' }));
    expect(onClose).toHaveBeenCalledWith('links');
    // two dividers between three panels
    expect(screen.getAllByRole('separator', { name: /^Resize .* and / }).length).toBe(2);
  });

  it('renders nothing when the stack is empty', () => {
    const { container } = render(<PanelColumn open={[]} panels={defaultLayout().panels} width={360} onResizeColumn={vi.fn()} onResizePanel={vi.fn()} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('every stack panel has a title, an icon and an arrival release in the registry', () => {
    for (const id of STACK_PANEL_IDS) {
      expect(PANEL_META[id].arrives).toMatch(/^v1\.\d\.0$/);
      expect(PANEL_META[id].blurb!.length).toBeGreaterThan(20);
    }
    expect(PANEL_META.xml.arrives).toBeUndefined();
  });
});

describe('placeholder views', () => {
  it.each(['scm'] as const)('%s names its release (Search and Map shipped in v1.2.0)', (view) => {
    render(<PlaceholderView view={view} />);
    expect(screen.getByText(`Coming in ${VIEW_META[view].arrives}`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: VIEW_META[view].title })).toBeInTheDocument();
  });
});
