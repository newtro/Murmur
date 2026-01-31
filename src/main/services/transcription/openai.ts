// ============================================================================
// OpenAI Transcription Provider
// ============================================================================

import OpenAI from 'openai';
import { TranscriptionResult } from '../../../shared/types';

export class OpenAITranscriptionProvider {
  private client: OpenAI | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  updateApiKey(apiKey?: string): void {
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
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
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();

    // Convert Buffer to File for the API
    const arrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer;

    const file = new File([arrayBuffer], 'audio.wav', { type: 'audio/wav' });

    // gpt-4o-mini-transcribe and similar models don't support verbose_json
    const useVerboseJson = !model?.includes('transcribe');
    const responseFormat = useVerboseJson ? 'verbose_json' : 'json';

    const response = await this.client.audio.transcriptions.create({
      file,
      model: model || 'whisper-1',
      language: language || undefined,
      response_format: responseFormat,
    });

    const duration = (Date.now() - startTime) / 1000;

    // verbose_json includes language and segments, json format does not
    const verboseResponse = response as {
      text: string;
      language?: string;
      segments?: Array<{ start: number; end: number; text: string }>;
    };

    return {
      text: response.text,
      duration,
      language: verboseResponse.language,
      segments: verboseResponse.segments?.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
    };
  }

  async validateKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const testClient = new OpenAI({ apiKey });
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
