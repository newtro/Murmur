// ============================================================================
// Settings Window - Main configuration panel
// ============================================================================

import { BrowserWindow } from 'electron';
import path from 'path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

export function createSettingsWindow(): BrowserWindow {
  // For Electron Forge + Vite, preload is built to same dir as main
  const preloadPath = path.join(__dirname, 'preload.js');
  const iconPath = path.join(__dirname, '../../resources/icons/icon.png');
  console.log('[Settings] Creating window...');
  console.log('[Settings] Preload path:', preloadPath);
  console.log('[Settings] __dirname:', __dirname);

  const settingsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    title: 'Murmur Settings',
    icon: iconPath,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Log any errors
  settingsWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Settings] Failed to load:', errorCode, errorDescription);
  });

  // Forward console messages from renderer
  settingsWindow.webContents.on('console-message', (_event, _level, message) => {
    console.log('[Settings Console]', message);
  });

  // Show when ready
  settingsWindow.once('ready-to-show', () => {
    console.log('[Settings] Window ready to show');
    settingsWindow.show();
  });

  // Load the settings HTML
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('[Settings] Loading dev URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
    settingsWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const filePath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    console.log('[Settings] Loading file:', filePath);
    settingsWindow.loadFile(filePath);
  }

  return settingsWindow;
}
