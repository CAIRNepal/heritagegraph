// CSS side-effect imports — Next.js handles them at build time. TypeScript
// otherwise rejects `import 'pkg/dist/foo.css'`. This module declaration
// covers any CSS file path imported as a side effect.

declare module '*.css';
