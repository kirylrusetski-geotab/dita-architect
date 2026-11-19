// Vite's `?raw` suffix imports a file's text as a string (ADR-018: the theme
// base values are read from index.css itself, not from a copy).
declare module '*.css?raw' {
  const text: string;
  export default text;
}
