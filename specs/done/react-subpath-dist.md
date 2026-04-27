# Compile `react/` subpath for dist publishing

## Problem

Dist builds (`dist` branch / GH tarball consumed via `#<sha>` in `package.json`)
ship the `src/` core as compiled `index.js` + `*.d.ts`, but the `react/`
subpath is shipped as raw `.ts` / `.tsx` source:

```json
// dist-branch package.json
"exports": {
  ".": { "types": "./index.d.ts", "import": "./index.js" },
  "./react": "./react/index.ts"
}
```

Consumers with strict `tsconfig.json` (`noUnusedLocals`,
`noUnusedParameters`, `skipLibCheck: true`) inherit type-check errors from
the raw sources when their `tsc` follows the import into `geo-sankey/react/*`.
`skipLibCheck` does **not** help here — it only skips `.d.ts`, not `.ts` /
`.tsx`.

Example failures observed downstream (hbt, on dist commit `2ddd8a6`):

```
node_modules/.pnpm/geo-sankey@…/node_modules/geo-sankey/react/components/NodeOverlay.tsx(22,7): error TS6133: 'HANDLE_MIN_PX' is declared but its value is never read.
node_modules/.pnpm/geo-sankey@…/node_modules/geo-sankey/react/components/SelectionSection.tsx(75,10): error TS6133: 'selections' is declared but its value is never read.
node_modules/.pnpm/geo-sankey@…/node_modules/geo-sankey/react/hooks/useGraphMutations.ts(2,1): error TS6133: 'FlowGraph' is declared but its value is never read.
node_modules/.pnpm/geo-sankey@…/node_modules/geo-sankey/react/hooks/useGraphMutations.ts(4,34): error TS6196: 'SelectionRef' is declared but never used.
node_modules/.pnpm/geo-sankey@…/node_modules/geo-sankey/react/hooks/useMapInteraction.ts(2,34): error TS6196: 'SelectionRef' is declared but never used.
node_modules/.pnpm/geo-sankey@…/node_modules/geo-sankey/react/hooks/useNodeDrag.ts(2,1): error TS6133: 'FlowGraph' is declared but its value is never read.
```

Even after cleaning those up, any future unused local in `react/**` will
break every downstream `tsc` that inherits the strict flags.

## Fix

Publish `react/` the same way `src/` is already published: compiled `.js`
bundle + emitted `.d.ts`, with `package.json#exports["./react"]` pointing
at the compiled artifacts.

### 1. Vite: multi-entry library build

Extend `vite.config.ts` to emit both entries. Vite's `lib.entry` accepts an
object for multi-entry builds (produces per-entry bundles):

```ts
export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'react/index': resolve(__dirname, 'react/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      // Keep react / use-kbd external so the consumer's copy is used.
      external: ['react', 'react/jsx-runtime', 'use-kbd'],
    },
  },
  plugins: [
    dts({
      compilerOptions: { noEmitOnError: false, strict: false, strictNullChecks: false },
      // Emit declarations for both entries
      include: ['src/**/*.ts', 'react/**/*.ts', 'react/**/*.tsx'],
    }),
  ],
})
```

After build, `dist/` contains:
- `index.js`, `index.d.ts` (core)
- `react/index.js`, `react/index.d.ts` (React hooks + components)

The existing `build` script (`vite build && cp -r react dist/react`) should
drop the `cp -r` — `vite build` now emits `react/` into `dist/`.

### 2. Dist workflow: extend the `exports_map`

In `.github/workflows/ci.yml`, the `build-dist` job passes a single entry:

```yaml
exports_map: '{"./src/index.ts": {"types": "./index.d.ts", "import": "./index.js"}}'
```

Add a second entry for the `react/` subpath:

```yaml
exports_map: |
  {
    "./src/index.ts":   {"types": "./index.d.ts",       "import": "./index.js"},
    "./react/index.ts": {"types": "./react/index.d.ts", "import": "./react/index.js"}
  }
```

(Check `runsascoded/npm-dist`'s `build-dist.yml` to confirm the `exports_map`
format supports multiple entries; if not, this is a second change there.)

### 3. Interim: clean up unused imports/locals in `react/**`

Independent of the build changes, strip unused locals/imports today so
current downstream `tsc` runs can at least typecheck (and so the problem
can't silently regress even after the build fix, if a file is accidentally
shipped as `.ts` again):

- `react/components/NodeOverlay.tsx`: remove `HANDLE_MIN_PX`
- `react/components/SelectionSection.tsx`: remove unused `selections` (L75)
- `react/hooks/useGraphMutations.ts`: remove unused `FlowGraph` import, unused `SelectionRef` type
- `react/hooks/useMapInteraction.ts`: remove unused `SelectionRef` type
- `react/hooks/useNodeDrag.ts`: remove unused `FlowGraph` import

These are one-line fixes in each file.

## Verification

1. Build locally: `pnpm build` — confirm `dist/{index,react/index}.{js,d.ts}` exist.
2. Dry-run dist: either check the `runsascoded/npm-dist` workflow locally or push a branch and inspect the `dist/*` commit.
3. Bump `hbt`'s pinned dist SHA; run `pnpm build` in `hbt/www`.
   Expected: no TS errors from `node_modules/geo-sankey/react/**`.

## Notes

- `scene.ts` is framework-free; it's re-exported from `react/index.ts` but
  lives alongside. It'll get compiled into `react/index.js` as part of the
  bundle (already doing that conceptually — just formalized here).
- If `runsascoded/npm-dist`'s `exports_map` only accepts a single entry, the
  upstream change is small: extend the parser to accept an object of
  `src-path → exports-entry` and merge all of them into the published
  `package.json#exports`.
