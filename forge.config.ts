import type { ForgeConfig } from '@electron-forge/shared-types';
import MakerNSIS from '@felixrieseberg/electron-forge-maker-nsis';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerMSIX } from '@electron-forge/maker-msix';
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

// Native modules marked as `external` in Vite must be manually copied into
// the packaged app because the VitePlugin only includes Vite build output,
// not node_modules.
//
// IMPORTANT: Forge's electron-rebuild runs as an earlier afterCopy hook,
// BEFORE our hook — so the modules aren't present when rebuild runs.
// We must call @electron/rebuild ourselves after copying.
const NATIVE_MODULES = ['uiohook-napi', 'node-gyp-build'];

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Murmur',
    executableName: 'murmur',
    icon: './resources/icons/icon',
    // Copy icons to process.resourcesPath so the app can find them at runtime
    extraResource: ['./resources/icons'],
    asar: {
      unpack: '**/node_modules/{uiohook-napi,node-gyp-build}/**/*',
    },
    appBundleId: 'com.murmur.app',
    afterCopy: [
      (buildPath, electronVersion, _platform, arch, callback) => {
        (async () => {
          // 1. Copy native modules into the build
          const nodeModulesDest = path.join(buildPath, 'node_modules');
          fs.mkdirSync(nodeModulesDest, { recursive: true });

          for (const mod of NATIVE_MODULES) {
            const src = path.resolve(__dirname, 'node_modules', mod);
            const dest = path.join(nodeModulesDest, mod);
            console.log(`[afterCopy] Copying ${mod}`);
            copyDirSync(src, dest);
          }

          // 2. Rebuild native modules for this Electron version.
          //    Forge's built-in rebuild ran before our hook (when the modules
          //    weren't present yet), so we must rebuild them now.
          console.log(`[afterCopy] Rebuilding native modules for Electron ${electronVersion} (${arch})`);
          const { rebuild } = require('@electron/rebuild');
          await rebuild({
            buildPath,
            electronVersion,
            arch,
            force: true,
          });
          console.log('[afterCopy] Rebuild complete');

          callback();
        })().catch(callback);
      },
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerNSIS({
      // NSIS configuration passed to electron-builder
      getAppBuilderConfig: async () => ({
        productName: 'Murmur',
        appId: 'com.murmur.app',
        nsis: {
          oneClick: false,                           // Show full installer UI, not one-click
          allowToChangeInstallationDirectory: true,  // Let user choose install location
          perMachine: false,                         // Install for current user by default
          allowElevation: true,                      // Allow installing for all users if user chooses
          createDesktopShortcut: 'always',           // Always create desktop shortcut
          createStartMenuShortcut: true,             // Create start menu entry
          license: path.resolve(__dirname, 'LICENSE.txt'),
          installerIcon: path.resolve(__dirname, 'resources/icons/icon.ico'),
          uninstallerIcon: path.resolve(__dirname, 'resources/icons/icon.ico'),
          installerHeaderIcon: path.resolve(__dirname, 'resources/icons/icon.ico'),
          runAfterFinish: true,                      // Launch app after install
          shortcutName: 'Murmur',
        },
        win: {
          icon: path.resolve(__dirname, 'resources/icons/icon.ico'),
          target: ['nsis'],
        },
      }),
    }),
    new MakerMSIX({
      appManifest: path.resolve(__dirname, 'resources/AppxManifest.xml'),
      packageAssets: path.resolve(__dirname, 'resources/msix-assets'),
      sign: false, // Microsoft signs MSIX packages submitted to the Store
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
