import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  base: './',
  build: { target: 'es2022', outDir: '../dist', emptyOutDir: true },
});
