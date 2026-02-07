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
    hasShadow: false, // No shadow for transparent window
    show: false, // Start hidden
    focusable: false, // Don't steal focus from other apps
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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

  // Debug: log load failures
  overlayWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Overlay] Failed to load:', { errorCode, errorDescription, validatedURL });
  });

  overlayWindow.webContents.on('did-finish-load', () => {
    console.log('[Overlay] Successfully loaded');
  });

  overlayWindow.webContents.on('console-message', (_event, level, message) => {
    console.log(`[Overlay Console] [${level}] ${message}`);
  });

  // Load the overlay HTML
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const url = `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/overlay.html`;
    console.log('[Overlay] Loading URL:', url);
    overlayWindow.loadURL(url);
  } else {
    const filePath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/overlay.html`);
    console.log('[Overlay] Loading file:', filePath);
    overlayWindow.loadFile(filePath);
  }

  return overlayWindow;
}
