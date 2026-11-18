import React from 'react';

export interface HerettoCredentials { host: string; rootUuid: string; email: string; token: string }

interface HerettoCredentialsFormProps {
  credentials: HerettoCredentials;
  setCredentials: React.Dispatch<React.SetStateAction<HerettoCredentials>>;
  /** Focus the host field on mount (the modal does; an embedded form may not want to). */
  autoFocus?: boolean;
}

const inputClass = 'w-full px-3 py-2 rounded-lg text-sm font-mono outline-none';
const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--app-surface-raised)',
  border: '1px solid var(--app-border-subtle)',
  color: 'var(--app-text-primary)',
};
const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = 'var(--editor-accent)'; };
const blur = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = 'var(--app-border-subtle)'; };

/**
 * ADR-017 decision 6: the four credential fields (host, content root, email,
 * token), split out of `HerettoStatusModal` so the status modal keeps hosting
 * them now and Session 3's Settings modal can host them later without a copy.
 */
export const HerettoCredentialsForm = ({ credentials, setCredentials, autoFocus = true }: HerettoCredentialsFormProps) => (
  <>
    <label htmlFor="heretto-host-input" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
      Heretto host
    </label>
    <input
      id="heretto-host-input"
      autoFocus={autoFocus}
      type="text"
      value={credentials.host}
      onChange={e => setCredentials(prev => ({ ...prev, host: e.target.value }))}
      className={`${inputClass} mb-4`}
      style={inputStyle}
      onFocus={focus}
      onBlur={blur}
      placeholder="yourcompany.heretto.com"
      spellCheck={false}
    />

    <label htmlFor="heretto-root-input" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
      Content root folder UUID
    </label>
    <input
      id="heretto-root-input"
      type="text"
      value={credentials.rootUuid}
      onChange={e => setCredentials(prev => ({ ...prev, rootUuid: e.target.value }))}
      className={`${inputClass} mb-1`}
      style={inputStyle}
      onFocus={focus}
      onBlur={blur}
      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      spellCheck={false}
    />
    <p className="text-[10px] mb-4" style={{ color: 'var(--app-text-muted)' }}>
      The folder the Explorer opens on. Its UUID is the <code>id</code> of your top-level content folder in Heretto&apos;s REST API.
    </p>

    <label htmlFor="heretto-email-input" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
      Email
    </label>
    <input
      id="heretto-email-input"
      type="text"
      value={credentials.email}
      onChange={e => setCredentials(prev => ({ ...prev, email: e.target.value }))}
      className={`${inputClass} mb-4`}
      style={inputStyle}
      onFocus={focus}
      onBlur={blur}
      placeholder="your.name@company.com"
    />

    <label htmlFor="heretto-token-input" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
      API Token
    </label>
    <input
      id="heretto-token-input"
      type="password"
      value={credentials.token}
      onChange={e => setCredentials(prev => ({ ...prev, token: e.target.value }))}
      className={`${inputClass} mb-1`}
      style={inputStyle}
      onFocus={focus}
      onBlur={blur}
      placeholder="Your Heretto API token"
    />
    <p className="text-[10px] mb-5" style={{ color: 'var(--app-text-muted)' }}>
      Stored locally in ~/heretto.json. Never sent to the browser.
    </p>
  </>
);
