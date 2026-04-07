import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global error handler to catch issues before React mounts (like import errors)
window.addEventListener('error', (event) => {
    const root = document.getElementById('root');
    if (root && (!root.innerHTML || root.innerHTML === '')) {
        root.innerHTML = `
            <div style="color: #ef4444; padding: 20px; font-family: monospace; background: #1f2937; height: 100vh;">
                <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Application Failed to Start</h1>
                <p><strong>Error:</strong> ${event.message}</p>
                ${event.filename ? `<p><strong>File:</strong> ${event.filename}:${event.lineno}</p>` : ''}
            </div>
        `;
    }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Could not find root element to mount to");
  throw new Error("Could not find root element to mount to");
}

console.log("Mounting React App...");

try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
} catch (e) {
    console.error("React Mount Error:", e);
    rootElement.innerHTML = `<div style="color:red; padding:20px;">Mount Error: ${e.message}</div>`;
}