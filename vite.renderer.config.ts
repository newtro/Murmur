import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Electron loads renderer HTML via file:// protocol. Vite/Rollup adds
// `crossorigin` to script/link tags by default, which triggers CORS checks
// against the opaque file:// origin and blocks script execution entirely.
// This plugin strips the attribute from built HTML.
function electronCrossOriginFix(): Plugin {
  return {
    name: 'electron-crossorigin-fix',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '');
    },
  };
}

export default defineConfig({
  plugins: [react(), electronCrossOriginFix()],
  root: path.resolve(__dirname, 'src/renderer'),
  server: {
    port: 5200,
    strictPort: true,
  },
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
