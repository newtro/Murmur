import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
    rollupOptions: {
      input: {
        main_window: path.resolve(__dirname, 'src/renderer/index.html'),
        overlay: path.resolve(__dirname, 'src/renderer/overlay.html'),
      },
    },
  },
});
