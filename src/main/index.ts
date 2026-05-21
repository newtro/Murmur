// ============================================================================
// Murmur - Main Process Entry Point
// ============================================================================

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } from 'electron';
import * as path from 'path';
import { createOverlayWindow } from './windows/overlay';
import { createSettingsWindow } from './windows/settings';
import { initializeDatabase, closeDatabase, getSettings, setSettings } from './db/store';
import { HotkeyService } from './services/hotkeys';
import { TranscriptionService } from './services/transcription';
import { StreamingTranscriptionService } from './services/streaming-transcription';
import { LLMService } from './services/llm';
import { PasteService } from './services/paste';
import { TypingService } from './services/typing';
import { TypingEngine } from './services/typing-engine';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { TEXT_CORRECTION_PROMPTS } from '../shared/constants';
import { OverlayState, AppSettings, DEFAULT_SETTINGS, AudioLevel } from '../shared/types';

// ============================================================================
// Global State
// ============================================================================

let tray: Tray | null = null;
let overlayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

let hotkeyService: HotkeyService | null = null;
let transcriptionService: TranscriptionService | null = null;
let streamingTranscriptionService: StreamingTranscriptionService | null = null;
let llmService: LLMService | null = null;
let pasteService: PasteService | null = null;
let typingService: TypingService | null = null;
let typingEngine: TypingEngine | null = null;
let typingEngineTickTimer: ReturnType<typeof setInterval> | null = null;
let isLiveDictating = false;
// Set true during a deliberate stop (stopRecording's live branch) so the
// streaming-close handler stays out of the way — the stop path handles
// teardown itself. Without this flag the close event during normal stop
// would prematurely flip the session off and drop the final 'turn' event
// AssemblyAI emits during the close-ack window.
let isLiveStopping = false;

let isRecording = false;
let isCorrectingText = false;
let currentState: OverlayState = 'idle';
let pendingAudioResolve: ((buffer: Buffer) => void) | null = null;
let pendingAudioReject: ((error: Error) => void) | null = null;

// ============================================================================
// Helpers
// ============================================================================

/** Resolve a path under resources/icons/ that works in both dev and packaged builds. */
function getIconPath(filename: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icons', filename);
  }
  return path.join(__dirname, '../../resources/icons', filename);
}

// ============================================================================
// App Initialization
// ============================================================================

console.log('[Murmur] Starting main process...');
console.log('[Murmur] Command line args:', process.argv);

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Murmur] Another instance is running, exiting...');
  app.quit();
} else {
  console.log('[Murmur] Single instance lock acquired');
  app.on('second-instance', () => {
    console.log('[Murmur] Second instance attempted, showing settings window');
    if (settingsWindow) {
      if (settingsWindow.isMinimized()) settingsWindow.restore();
      settingsWindow.focus();
    } else {
      createAndShowSettingsWindow();
    }
  });
}

// ============================================================================
// Window Management
// ============================================================================

function createAndShowSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = createSettingsWindow();

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function updateOverlayState(state: OverlayState, data?: Record<string, unknown>) {
  currentState = state;
  console.log('[Murmur] updateOverlayState:', state, 'overlayWindow exists:', !!overlayWindow, 'destroyed:', overlayWindow?.isDestroyed());
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(IPC_CHANNELS.OVERLAY_UPDATE, { state, ...data });

    if (state === 'idle') {
      overlayWindow.hide();
    } else {
      console.log('[Murmur] Showing overlay window, bounds:', overlayWindow.getBounds());
      overlayWindow.showInactive();
    }
  }
}

// ============================================================================
// Recording Flow
// ============================================================================

async function startRecording() {
  if (isRecording) return;

  // Check for transcription API key before starting
  const settings = getSettings();
  if (settings.transcriptionProvider !== 'whisper-local') {
    const hasTranscriptionKey = settings.transcriptionProvider in settings.apiKeys &&
      settings.apiKeys[settings.transcriptionProvider as keyof typeof settings.apiKeys];
    if (!hasTranscriptionKey) {
      const result = await dialog.showMessageBox({
        type: 'info',
        title: 'API Key Required',
        message: 'Voice transcription requires an API key.',
        detail: `Please configure an API key for ${settings.transcriptionProvider} in Settings. We recommend Mistral AI which offers a free tier.`,
        buttons: ['Open Settings', 'Cancel'],
        defaultId: 0,
      });
      if (result.response === 0) {
        createAndShowSettingsWindow();
      }
      return;
    }
  }

  // Branch on live-dictation mode.
  const liveMode = settings.liveDictationEnabled;
  if (liveMode) {
    if (!typingService?.isAvailable()) {
      const platform = process.platform === 'darwin'
        ? 'macOS: Grant Accessibility permission to Murmur in System Settings → Privacy & Security → Accessibility.'
        : process.platform === 'linux'
          ? 'Linux: live dictation requires an X11 session (Wayland is not yet supported).'
          : 'Live dictation is unavailable on this platform.';
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Live Dictation Unavailable',
        message: 'Murmur cannot type into the focused app right now.',
        detail: platform,
        buttons: ['OK'],
      });
      return;
    }
    // Configure engine for this session and reset state.
    typingEngine?.setMode(settings.liveDictationTypingMode);
    typingEngine?.setStabilityMs(settings.liveDictationStabilityMs);
    typingEngine?.reset();
    isLiveDictating = true;
    if (settings.liveDictationTypingMode === 'partials') {
      startEngineTickTimer();
    }
  }

  isRecording = true;

  console.log(`[Murmur] Starting recording... (mode=${liveMode ? 'live' : 'batch'})`);
  updateOverlayState('listening');

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(IPC_CHANNELS.RECORDING_START, { mode: liveMode ? 'live' : 'batch' });
  }
}

function startEngineTickTimer() {
  stopEngineTickTimer();
  typingEngineTickTimer = setInterval(() => {
    if (!isLiveDictating) return;
    void typingEngine?.tick();
  }, 50);
}

function stopEngineTickTimer() {
  if (typingEngineTickTimer) {
    clearInterval(typingEngineTickTimer);
    typingEngineTickTimer = null;
  }
}

/**
 * Tear down an active live-dictation session unilaterally. Used by stream
 * error/close handlers so the next hotkey press starts a clean session
 * instead of waiting on a hung batch-path audio promise.
 */
function tearDownLiveSession() {
  typingEngine?.abort();
  stopEngineTickTimer();
  isLiveDictating = false;
  isRecording = false;
  if (pendingAudioReject) {
    pendingAudioReject(new Error('Live session ended'));
    pendingAudioResolve = null;
    pendingAudioReject = null;
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(IPC_CHANNELS.RECORDING_CANCEL);
  }
}

async function stopRecording() {
  if (!isRecording) return;
  isRecording = false;

  // Live mode: AssemblyAI emits the final `turn` event AFTER we initiate
  // the WS close, so we have to keep the session alive (and the engine
  // unaborted) until stop() resolves. The `isLiveStopping` flag tells the
  // close-event handler to stand down so it doesn't double-tear-down.
  if (isLiveDictating) {
    console.log('[Murmur] Stopping live dictation...');
    updateOverlayState('processing');
    stopEngineTickTimer();
    isLiveStopping = true;
    try {
      // Push any pending partial out (no-op in finals mode).
      await typingEngine?.flush();
      // Close the WS. The close-ack window may carry one last 'turn' event
      // with the final transcript — our turn handler routes it through the
      // engine while isLiveDictating is still true.
      await streamingTranscriptionService?.stop();
      // Wait for any queued insert/backspace ops to actually fire so the
      // overlay doesn't flip to "complete" before the keystrokes land.
      await typingEngine?.drain();
    } catch (err) {
      console.error('[Murmur] Live stop failed:', err);
    } finally {
      isLiveStopping = false;
      isLiveDictating = false;
      typingEngine?.abort();
    }
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send(IPC_CHANNELS.RECORDING_STOP);
    }
    updateOverlayState('complete');
    setTimeout(() => updateOverlayState('idle'), 1000);
    return;
  }

  console.log('[Murmur] Stopping recording...');
  updateOverlayState('processing');

  const audioPromise = new Promise<Buffer>((resolve, reject) => {
    pendingAudioResolve = resolve;
    pendingAudioReject = reject;

    setTimeout(() => {
      if (pendingAudioReject) {
        pendingAudioReject(new Error('Audio capture timeout'));
        pendingAudioResolve = null;
        pendingAudioReject = null;
      }
    }, 30000);
  });

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(IPC_CHANNELS.RECORDING_STOP);
  }

  try {
    const audioBuffer = await audioPromise;

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('No audio recorded');
    }

    const settings = getSettings();

    console.log('[Murmur] Transcribing...');
    const fallback = settings.transcriptionFallbackProvider && settings.transcriptionFallbackModel &&
      settings.transcriptionFallbackProvider !== settings.transcriptionProvider
      ? {
          provider: settings.transcriptionFallbackProvider,
          model: settings.transcriptionFallbackModel,
        }
      : undefined;

    const outcome = await transcriptionService?.transcribe(audioBuffer, {
      provider: settings.transcriptionProvider,
      model: settings.transcriptionModel,
      language: settings.language === 'auto' ? undefined : settings.language,
      fallback,
    });

    if (!outcome) {
      throw new Error('Transcription failed');
    }

    const transcriptionResult = outcome.result;
    if (outcome.fallbackUsed) {
      console.log(`[Murmur] Fallback used: ${outcome.providerUsed}`);
    }
    let finalText = transcriptionResult.text;

    const hasApiKey = settings.llmProvider === 'ollama' ||
      (settings.llmProvider in settings.apiKeys && settings.apiKeys[settings.llmProvider as keyof typeof settings.apiKeys]);

    if (settings.processingMode !== 'raw' && hasApiKey) {
      console.log('[Murmur] Processing with LLM...');
      const llmResult = await llmService?.process(transcriptionResult.text, {
        provider: settings.llmProvider,
        model: settings.llmModel,
        processingMode: settings.processingMode,
      });

      if (llmResult) {
        finalText = llmResult.processedText;
      }
    }

    console.log('[Murmur] Pasting text...');
    await pasteService?.paste(finalText);

    const wordCount = finalText.split(/\s+/).filter(Boolean).length;
    updateOverlayState('complete', { wordCount });

    setTimeout(() => {
      updateOverlayState('idle');
    }, 1500);

  } catch (error) {
    console.error('[Murmur] Recording flow error:', error);
    const classified = (error as { classified?: { userMessage: string } })?.classified;
    const message = classified?.userMessage
      ?? (error instanceof Error ? error.message : 'An error occurred');
    updateOverlayState('error', { error: message });

    setTimeout(() => {
      updateOverlayState('idle');
    }, 3000);
  }
}

function cancelRecording() {
  if (!isRecording) return;
  isRecording = false;

  console.log('[Murmur] Cancelling recording...');

  // Live mode: abort the engine and tear down the streaming session.
  // committed-but-already-typed text stays in the user's app (we can't undo it).
  if (isLiveDictating) {
    typingEngine?.abort();
    stopEngineTickTimer();
    void streamingTranscriptionService?.stop();
    isLiveDictating = false;
  }

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(IPC_CHANNELS.RECORDING_CANCEL);
  }

  if (pendingAudioReject) {
    pendingAudioReject(new Error('Recording cancelled'));
    pendingAudioResolve = null;
    pendingAudioReject = null;
  }

  updateOverlayState('idle');
}

// ============================================================================
// Text Correction Flow
// ============================================================================

async function correctSelectedText() {
  if (isCorrectingText || isRecording) return;
  isCorrectingText = true;

  console.log('[Murmur] Starting text correction...');
  updateOverlayState('processing');

  let previousClipboard = '';

  try {
    // Copy the selected text
    const result = await pasteService!.copySelection();
    previousClipboard = result.previousClipboard;
    const selectedText = result.selectedText;

    if (!selectedText || selectedText.trim().length === 0) {
      console.log('[Murmur] No text selected, aborting correction');
      updateOverlayState('error', { error: 'No text selected' });
      setTimeout(() => updateOverlayState('idle'), 2000);
      isCorrectingText = false;
      return;
    }

    console.log('[Murmur] Correcting text:', selectedText.substring(0, 50) + '...');

    const settings = getSettings();

    // Build the correction prompt
    let prompt: string;
    if (settings.textCorrectionMode === 'custom' && settings.textCorrectionCustomPrompt) {
      prompt = settings.textCorrectionCustomPrompt;
    } else {
      prompt = TEXT_CORRECTION_PROMPTS[settings.textCorrectionMode] || TEXT_CORRECTION_PROMPTS.proofread;
    }

    const fullPrompt = `${prompt}\n\nText to process:\n${selectedText}`;

    // Check for API key
    const hasApiKey = settings.llmProvider === 'ollama' ||
      (settings.llmProvider in settings.apiKeys && settings.apiKeys[settings.llmProvider as keyof typeof settings.apiKeys]);

    if (!hasApiKey) {
      updateOverlayState('idle');
      isCorrectingText = false;
      // Restore clipboard before showing dialog
      if (previousClipboard) {
        pasteService?.restoreClipboard(previousClipboard);
      }
      const result = await dialog.showMessageBox({
        type: 'info',
        title: 'API Key Required',
        message: 'Text Correction requires an LLM API key.',
        detail: 'Please configure an API key in Settings to use this feature. We recommend Mistral AI which offers a free tier.',
        buttons: ['Open Settings', 'Cancel'],
        defaultId: 0,
      });
      if (result.response === 0) {
        createAndShowSettingsWindow();
      }
      return;
    }

    // Process with LLM (using same provider/model as voice processing)
    console.log('[Murmur] Processing correction with LLM...');
    if (!llmService) {
      throw new Error('LLM service not initialized');
    }
    const correctedText = await llmService.completeRawJson(fullPrompt, settings.llmProvider, settings.llmModel);

    console.log('[Murmur] Correction complete, pasting...');

    // Paste the corrected text (replaces the selected text)
    await pasteService?.paste(correctedText);

    // Wait a bit then restore clipboard
    await new Promise(resolve => setTimeout(resolve, 200));
    pasteService?.restoreClipboard(previousClipboard);

    const wordCount = correctedText.split(/\s+/).filter(Boolean).length;
    updateOverlayState('complete', { wordCount });

    setTimeout(() => {
      updateOverlayState('idle');
    }, 1500);

  } catch (error) {
    console.error('[Murmur] Text correction error:', error);
    updateOverlayState('error', {
      error: error instanceof Error ? error.message : 'Correction failed'
    });

    // Restore clipboard on error
    if (previousClipboard) {
      pasteService?.restoreClipboard(previousClipboard);
    }

    setTimeout(() => {
      updateOverlayState('idle');
    }, 3000);
  } finally {
    isCorrectingText = false;
  }
}

// ============================================================================
// System Tray
// ============================================================================

function createTray() {
  console.log('[Murmur] Creating tray icon...');

  // Load tray icon from resources
  let trayIcon = nativeImage.createFromPath(getIconPath('icon.png'));

  // Resize for tray (16x16 on Windows)
  if (!trayIcon.isEmpty()) {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  }
  console.log('[Murmur] Icon size:', trayIcon.getSize());

  tray = new Tray(trayIcon);
  tray.setToolTip('Murmur - Voice Dictation');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Settings', click: () => createAndShowSettingsWindow() },
    { type: 'separator' },
    { label: 'Start Recording', click: () => startRecording() },
    { label: 'Stop Recording', click: () => stopRecording() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => createAndShowSettingsWindow());

  console.log('[Murmur] Tray created');
}

// ============================================================================
// IPC Handlers
// ============================================================================

function setupIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    try {
      return getSettings();
    } catch (error) {
      console.error('[Murmur] Failed to get settings, returning defaults:', error);
      return DEFAULT_SETTINGS;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_, settings: Partial<AppSettings>) => {
    try {
      const current = getSettings();
      const updated = { ...current, ...settings };
      setSettings(updated);
      // Re-read so the renderer sees normalized state (live-dictation invariant etc.).
      const persisted = getSettings();

      if (settings.apiKeys) {
        transcriptionService?.updateApiKeys(settings.apiKeys);
        streamingTranscriptionService?.updateApiKeys(settings.apiKeys);
        llmService?.updateApiKeys(settings.apiKeys);
      }

      // Live-dictation mode/stability take effect on the NEXT session, not
      // mid-flight — see startRecording() where we re-snapshot from settings.

      if (settings.hotkeys) {
        hotkeyService?.updateHotkeys(settings.hotkeys);
      }

      if (settings.launchAtStartup !== undefined && app.isPackaged) {
        app.setLoginItemSettings({
          openAtLogin: settings.launchAtStartup,
        });
      }

      return persisted;
    } catch (error) {
      console.error('[Murmur] Failed to set settings:', error);
      return DEFAULT_SETTINGS;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, () => {
    try {
      setSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('[Murmur] Failed to reset settings:', error);
      return DEFAULT_SETTINGS;
    }
  });

  ipcMain.on(IPC_CHANNELS.RECORDING_START, () => startRecording());
  ipcMain.on(IPC_CHANNELS.RECORDING_STOP, () => stopRecording());
  ipcMain.on(IPC_CHANNELS.RECORDING_CANCEL, () => cancelRecording());

  ipcMain.on(IPC_CHANNELS.RECORDING_AUDIO_DATA, (_, data: { base64: string; duration: number }) => {
    console.log(`[Murmur] Received audio data: ${data.duration.toFixed(2)}s`);
    if (pendingAudioResolve) {
      const buffer = Buffer.from(data.base64, 'base64');
      pendingAudioResolve(buffer);
      pendingAudioResolve = null;
      pendingAudioReject = null;
    }
  });

  ipcMain.on(IPC_CHANNELS.RECORDING_STARTED, () => {
    console.log('[Murmur] Overlay confirmed recording started');
  });

  ipcMain.on(IPC_CHANNELS.RECORDING_ERROR, (_, error: string) => {
    console.error('[Murmur] Recording error from overlay:', error);
    if (pendingAudioReject) {
      pendingAudioReject(new Error(error));
      pendingAudioResolve = null;
      pendingAudioReject = null;
    }
    // Tear down a live session if one was active — otherwise isLiveDictating
    // and the tick timer leak and the next session sees stale state.
    if (isLiveDictating) {
      tearDownLiveSession();
      // tearDownLiveSession already sent RECORDING_CANCEL; clear isRecording.
    }
    isRecording = false;
    updateOverlayState('error', { error });
    setTimeout(() => updateOverlayState('idle'), 3000);
  });

  ipcMain.on(IPC_CHANNELS.RECORDING_AUDIO_LEVEL, (_, _level: AudioLevel) => {
    // Audio level visualization handled by overlay
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_SETTINGS_OPEN, () => createAndShowSettingsWindow());
  ipcMain.on(IPC_CHANNELS.WINDOW_SETTINGS_CLOSE, () => settingsWindow?.close());
  ipcMain.on(IPC_CHANNELS.APP_QUIT, () => app.quit());

  ipcMain.handle(IPC_CHANNELS.APP_GET_ENV, () => ({
    isMsix: Boolean((process as NodeJS.Process & { windowsStore?: boolean }).windowsStore),
    platform: process.platform,
    isPackaged: app.isPackaged,
  }));

  ipcMain.on(IPC_CHANNELS.APP_OPEN_EXTERNAL, (_, url: string) => {
    shell.openExternal(url);
  });
  ipcMain.on(IPC_CHANNELS.DEVTOOLS_OPEN, () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.openDevTools();
    }
  });

  // setupIpcHandlers() runs before initializeServices() so the renderer can
  // surface a clear error if it calls into us before initialization completes.
  // That's why each streaming handler null-checks `streamingTranscriptionService`.
  ipcMain.handle(
    IPC_CHANNELS.STREAMING_SESSION_START,
    async (event, sampleRate?: number): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!streamingTranscriptionService) {
        return { ok: false, error: 'Streaming service not initialized' };
      }
      try {
        await streamingTranscriptionService.start({
          sampleRate,
          target: event.sender,
        });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to start streaming session',
        };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.STREAMING_SESSION_STOP, async (): Promise<{ ok: true }> => {
    if (streamingTranscriptionService) {
      await streamingTranscriptionService.stop();
    }
    return { ok: true };
  });

  ipcMain.on(IPC_CHANNELS.STREAMING_AUDIO_CHUNK, (_event, chunk: ArrayBuffer) => {
    if (!streamingTranscriptionService || !chunk) return;
    streamingTranscriptionService.sendAudio(Buffer.from(chunk));
  });

  ipcMain.handle(IPC_CHANNELS.VALIDATE_API_KEY, async (_, provider: string, apiKey: string) => {
    try {
      switch (provider) {
        case 'groq':
          return await transcriptionService?.validateGroqKey(apiKey);
        case 'openai':
          return await transcriptionService?.validateOpenAIKey(apiKey);
        case 'mistral':
          return await transcriptionService?.validateMistralKey(apiKey);
        case 'assemblyai':
          return await transcriptionService?.validateAssemblyAIKey(apiKey);
        case 'anthropic':
          return await llmService?.validateAnthropicKey(apiKey);
        case 'gemini':
          return await llmService?.validateGeminiKey(apiKey);
        default:
          return { valid: false, error: 'Unknown provider' };
      }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Validation failed' };
    }
  });
}

// ============================================================================
// Service Initialization
// ============================================================================

async function initializeServices() {
  const settings = getSettings();

  transcriptionService = new TranscriptionService(settings.apiKeys);
  streamingTranscriptionService = new StreamingTranscriptionService(settings.apiKeys);
  llmService = new LLMService(settings.apiKeys);
  pasteService = new PasteService();
  typingService = new TypingService();
  typingEngine = new TypingEngine(typingService, {
    mode: settings.liveDictationTypingMode,
    stabilityMs: settings.liveDictationStabilityMs,
  });

  // Route streaming events into the typing engine when a live session is active.
  streamingTranscriptionService.on('open', (event) => {
    console.log(`[Streaming] session opened id=${event.sessionId}`);
  });
  streamingTranscriptionService.on('turn', (event) => {
    console.log(
      `[Streaming] turn endOfTurn=${event.endOfTurn} active=${isLiveDictating || isLiveStopping} text="${event.transcript.slice(0, 80)}"`
    );
    // Route while the session is open OR while we're in the stop window —
    // AssemblyAI may emit the final formatted "Turn" event after we initiate
    // close. The engine's own abort flag (set in stopRecording's finally)
    // guards against any genuinely-late events arriving past teardown.
    if (!typingEngine || (!isLiveDictating && !isLiveStopping)) return;
    void typingEngine.onTurn(event);
  });
  streamingTranscriptionService.on('error', (err) => {
    console.error('[Streaming] error:', err.message);
    if (isLiveDictating) {
      // Abort engine + reset state so any in-flight ops stop emitting keystrokes
      // into the user's app. Phase 6 ring-buffer fallback to batch is deferred —
      // for now we surface the error and end the session cleanly so the next
      // hotkey press doesn't hang in the batch path.
      tearDownLiveSession();
      updateOverlayState('error', { error: `Live dictation: ${err.message}` });
      setTimeout(() => updateOverlayState('idle'), 3000);
    }
  });
  streamingTranscriptionService.on('close', (event) => {
    console.log(`[Streaming] session closed code=${event.code} reason=${event.reason}`);
    if (isLiveStopping) {
      // Normal stop in progress — stopRecording's live branch owns teardown.
      // Just clean up the tick timer; the rest is the stop path's job.
      stopEngineTickTimer();
      return;
    }
    if (isLiveDictating) {
      tearDownLiveSession();
      updateOverlayState('idle');
    } else {
      stopEngineTickTimer();
    }
  });

  hotkeyService = new HotkeyService(settings.hotkeys);
  hotkeyService.on('keyDown', () => {
    const currentSettings = getSettings();
    if (currentSettings.hotkeys.activationMode === 'push-to-talk') {
      startRecording();
    } else {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  });
  hotkeyService.on('keyUp', () => {
    const currentSettings = getSettings();
    if (currentSettings.hotkeys.activationMode === 'push-to-talk' && isRecording) {
      stopRecording();
    }
  });
  hotkeyService.on('correctKeyDown', () => {
    correctSelectedText();
  });
  hotkeyService.start();
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.on('ready', async () => {
  console.log('[Murmur] App ready, initializing...');

  // Set up IPC handlers first so settings window can at least show errors
  setupIpcHandlers();

  try {
    await initializeDatabase();
    console.log('[Murmur] Database initialized');

    overlayWindow = createOverlayWindow();
    console.log('[Murmur] Overlay window created');

    createTray();
    console.log('[Murmur] Tray created');

    await initializeServices();
    console.log('[Murmur] Services initialized');

    console.log('[Murmur] Initialization complete. Ready for voice input.');
  } catch (error) {
    console.error('[Murmur] Fatal error during initialization:', error);
  }
});

app.on('window-all-closed', () => {
  // Don't quit - app runs in tray
});

app.on('before-quit', () => {
  hotkeyService?.stop();
  // Tear down any active streaming session so AssemblyAI gets a clean close
  // rather than a hard socket drop. The orchestrator's stop() is async but we
  // can't await here; the close has its own internal timeout (CLOSE_TIMEOUT_MS).
  void streamingTranscriptionService?.stop();
  closeDatabase();

  // Destroy tray so nothing keeps the process alive
  if (tray) {
    tray.destroy();
    tray = null;
  }

  // Force-close all windows (overlay is non-closable by default)
  BrowserWindow.getAllWindows().forEach(w => w.destroy());
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createAndShowSettingsWindow();
  }
});
