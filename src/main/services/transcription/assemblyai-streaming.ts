// ============================================================================
// AssemblyAI Streaming Transcription Provider
// Wraps the SDK's streaming transcriber (u3-rt-pro) for live dictation.
// ============================================================================

import { EventEmitter } from 'events';
import {
  AssemblyAI,
  type StreamingTranscriber,
  type BeginEvent,
  type TurnEvent,
  type StreamingWord,
  type WarningEvent,
} from 'assemblyai';

export interface StreamingTurnEvent {
  transcript: string;
  endOfTurn: boolean;
  words?: StreamingWord[];
}

export interface StreamingOpenEvent {
  sessionId: string;
  expiresAt: number;
}

// Time we'll wait for AssemblyAI to ack our Terminate message during close()
// before walking away. Without this bound, a dead WebSocket would wedge stop().
const CLOSE_TIMEOUT_MS = 2500;

/**
 * Event-emitter wrapper for the AssemblyAI streaming transcriber.
 *
 * Emits: 'open' (StreamingOpenEvent), 'turn' (StreamingTurnEvent),
 *        'error' (Error), 'close' ({code, reason}).
 *
 * NOTE: The underlying SDK's `on()` REPLACES the previous listener for an
 * event (it's a single-listener setter, not additive). We register exactly
 * one handler per event in start() and re-emit through this EventEmitter,
 * which is additive. Don't expose the SDK transcriber object directly.
 */
export class AssemblyAIStreamingProvider extends EventEmitter {
  private apiKey: string | undefined;
  private transcriber: StreamingTranscriber | null = null;
  private sessionActive = false;
  private chunkCount = 0;

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey;
  }

  updateApiKey(apiKey?: string): void {
    this.apiKey = apiKey;
  }

  isActive(): boolean {
    return this.sessionActive;
  }

  hasKey(): boolean {
    return Boolean(this.apiKey);
  }

  async start(sampleRate = 16000): Promise<void> {
    if (this.sessionActive) {
      throw new Error('Streaming session already active');
    }
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    const client = new AssemblyAI({ apiKey: this.apiKey });
    const transcriber = client.streaming.transcriber({
      sampleRate,
      speechModel: 'u3-rt-pro',
      encoding: 'pcm_s16le',
      formatTurns: true,
    });

    transcriber.on('open', (event: BeginEvent) => {
      const out: StreamingOpenEvent = {
        sessionId: event.id,
        expiresAt: event.expires_at,
      };
      this.emit('open', out);
    });

    transcriber.on('turn', (event: TurnEvent) => {
      console.log(
        `[AssemblyAI] turn end_of_turn=${event.end_of_turn} formatted=${event.turn_is_formatted} words=${event.words?.length ?? 0} text="${(event.transcript ?? '').slice(0, 100)}"`
      );
      const out: StreamingTurnEvent = {
        transcript: event.transcript || '',
        endOfTurn: Boolean(event.end_of_turn),
        words: event.words,
      };
      this.emit('turn', out);
    });

    transcriber.on('warning', (event: WarningEvent) => {
      console.warn(`[AssemblyAI] warning code=${event.warning_code} ${event.warning}`);
    });

    transcriber.on('error', (err: Error) => {
      this.emit('error', err);
    });

    transcriber.on('close', (code: number, reason: string) => {
      this.sessionActive = false;
      this.emit('close', { code, reason });
    });

    this.transcriber = transcriber;
    this.chunkCount = 0;
    await transcriber.connect();
    this.sessionActive = true;
  }

  sendAudio(chunk: Buffer): void {
    if (!this.transcriber || !this.sessionActive) {
      return;
    }
    // SDK expects ArrayBufferLike; expose the underlying bytes of the Buffer.
    const ab = chunk.buffer.slice(
      chunk.byteOffset,
      chunk.byteOffset + chunk.byteLength
    ) as ArrayBuffer;
    this.chunkCount++;
    if (this.chunkCount === 1 || this.chunkCount % 20 === 0) {
      const pcm = new Int16Array(ab);
      let maxAbs = 0;
      for (let i = 0; i < pcm.length; i++) {
        const v = Math.abs(pcm[i]);
        if (v > maxAbs) maxAbs = v;
      }
      const durMs = ((pcm.length / 16000) * 1000).toFixed(1);
      console.log(
        `[AssemblyAI] chunk #${this.chunkCount} bytes=${ab.byteLength} samples=${pcm.length} durMs=${durMs} peakAbs=${maxAbs}`
      );
    }
    this.transcriber.sendAudio(ab);
  }

  /** Force the current turn to end and emit a final immediately. */
  forceEndpoint(): void {
    if (this.transcriber && this.sessionActive) {
      this.transcriber.forceEndpoint();
    }
  }

  async stop(): Promise<void> {
    const t = this.transcriber;
    this.transcriber = null;
    this.sessionActive = false;
    if (!t) return;

    // Nudge AssemblyAI to emit the final formatted turn promptly before we
    // initiate close. Without this, the server may not emit the final
    // "Turn" event until well after the close-ack window, leaving us
    // with a missing transcript.
    try {
      t.forceEndpoint();
    } catch (err) {
      // socket may already be closing — non-fatal
      console.warn('[AssemblyAIStreaming] forceEndpoint() raised:', err);
    }

    // Bound the close — a dead WebSocket would otherwise leave the SDK
    // awaiting a Termination ack that will never come.
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(
          '[AssemblyAIStreaming] close() exceeded timeout; abandoning session.'
        );
        resolve();
      }, CLOSE_TIMEOUT_MS);
    });

    try {
      await Promise.race([
        t.close(true).catch((err) => {
          console.warn('[AssemblyAIStreaming] close() raised:', err);
        }),
        timeout,
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}
