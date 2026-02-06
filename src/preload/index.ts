// ============================================================================
// Preload Script - Bridge between main and renderer processes
// ============================================================================

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { AppSettings, AudioLevel } from '../shared/types';

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('murmur', {
  // Settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET),

  // Recording commands from main to overlay
  onRecordingStart: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.RECORDING_START, callback);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RECORDING_START, callback);
  },
  onRecordingStop: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.RECORDING_STOP, callback);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RECORDING_STOP, callback);
  },
  onRecordingCancel: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.RECORDING_CANCEL, callback);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RECORDING_CANCEL, callback);
  },

  // Audio data from overlay to main (base64 encoded for IPC)
  sendAudioData: (data: { base64: string; duration: number }) => {
    ipcRenderer.send(IPC_CHANNELS.RECORDING_AUDIO_DATA, data);
  },

  // Audio level updates
  sendAudioLevel: (level: AudioLevel) => {
    ipcRenderer.send(IPC_CHANNELS.RECORDING_AUDIO_LEVEL, level);
  },

  // Recording status from overlay
  sendRecordingStarted: () => {
    ipcRenderer.send(IPC_CHANNELS.RECORDING_STARTED);
  },
  sendRecordingError: (error: string) => {
    ipcRenderer.send(IPC_CHANNELS.RECORDING_ERROR, error);
  },

  // Overlay state updates
  onOverlayUpdate: (callback: (data: { state: string; [key: string]: unknown }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { state: string }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.OVERLAY_UPDATE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OVERLAY_UPDATE, handler);
  },

  // Window controls
  openSettings: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_SETTINGS_OPEN),
  closeSettings: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_SETTINGS_CLOSE),
  quit: () => ipcRenderer.send(IPC_CHANNELS.APP_QUIT),
  openDevTools: () => ipcRenderer.send(IPC_CHANNELS.DEVTOOLS_OPEN),

  // API key validation
  validateApiKey: (provider: string, apiKey: string): Promise<{ valid: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_API_KEY, provider, apiKey),
});

// Type declarations for the renderer
declare global {
  interface Window {
    murmur: {
      getSettings: () => Promise<AppSettings>;
      setSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
      resetSettings: () => Promise<AppSettings>;
      onRecordingStart: (callback: () => void) => () => void;
      onRecordingStop: (callback: () => void) => () => void;
      onRecordingCancel: (callback: () => void) => () => void;
      sendAudioData: (data: { base64: string; duration: number }) => void;
      sendAudioLevel: (level: AudioLevel) => void;
      sendRecordingStarted: () => void;
      sendRecordingError: (error: string) => void;
      onOverlayUpdate: (callback: (data: { state: string; [key: string]: unknown }) => void) => () => void;
      openSettings: () => void;
      closeSettings: () => void;
      quit: () => void;
      openDevTools: () => void;
      validateApiKey: (provider: string, apiKey: string) => Promise<{ valid: boolean; error?: string }>;
    };
  }
}
