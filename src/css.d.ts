// CSS is not a TypeScript module: esbuild resolves these imports and bundles
// the stylesheet into main.css, so the import exists purely for its side
// effect. The empty declaration tells tsc the specifier is legal and carries
// no bindings worth naming.
declare module '*.css';
