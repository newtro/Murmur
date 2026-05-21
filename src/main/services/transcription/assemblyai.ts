// ============================================================================
// AssemblyAI Transcription Provider (batch / async)
// ============================================================================

import { AssemblyAI, type TranscribeParams } from 'assemblyai';
import { TranscriptionResult } from '../../../shared/types';

// Models exposed in TRANSCRIPTION_MODELS.assemblyai. AssemblyAI's `speech_models`
// (plural) parameter accepts an array for automatic fallback — if the first
// model is unavailable, the next is tried. We always include `universal-2` as
// the fallback since it's the cheapest tier and most likely to be available.
type AssemblyAIModel = 'universal-3-pro' | 'universal-2';
const FALLBACK_MODEL: AssemblyAIModel = 'universal-2';

export class AssemblyAITranscriptionProvider {
  private client: AssemblyAI | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new AssemblyAI({ apiKey });
    }
  }

  updateApiKey(apiKey?: string): void {
    if (apiKey) {
      this.client = new AssemblyAI({ apiKey });
    } else {
      this.client = null;
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    model: string,
    language?: string
  ): Promise<TranscriptionResult> {
    if (!this.client) {
      throw new Error('AssemblyAI API key not configured');
    }

    const startTime = Date.now();
    const primary = this.normalizeModel(model);
    const models = primary === FALLBACK_MODEL ? [FALLBACK_MODEL] : [primary, FALLBACK_MODEL];

    const params: TranscribeParams = {
      audio: audioBuffer,
      speech_models: models,
    };

    if (language && language !== 'auto') {
      params.language_code = language;
    } else {
      params.language_detection = true;
    }

    const transcript = await this.client.transcripts.transcribe(params);

    if (transcript.status === 'error') {
      throw new Error(transcript.error || 'AssemblyAI transcription failed');
    }

    const duration = (Date.now() - startTime) / 1000;

    const words = transcript.words || undefined;
    const segments = words && words.length > 0
      ? this.wordsToSegments(words)
      : undefined;

    return {
      text: transcript.text || '',
      duration,
      language: transcript.language_code || undefined,
      segments,
    };
  }

  async validateKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const testClient = new AssemblyAI({ apiKey });
      await testClient.transcripts.list({ limit: 1 });
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid API key',
      };
    }
  }

  private normalizeModel(model: string): AssemblyAIModel {
    return model === 'universal-2' ? 'universal-2' : 'universal-3-pro';
  }

  // Group adjacent words into segments split by silence. AssemblyAI's batch API
  // returns word-level timestamps but no native segmentation; 700ms matches the
  // perceptual "end of clause" silence that other providers (Whisper) use.
  private wordsToSegments(
    words: Array<{ start: number; end: number; text: string }>
  ): Array<{ start: number; end: number; text: string }> {
    const segments: Array<{ start: number; end: number; text: string }> = [];
    const SEGMENT_GAP_MS = 700;
    let current: { start: number; end: number; text: string } | null = null;

    for (const word of words) {
      if (!current) {
        current = { start: word.start / 1000, end: word.end / 1000, text: word.text };
        continue;
      }
      const gapMs = word.start - current.end * 1000;
      if (gapMs > SEGMENT_GAP_MS) {
        segments.push(current);
        current = { start: word.start / 1000, end: word.end / 1000, text: word.text };
      } else {
        current.end = word.end / 1000;
        // No leading space before pure punctuation tokens (e.g. ",", ".")
        const needsSpace = !/^[\s,.;:!?)\]}"'`-]/.test(word.text);
        current.text += (needsSpace ? ' ' : '') + word.text;
      }
    }
    if (current) segments.push(current);
    return segments;
  }
}
