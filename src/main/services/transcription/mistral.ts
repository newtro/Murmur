// ============================================================================
// Mistral (Voxtral) Transcription Provider
// ============================================================================

import { Mistral } from '@mistralai/mistralai';
import { TranscriptionResult } from '../../../shared/types';

export class MistralTranscriptionProvider {
  private client: Mistral | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new Mistral({ apiKey });
    }
  }

  updateApiKey(apiKey?: string): void {
    if (apiKey) {
      this.client = new Mistral({ apiKey });
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
      throw new Error('Mistral API key not configured');
    }

    const startTime = Date.now();

    const response = await this.client.audio.transcriptions.complete({
      model: model || 'voxtral-mini-2602',
      file: {
        fileName: 'audio.wav',
        content: audioBuffer,
      },
      language: language || undefined,
      timestampGranularities: ['segment'],
    });

    const duration = (Date.now() - startTime) / 1000;

    return {
      text: response.text || '',
      duration,
      language: response.language || undefined,
      segments: response.segments?.map(seg => ({
        start: seg.start ?? 0,
        end: seg.end ?? 0,
        text: seg.text ?? '',
      })),
    };
  }

  async validateKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const testClient = new Mistral({ apiKey });
      await testClient.models.list();
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid API key',
      };
    }
  }
}
