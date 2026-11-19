import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { applyProfile, resolveActiveProfile } from './lib/appearance';
import { loadSettings } from './lib/settings';

// Suppress benign ResizeObserver loop errors
// This is a common issue with Monaco Editor's automaticLayout: true in standard browser environments
window.addEventListener('error', (e) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.' || 
      e.message === 'ResizeObserver loop limit exceeded') {
    e.stopImmediatePropagation();
  }
});

// ADR-018 decision 3: apply the active appearance profile to <html> before the first
// render, so the app never flashes the default dark theme. This is also the one-time
// migration of the v1.2.0 settings keys (lib/settings.ts).
applyProfile(document.documentElement, resolveActiveProfile(loadSettings().appearance));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);