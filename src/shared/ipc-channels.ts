// ============================================================================
// IPC Channel Names
// ============================================================================

export const IPC_CHANNELS = {
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_RESET: 'settings:reset',

  // Recording
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_CANCEL: 'recording:cancel',
  RECORDING_AUDIO_DATA: 'recording:audio-data',
  RECORDING_AUDIO_LEVEL: 'recording:audio-level',
  RECORDING_STARTED: 'recording:started',
  RECORDING_ERROR: 'recording:error',

  // Overlay
  OVERLAY_UPDATE: 'overlay:update',
  OVERLAY_SHOW: 'overlay:show',
  OVERLAY_HIDE: 'overlay:hide',

  // Windows
  WINDOW_SETTINGS_OPEN: 'window:settings:open',
  WINDOW_SETTINGS_CLOSE: 'window:settings:close',

  // App
  APP_QUIT: 'app:quit',

  // DevTools
  DEVTOOLS_OPEN: 'devtools:open',

  // API Validation
  VALIDATE_API_KEY: 'validate:api-key',

  // Transcription
  TRANSCRIPTION_PROGRESS: 'transcription:progress',
  TRANSCRIPTION_COMPLETE: 'transcription:complete',
  TRANSCRIPTION_ERROR: 'transcription:error',

  // Model Management
  MODEL_DOWNLOAD_START: 'model:download:start',
  MODEL_DOWNLOAD_PROGRESS: 'model:download:progress',
  MODEL_DOWNLOAD_COMPLETE: 'model:download:complete',
  MODEL_DOWNLOAD_ERROR: 'model:download:error',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
