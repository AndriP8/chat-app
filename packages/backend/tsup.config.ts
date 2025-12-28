import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2022',
  platform: 'node',
  outDir: 'dist',
  dts: false, // Disable .d.ts generation (not needed at runtime, reduces build complexity)
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  // Preserve @/ aliases - tsup will resolve them correctly
  tsconfig: './tsconfig.json',
});
