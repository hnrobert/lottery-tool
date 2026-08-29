import { defineConfig } from 'tsup'

/**
 * Dev watch config: bundles the app entry into .dev/app.js and restarts node
 * on every rebuild. Separate from tsup.config.ts (CLI tooling) so the two
 * entry lists never merge.
 *
 * Output is CJS so the lazy `require('./routes/x')` calls in app.ts bundle
 * cleanly; `__dirname` inside the bundle resolves to .dev/ whose parent is
 * the service root — the same layout the production dist/ has.
 */
export default defineConfig({
  entry: ['src/app.ts'],
  outDir: '.dev',
  format: ['cjs'],
  target: 'node20',
  sourcemap: true,
  clean: true,
  watch: true,
  onSuccess: 'node .dev/app.js',
  tsconfig: 'tsup.tsconfig.json',
})
