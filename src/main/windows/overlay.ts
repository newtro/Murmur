// ============================================================================
// Overlay Window - Floating pill for recording UI
// ============================================================================

import { BrowserWindow, screen, session } from 'electron';
import path from 'path';
import { OVERLAY } from '../../shared/constants';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

export function createOverlayWindow(): BrowserWindow {
  // Set up media permissions for microphone access
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'audioCapture'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
      return;
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowedPermissions = ['media', 'audioCapture'];
    return allowedPermissions.includes(permission);
  });

  // Position at bottom center of primary display
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const x = Math.round((screenWidth - OVERLAY.width) / 2);
  const y = screenHeight - OVERLAY.height - OVERLAY.margin;

  const overlayWindow = new BrowserWindow({
    width: OVERLAY.width,
    height: OVERLAY.height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    show: false, // Start hidden
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Prevent the window from being closed, just hide it
  overlayWindow.on('close', (event) => {
    event.preventDefault();
    overlayWindow.hide();
  });

  // Load the overlay HTML
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/overlay.html`);
  } else {
    overlayWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/overlay.html`)
    );
  }

  return overlayWindow;
}
