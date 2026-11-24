import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces a normal static build in dist/.
// `npm run build:single` produces one self-contained dist-single/index.html
// (handy for opening BRICKHOUSE straight from disk – the app uses hash routing).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'single'
    ? { outDir: 'dist-single', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 2000 }
    : { outDir: 'dist', chunkSizeWarningLimit: 900 },
}));
