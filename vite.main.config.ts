import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'electron',
        'uiohook-napi',
        '@nut-tree-fork/libnut-win32',
        '@nut-tree-fork/libnut-darwin',
        '@nut-tree-fork/libnut-linux',
        'bindings',
        'file-uri-to-path',
        // Optional native perf deps of `ws` (pulled in transitively by the
        // AssemblyAI SDK). ws wraps the requires in try/catch and falls back
        // to its pure-JS implementation when these aren't present, but Vite
        // throws at bundle time if it can't resolve them statically.
        'bufferutil',
        'utf-8-validate',
      ],
    },
  },
});
