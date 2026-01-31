// ============================================================================
// Groq Transcription Provider
// ============================================================================

import Groq from 'groq-sdk';
import { TranscriptionResult } from '../../../shared/types';

export class GroqTranscriptionProvider {
  private client: Groq | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new Groq({ apiKey });
    }
  }

  updateApiKey(apiKey?: string): void {
    if (apiKey) {
      this.client = new Groq({ apiKey });
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
      throw new Error('Groq API key not configured');
    }

    const startTime = Date.now();

    // Convert Buffer to Blob for the API
    const arrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer;

    const file = new File([arrayBuffer], 'audio.wav', { type: 'audio/wav' });

    const response = await this.client.audio.transcriptions.create({
      file,
      model: model || 'whisper-large-v3',
      language: language || undefined,
      response_format: 'verbose_json',
    });

    const duration = (Date.now() - startTime) / 1000;

    return {
      text: response.text,
      duration,
      language: response.language,
      segments: response.segments?.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
    };
  }

  async validateKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const testClient = new Groq({ apiKey });
      // Try to list models as a simple validation
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
