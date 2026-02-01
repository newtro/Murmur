import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Murmur',
    executableName: 'murmur',
    icon: './resources/icons/icon',
    asar: {
      unpack: '**/{sql.js,uiohook-napi,adm-zip}/**/*',
    },
    appBundleId: 'com.murmur.app',
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
