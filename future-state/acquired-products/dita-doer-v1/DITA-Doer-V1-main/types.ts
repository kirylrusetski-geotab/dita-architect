
// This file declares global types for libraries loaded via CDN in index.html

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    monaco: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    require: any;
  }
}

// This export is necessary to make this file a module.
export {};
