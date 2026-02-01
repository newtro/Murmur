import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

// Copy sql.js WASM file to build output
function copySqlJsWasm() {
  return {
    name: 'copy-sql-js-wasm',
    writeBundle() {
      const wasmSrc = path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm');
      const wasmDest = path.resolve(__dirname, '.vite/build/sql-wasm.wasm');
      if (fs.existsSync(wasmSrc)) {
        fs.copyFileSync(wasmSrc, wasmDest);
        console.log('Copied sql-wasm.wasm to build directory');
      }
    },
  };
}

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'electron',
        'uiohook-napi',
      ],
    },
  },
  plugins: [copySqlJsWasm()],
  resolve: {
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
});
