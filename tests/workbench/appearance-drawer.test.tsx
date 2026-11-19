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

  it('a built-in is read-only: no name field, the selects and colour fields are locked, the footer offers Duplicate to edit', () => {
    setup();
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.getByLabelText('Start from')).toBeDisabled();
    expect(screen.getByLabelText('XML syntax theme')).toBeDisabled();
    expect(screen.getByLabelText('Window background value')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: /Duplicate to edit/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  });

  it('Duplicate makes an editable copy, focuses its name, and a colour edit is live on <html>', async () => {
    setup();
    fireEvent.click(option('Light'));
    fireEvent.click(screen.getByRole('button', { name: /Duplicate to edit/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /Duplicate to edit/ }));
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
