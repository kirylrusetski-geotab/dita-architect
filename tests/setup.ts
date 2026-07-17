import '@testing-library/jest-dom/vitest';

// Mock global variables injected at build time
(globalThis as Record<string, unknown>).__APP_VERSION__ = '0.8.9';

// jsdom doesn't implement Element.prototype.scrollTo (used by ReleaseNotesModal)
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

// Mock localStorage for jsdom environment
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => null,
    setItem: (key: string, value: string) => {},
    removeItem: (key: string) => {},
    clear: () => {},
  },
  writable: true
});
