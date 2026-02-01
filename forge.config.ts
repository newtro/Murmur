import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import * as path from 'path';
import * as fs from 'fs';

// Helper to copy directory recursively
function copyDirSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Murmur',
    executableName: 'murmur',
    icon: './resources/icons/icon',
    asar: {
      unpack: '**/node_modules/{uiohook-napi,node-gyp-build}/**/*',
    },
    appBundleId: 'com.murmur.app',
    afterCopy: [
      (buildPath, _electronVersion, _platform, _arch, callback) => {
        // Copy native modules and their dependencies to node_modules in the build
        const nodeModulesDest = path.join(buildPath, 'node_modules');
        fs.mkdirSync(nodeModulesDest, { recursive: true });

        // Modules to copy (uiohook-napi and its dependencies)
        const modulesToCopy = ['uiohook-napi', 'node-gyp-build'];

        for (const moduleName of modulesToCopy) {
          const src = path.resolve(__dirname, 'node_modules', moduleName);
          const dest = path.join(nodeModulesDest, moduleName);
          console.log(`Copying ${moduleName} to ${dest}`);
          copyDirSync(src, dest);
        }

        callback();
      },
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'Murmur',
      authors: 'Murmur Contributors',
      description: 'Open source AI voice dictation',
      setupIcon: './resources/icons/icon.ico',
    }),
    new MakerZIP({}, ['darwin', 'linux', 'win32']),
    new MakerDMG({
      name: 'Murmur',
    }),
    new MakerDeb({
      options: {
        name: 'murmur',
        productName: 'Murmur',
        genericName: 'Voice Dictation',
        description: 'Open source AI voice dictation - Wispr Flow alternative',
        categories: ['Utility', 'AudioVideo'],
        icon: './resources/icons/icon.png',
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
