// ============================================================================
// Streaming Transcription Orchestrator
//
// Owns the active streaming session for live dictation. The renderer streams
// PCM16 audio chunks via IPC; this orchestrator forwards them to the active
// provider (AssemblyAI today) and re-emits transcript turns back to the
// renderer + listeners.
// ============================================================================

import { EventEmitter } from 'events';
import { BrowserWindow, WebContents } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import {
  AssemblyAIStreamingProvider,
  StreamingTurnEvent,
  StreamingOpenEvent,
} from './transcription/assemblyai-streaming';
import { ApiKeys } from '../../shared/types';

export interface StreamingStartOptions {
  /** Sample rate of the PCM16 chunks the renderer will send (default 16000). */
  sampleRate?: number;
  /**
   * Optional target WebContents for streaming-event IPC. If not provided, falls
   * back to broadcasting to all windows (matches earlier behavior, but prefer
   * the explicit form so the settings window doesn't receive dictation chatter).
   */
  target?: WebContents;
}

/**
 * Coordinates a single active streaming-transcription session.
 *
 * Emits:
 *  - 'open'   (StreamingOpenEvent)
 *  - 'turn'   (StreamingTurnEvent)
 *  - 'error'  (Error)
 *  - 'close'  ({ code, reason })
 *
 * Forwards the same events over IPC to all browser windows so the overlay
 * and the diff/typing engine (Phase 4) can react in-process.
 */
export class StreamingTranscriptionService extends EventEmitter {
  private assemblyai: AssemblyAIStreamingProvider;
  private active = false;
  private target: WebContents | null = null;

  constructor(apiKeys: ApiKeys) {
    super();
    this.assemblyai = new AssemblyAIStreamingProvider(apiKeys.assemblyai);
    this.wireProviderEvents();
  }

  updateApiKeys(apiKeys: ApiKeys): void {
    this.assemblyai.updateApiKey(apiKeys.assemblyai);
  }

  isActive(): boolean {
    return this.active;
  }

  async start(options: StreamingStartOptions = {}): Promise<void> {
    if (this.active) {
      throw new Error('Streaming session already active');
    }
    if (!this.assemblyai.hasKey()) {
      throw new Error('AssemblyAI API key not configured');
    }
    this.target = options.target ?? null;
    try {
      await this.assemblyai.start(options.sampleRate ?? 16000);
      this.active = true;
    } catch (err) {
      this.target = null;
      throw err;
    }
  }

  sendAudio(chunk: Buffer): void {
    if (!this.active) return;
    this.assemblyai.sendAudio(chunk);
  }

  async stop(): Promise<void> {
    if (!this.active) return;
    this.active = false;
    await this.assemblyai.stop();
    this.target = null;
  }

  private wireProviderEvents(): void {
    this.assemblyai.on('open', (event: StreamingOpenEvent) => {
      this.emit('open', event);
      this.dispatch(IPC_CHANNELS.STREAMING_SESSION_OPENED, event);
    });
    this.assemblyai.on('turn', (event: StreamingTurnEvent) => {
      this.emit('turn', event);
      this.dispatch(IPC_CHANNELS.STREAMING_TRANSCRIPT, event);
    });
    this.assemblyai.on('error', (err: Error) => {
      this.active = false;
      this.emit('error', err);
      this.dispatch(IPC_CHANNELS.STREAMING_ERROR, { message: err.message });
    });
    this.assemblyai.on('close', (close: { code: number; reason: string }) => {
      this.active = false;
      this.emit('close', close);
      this.dispatch(IPC_CHANNELS.STREAMING_SESSION_CLOSED, close);
    });
  }

  /**
   * Send the event to the session's target WebContents (the window that
   * started the session). Falls back to all windows when no target was set
   * — keeps backward compatibility but the explicit form is preferred.
   */
  private dispatch(channel: string, payload: unknown): void {
    if (this.target && !this.target.isDestroyed()) {
      this.target.send(channel, payload);
      return;
    }
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    }
  }
}
