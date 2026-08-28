import { defineConfig } from 'tsup'

/**
 * Builds the Node CLI tooling (migration scripts + installer + API smoke test)
 * into plain ESM bundles via tsup (esbuild).
 *
 * tsx is NOT an option here: under Node 24 it hands .ts files to native type
 * stripping, which runs TypeORM's legacy decorators with stage-3 semantics
 * (crash). Prebuilt bundles start instantly and need no loader.
 *
 * `experimentalDecorators` comes from tsup.tsconfig.json; `emitDecoratorMetadata`
 * is not needed — every entity column declares an explicit `type`.
 */
export default defineConfig({
  entry: [
    'scripts/migration-run.ts',
    'scripts/migration-revert.ts',
    'scripts/migration-generate.ts',
    'scripts/migration-check.ts',
    'scripts/install.ts',
    'scripts/test-apis.ts',
  ],
  outDir: 'scripts/dist',
  format: ['esm'],
  target: 'node20',
  // splitting: true breaks decorator references across chunks (esbuild loses
  // the binding inside __decorateClass) — self-contained bundles are safe.
  splitting: false,
  // No emitDecoratorMetadata: every entity column declares an explicit type,
  // so tsup doesn't need its swc plugin for TypeORM metadata.
  tsconfig: 'tsup.tsconfig.json',
  clean: true,
  sourcemap: false,
  dts: false,
})
