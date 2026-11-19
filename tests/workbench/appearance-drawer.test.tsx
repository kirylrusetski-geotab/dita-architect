// @vitest-environment jsdom
//
// ADR-018 decision 9 / FR-073 — the Appearance drawer over the real hook: the
// app stays visible (no dimmed overlay), a click switches profiles and the
// change is on <html> at once, built-ins are read-only, Duplicate makes an
// editable copy, a colour edit applies live and a bad value is refused, the
// base and syntax theme change, Reset and Delete (with its confirm) fall back,
// and Import refuses an unknown variable by name (A4).
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { AppearanceDrawer } from '../../components/AppearanceDrawer';
import { useAppearance } from '../../hooks/useAppearance';
import { exportProfile, BUILT_IN_PROFILES } from '../../lib/appearance';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; }, clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null), removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  } as Storage;
}

const html = () => document.documentElement;

function Harness({ onClose }: { onClose: () => void }) {
  const appearance = useAppearance();
  return <AppearanceDrawer appearance={appearance} onClose={onClose} />;
}

function setup() {
  const onClose = vi.fn();
  render(<Harness onClose={onClose} />);
  return { onClose, dialog: screen.getByRole('dialog', { name: 'Appearance' }) };
}

/** A row of the profile list (the base <select> has options with the same names). */
const edited = (base: string) => option(new RegExp(`^${base} \\(edited\\)`));
const option = (name: string | RegExp) => within(screen.getByRole('listbox', { name: 'Profiles' })).getByRole('option', { name });

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), writable: true, configurable: true });
  html().removeAttribute('data-theme');
  html().removeAttribute('style');
});

describe('the Appearance drawer', () => {
  it('is modal but does not dim: a transparent overlay covers the whole window (title row included); the panel sits under the title row', () => {
    setup();
    const overlay = screen.getByTestId('modal-overlay');
    expect(overlay.className).not.toMatch(/bg-black|backdrop-blur/);
    expect(overlay.className).toMatch(/fixed inset-0/);
    expect(screen.getByRole('dialog', { name: 'Appearance' }).className).toMatch(/top-\[34px\]/);
    expect(screen.getByRole('dialog', { name: 'Appearance' })).toHaveAttribute('aria-modal', 'true');
  });

  it('lists the six built-ins under Defaults and none under Mine; Dark is in use', () => {
    setup();
    const list = screen.getByRole('listbox', { name: 'Profiles' });
    expect(within(list).getAllByRole('option').map(o => o.textContent)).toEqual(BUILT_IN_PROFILES.map(p => p.name));
    expect(option('Dark')).toHaveAttribute('aria-selected', 'true');
    expect(list).toHaveTextContent('None yet. Duplicate a profile to start one.');
  });

  it('clicking a profile switches the app to it at once', () => {
    setup();
    fireEvent.click(option('Solarized'));
    expect(html().getAttribute('data-theme')).toBe('solarized');
    expect(option('Solarized')).toHaveAttribute('aria-selected', 'true');
  });

  it('FR-082: a built-in\'s fields are editable (no lock), it has no name field, and Done closes at once when nothing changed', () => {
    const { onClose } = setup();
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.getByLabelText('Start from')).toBeEnabled();
    expect(screen.getByLabelText('XML syntax theme')).toBeEnabled();
    expect(screen.getByLabelText('Window background value')).not.toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: /Duplicate to edit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('save-draft-sheet')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Duplicate makes an editable copy, focuses its name, and a colour edit is live on <html>', async () => {
    setup();
    fireEvent.click(option('Light'));
    fireEvent.click(screen.getByRole('button', { name: /^Duplicate$/ }));
    expect(option('Light copy')).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus());
    const accentField = () => screen.getByLabelText('Accent (links, active tab) value');
    // The accent is in Editor canvas, closed by default; the filter opens it.
    fireEvent.change(screen.getByLabelText('Filter colours'), { target: { value: 'accent' } });
    fireEvent.change(accentField(), { target: { value: '#b45309' } });
    fireEvent.keyDown(accentField(), { key: 'Enter' });
    expect(html().style.getPropertyValue('--editor-accent')).toBe('#b45309');
    expect(screen.getByRole('button', { name: 'Reset to Light (1)' })).toBeEnabled();
  });

  it('a value that fails the check is marked and not applied', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Duplicate$/ }));
    const field = screen.getByLabelText('Window background value');
    fireEvent.change(field, { target: { value: 'url(https://example.com/x.png)' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(html().style.getPropertyValue('--app-bg')).toBe('');
  });

  it('the colour picker keeps an rgba value\'s alpha', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Duplicate$/ }));
    fireEvent.change(screen.getByLabelText('Filter colours'), { target: { value: 'task background' } });
    fireEvent.change(screen.getByLabelText('Task background colour'), { target: { value: '#ff0000' } });
    expect(html().style.getPropertyValue('--badge-task-bg')).toBe('rgba(255, 0, 0, 0.10)');
  });

  it('base and syntax theme change on a custom profile; a mismatch is explained', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Duplicate$/ }));
    fireEvent.change(screen.getByLabelText('Start from'), { target: { value: 'nord' } });
    expect(html().getAttribute('data-theme')).toBe('nord');
    fireEvent.change(screen.getByLabelText('XML syntax theme'), { target: { value: 'daylight' } });
    expect(screen.getByText(/Daylight is a light syntax theme on a dark base/)).toBeInTheDocument();
    expect(screen.getByLabelText('XML preview in Daylight')).toBeInTheDocument();
  });

  it('Delete asks first, then falls back to the base\'s built-in', () => {
    setup();
    fireEvent.click(option('Navy'));
    fireEvent.click(screen.getByRole('button', { name: /^Duplicate$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    const confirm = screen.getByRole('alertdialog', { name: 'Delete Navy copy' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(option('Navy copy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(within(screen.getByRole('listbox', { name: 'Profiles' })).queryByRole('option', { name: 'Navy copy' })).toBeNull();
    expect(option('Navy')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('status')).toHaveTextContent("Deleted Navy copy. You're on Navy.");
  });

  const importFile = async (name: string, text: string) => {
    const input = screen.getByTestId('appearance-import-input') as HTMLInputElement;
    const file = new File([text], name, { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
  };

  it('Import refuses an unknown variable by name and imports nothing (A4)', async () => {
    setup();
    await importFile('Altitude.json', JSON.stringify({ format: 'dita-architect-appearance', version: 1, name: 'Altitude', base: 'light', syntaxTheme: 'daylight', overrides: { '--editor-accent': '#ff0000', '--app-accent-red': '#db0000' } }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't import Altitude.json. Nothing was imported.");
    expect(alert).toHaveTextContent('--app-accent-red');
    expect(within(screen.getByRole('listbox', { name: 'Profiles' })).queryByRole('option', { name: 'Altitude' })).toBeNull();
  });

  it('Import of a good file adds the profile and switches to it', async () => {
    setup();
    const p = { ...BUILT_IN_PROFILES[1], id: 'x', name: 'Sepia', builtIn: false, overrides: { '--editor-page-bg': '#fffaf0' } };
    await importFile('Sepia.json', exportProfile(p));
    expect(await screen.findByRole('status')).toHaveTextContent('Imported Sepia from Sepia.json and switched to it.');
    expect(option('Sepia')).toHaveAttribute('aria-selected', 'true');
    expect(html().style.getPropertyValue('--editor-page-bg')).toBe('#fffaf0');
  });

  it('Done and Escape close', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Duplicate$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// FR-082 (v1.3.1): editing a built-in starts an unsaved draft; leaving asks.
// ---------------------------------------------------------------------------
describe('FR-082 — edit a built-in, then save it as your own', () => {
  const edit = (label: string, value: string) => {
    const f = screen.getByLabelText(`${label} value`);
    fireEvent.change(f, { target: { value } });
    fireEvent.keyDown(f, { key: 'Enter' });
  };
  const sheet = () => screen.queryByTestId('save-draft-sheet');
  const stored = () => JSON.parse(window.localStorage.getItem('dita-architect-settings') ?? '{"appearance":{"profiles":[]}}').appearance;

  it('the first edit on a built-in changes the app at once, lists "Light (edited)" with an unsaved marker, and stores nothing', () => {
    setup();
    fireEvent.click(option('Light'));
    fireEvent.change(screen.getByLabelText('Filter colours'), { target: { value: 'window background' } });
    edit('Window background', '#101010');
    expect(html().style.getPropertyValue('--app-bg')).toBe('#101010');
    expect(edited('Light')).toHaveAttribute('aria-selected', 'true');
    expect(within(edited('Light')).getByLabelText('unsaved')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved copy of Light');
    expect(stored().profiles).toEqual([]);
    expect(screen.getByLabelText('Name')).toHaveValue('Light (edited)');
  });

  it('Done with changes opens the prompt (name defaults to "<built-in> custom"); Cancel keeps the draft and the drawer', () => {
    const { onClose } = setup();
    fireEvent.click(option('Nord'));
    fireEvent.change(screen.getByLabelText('Start from'), { target: { value: 'navy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(sheet()).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Save your changes as a new profile?' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Name', { selector: '#save-draft-name' })).toHaveValue('Nord custom');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(sheet()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(edited('Nord')).toBeInTheDocument();
  });

  it('Save as new profile adds one custom profile, makes it active, and closes the drawer', () => {
    const { onClose } = setup();
    fireEvent.click(option('Light'));
    fireEvent.change(screen.getByLabelText('Filter colours'), { target: { value: 'window background' } });
    edit('Window background', '#101010');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.change(screen.getByLabelText('Name', { selector: '#save-draft-name' }), { target: { value: 'Night paper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as new profile' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stored().profiles.map((p: { name: string; overrides: object }) => [p.name, p.overrides])).toEqual([['Night paper', { '--app-bg': '#101010' }]]);
    expect(html().style.getPropertyValue('--app-bg')).toBe('#101010');
    expect(option('Night paper')).toHaveAttribute('aria-selected', 'true');
    expect(option('Light')).toBeInTheDocument();
  });

  it('Save is disabled for an empty name; Enter in the name field saves', () => {
    setup();
    fireEvent.click(option('Dark'));
    fireEvent.change(screen.getByLabelText('XML syntax theme'), { target: { value: 'dracula' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    const name = screen.getByLabelText('Name', { selector: '#save-draft-name' });
    fireEvent.change(name, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save as new profile' })).toBeDisabled();
    fireEvent.change(name, { target: { value: 'Dracula dark' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(stored().profiles[0]).toMatchObject({ name: 'Dracula dark', base: 'dark', syntaxTheme: 'dracula' });
  });

  it('Discard changes closes the drawer on the built-in, with no override left on <html> and nothing stored', () => {
    const { onClose } = setup();
    fireEvent.click(option('Solarized'));
    fireEvent.change(screen.getByLabelText('Filter colours'), { target: { value: 'accent' } });
    edit('Accent (links, active tab)', '#ff0000');
    expect(html().style.getPropertyValue('--editor-accent')).toBe('#ff0000');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(within(screen.getByTestId('save-draft-sheet')).getByRole('button', { name: 'Discard changes' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(html().style.getPropertyValue('--editor-accent')).toBe('');
    expect(html().getAttribute('data-theme')).toBe('solarized');
    expect(stored().profiles).toEqual([]);
  });

  it('Escape asks first (and cancels the question before closing); a second Escape with no draft left closes', () => {
    const { onClose } = setup();
    fireEvent.click(option('Claude'));
    fireEvent.change(screen.getByLabelText('XML syntax theme'), { target: { value: 'github' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(sheet()).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(sheet()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(edited('Claude')).toBeInTheDocument();
  });

  it('clicking another profile with a draft asks; Save then switches to the one clicked, Discard too', () => {
    setup();
    fireEvent.click(option('Light'));
    fireEvent.change(screen.getByLabelText('XML syntax theme'), { target: { value: 'monokai' } });
    fireEvent.click(option('Navy'));
    expect(sheet()).toBeInTheDocument();
    expect(edited('Light')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save as new profile' }));
    expect(option('Navy')).toHaveAttribute('aria-selected', 'true');
    expect(option('Light custom')).toBeInTheDocument();
    fireEvent.click(option('Dark'));
    fireEvent.change(screen.getByLabelText('XML syntax theme'), { target: { value: 'catppuccin' } });
    fireEvent.click(option('Claude'));
    fireEvent.click(within(screen.getByTestId('save-draft-sheet')).getByRole('button', { name: 'Discard changes' }));
    expect(option('Claude')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('option', { name: /Dark \(edited\)/ })).toBeNull();
  });

  it('Duplicate and Import ask too while a draft exists', async () => {
    setup();
    fireEvent.click(option('Light'));
    fireEvent.change(screen.getByLabelText('XML syntax theme'), { target: { value: 'monokai' } });
    fireEvent.click(screen.getByRole('button', { name: /^Duplicate$/ }));
    expect(sheet()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(stored().profiles).toEqual([]);
  });

  it('the footer of a draft offers Discard changes (not Delete); it drops the draft without asking', () => {
    setup();
    fireEvent.click(option('Light'));
    fireEvent.change(screen.getByLabelText('XML syntax theme'), { target: { value: 'monokai' } });
    expect(screen.queryByRole('button', { name: /^Delete$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Discard changes/ }));
    expect(sheet()).toBeNull();
    expect(option('Light')).toHaveAttribute('aria-selected', 'true');
  });

  it('closing the drawer by any other route (it unmounts) drops the draft, so none is stranded', () => {
    // The hook lives in the main component, which outlives the drawer (the gear's Settings… closes it).
    const Host = ({ showDrawer }: { showDrawer: boolean }) => {
      const appearance = useAppearance();
      return showDrawer ? <AppearanceDrawer appearance={appearance} onClose={() => {}} /> : <span data-testid="active">{appearance.active.name}</span>;
    };
    const { rerender } = render(<Host showDrawer />);
    fireEvent.click(option('Light'));
    fireEvent.change(screen.getByLabelText('XML syntax theme'), { target: { value: 'monokai' } });
    expect(html().style.length).toBe(0);
    expect(edited('Light')).toBeInTheDocument();
    rerender(<Host showDrawer={false} />);
    expect(screen.getByTestId('active')).toHaveTextContent('Light');
    expect(screen.getByTestId('active')).not.toHaveTextContent('edited');
    expect(html().getAttribute('data-theme')).toBe('light');
  });

  it('a custom profile still edits in place with no prompt (Duplicate path unchanged)', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Duplicate$/ }));
    fireEvent.change(screen.getByLabelText('XML syntax theme'), { target: { value: 'monokai' } });
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(sheet()).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stored().profiles[0].syntaxTheme).toBe('monokai');
  });
});
