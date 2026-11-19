// @vitest-environment jsdom
//
// ADR-018 decision 9 / FR-074 — the Settings modal. General's toggles write
// through onEditorChange; Restore defaults asks first; Appearance names the
// profile and opens the drawer; Heretto hosts the credentials form that the
// retired Heretto Status modal hosted (its behaviour re-targeted here: the four
// fields edit the credentials, Test and Save call their handlers, the state
// line says connected or not); Keyboard Shortcuts renders the cheat sheet.
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SettingsModal } from '../../components/SettingsModal';
import type { HerettoCredentials } from '../../components/HerettoCredentialsForm';
import { BUILT_IN_PROFILES } from '../../lib/appearance';
import { SETTINGS_PAGES, type SettingsPage, type EditorSettings } from '../../lib/settings';
import { KEYBOARD_SHORTCUTS } from '../../constants/keyboard-shortcuts';

function setup(over: { page?: SettingsPage; connected?: boolean; checking?: boolean } = {}) {
  const calls = {
    onEditorChange: vi.fn(), onRestoreDefaults: vi.fn(), onOpenAppearance: vi.fn(), onClose: vi.fn(),
    onTest: vi.fn(), onSave: vi.fn(), onOpenReleaseNotes: vi.fn(),
  };
  let creds: HerettoCredentials = { host: 'example.heretto.com', rootUuid: 'root-1', email: 'writer@example.com', token: '' };
  const Harness = () => {
    const [page, setPage] = useState<SettingsPage>(over.page ?? 'general');
    const [editor, setEditor] = useState<EditorSettings>({ wordWrap: true, openXmlTrayOnLoad: false, showSyncHint: false });
    const [c, setC] = useState(creds);
    creds = c;
    return (
      <SettingsModal
        page={page}
        onPageChange={setPage}
        onClose={calls.onClose}
        editor={editor}
        onEditorChange={patch => { calls.onEditorChange(patch); setEditor(e => ({ ...e, ...patch })); }}
        onRestoreDefaults={calls.onRestoreDefaults}
        profile={{ ...BUILT_IN_PROFILES[3] }}
        onOpenAppearance={calls.onOpenAppearance}
        heretto={{ connected: over.connected ?? true, checking: over.checking ?? false, credentials: c, setCredentials: setC, onTest: calls.onTest, onSave: calls.onSave }}
        version="1.3.0"
        onOpenReleaseNotes={calls.onOpenReleaseNotes}
      />
    );
  };
  render(<Harness />);
  return { calls, creds: () => creds };
}

describe('the Settings modal', () => {
  it('is a modal dialog with the five pages as tabs, in order; clicking one shows it', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toHaveAttribute('aria-modal', 'true');
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(SETTINGS_PAGES.map(p => p.label));
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(tabs[4]);
    expect(screen.getByRole('tabpanel', { name: 'About' })).toHaveTextContent('DITA Architect 1.3.0');
  });

  it('General: each switch shows the stored value and writes only its own field', () => {
    const { calls } = setup();
    const open = screen.getByRole('switch', { name: 'Open the XML split when a topic opens' });
    const wrap = screen.getByRole('switch', { name: 'Wrap long lines in the XML' });
    const hint = screen.getByRole('switch', { name: 'Show the sync hint' });
    expect([open, wrap, hint].map(s => s.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    fireEvent.click(open);
    expect(calls.onEditorChange).toHaveBeenLastCalledWith({ openXmlTrayOnLoad: true });
    expect(open).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(wrap);
    expect(calls.onEditorChange).toHaveBeenLastCalledWith({ wordWrap: false });
    fireEvent.click(hint);
    expect(calls.onEditorChange).toHaveBeenLastCalledWith({ showSyncHint: true });
  });

  it('General: Restore defaults asks first; Cancel does nothing, Restore restores', () => {
    const { calls } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(calls.onRestoreDefaults).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(calls.onRestoreDefaults).toHaveBeenCalledTimes(1);
  });

  it('Appearance: names the active profile and opens the drawer', () => {
    const { calls } = setup({ page: 'appearance' });
    const panel = screen.getByRole('tabpanel', { name: 'Appearance' });
    expect(panel).toHaveTextContent('Nord');
    expect(panel).toHaveTextContent('Built-in · Nord base · Material syntax');
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit appearance…' }));
    expect(calls.onOpenAppearance).toHaveBeenCalledTimes(1);
  });

  it('Heretto (from the retired status modal): the state line, Test, the four fields, Save credentials', () => {
    const { calls, creds } = setup({ page: 'heretto' });
    const panel = screen.getByRole('tabpanel', { name: 'Heretto' });
    expect(within(panel).getByRole('status')).toHaveTextContent('Connected to example.heretto.com');
    fireEvent.click(within(panel).getByRole('button', { name: 'Test' }));
    expect(calls.onTest).toHaveBeenCalledTimes(1);
    fireEvent.change(within(panel).getByLabelText('Heretto host'), { target: { value: 'other.heretto.com' } });
    fireEvent.change(within(panel).getByLabelText('Content root folder UUID'), { target: { value: 'root-2' } });
    fireEvent.change(within(panel).getByLabelText('Email'), { target: { value: 'me@example.com' } });
    fireEvent.change(within(panel).getByLabelText('API Token'), { target: { value: 'secret' } });
    expect(creds()).toEqual({ host: 'other.heretto.com', rootUuid: 'root-2', email: 'me@example.com', token: 'secret' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save credentials' }));
    expect(calls.onSave).toHaveBeenCalledTimes(1);
  });

  it('Heretto: not connected says so; while checking, Test and Save are disabled', () => {
    setup({ page: 'heretto', connected: false, checking: true });
    const panel = screen.getByRole('tabpanel', { name: 'Heretto' });
    expect(within(panel).getByRole('status')).toHaveTextContent('Not connected');
    expect(within(panel).getByRole('button', { name: 'Test' })).toBeDisabled();
    expect(within(panel).getByRole('button', { name: 'Save credentials' })).toBeDisabled();
  });

  it('Keyboard Shortcuts renders the cheat sheet\'s list (the same one ⌘/ opens)', () => {
    setup({ page: 'shortcuts' });
    const panel = screen.getByRole('tabpanel', { name: 'Keyboard Shortcuts' });
    for (const s of KEYBOARD_SHORTCUTS) expect(panel).toHaveTextContent(s.description);
  });

  it('About opens What\'s New; Escape and the close button close', () => {
    const { calls } = setup({ page: 'about' });
    fireEvent.click(screen.getByRole('button', { name: "What's New" }));
    expect(calls.onOpenReleaseNotes).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(calls.onClose).toHaveBeenCalledTimes(2);
  });
});
