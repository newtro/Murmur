// ============================================================================
// Transcription Service - Unified interface for all transcription providers
// ============================================================================

import { TranscriptionProvider, TranscriptionResult, ApiKeys } from '../../../shared/types';
import { GroqTranscriptionProvider } from './groq';
import { OpenAITranscriptionProvider } from './openai';
import { WhisperLocalProvider } from './whisper-local';

interface TranscriptionOptions {
  provider: TranscriptionProvider;
  model: string;
  language?: string;
}

export class TranscriptionService {
  private apiKeys: ApiKeys;
  private groqProvider: GroqTranscriptionProvider;
  private openaiProvider: OpenAITranscriptionProvider;
  private whisperProvider: WhisperLocalProvider;

  constructor(apiKeys: ApiKeys) {
    this.apiKeys = apiKeys;
    this.groqProvider = new GroqTranscriptionProvider(apiKeys.groq);
    this.openaiProvider = new OpenAITranscriptionProvider(apiKeys.openai);
    this.whisperProvider = new WhisperLocalProvider();
  }

  async transcribe(
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const { provider, model, language } = options;

    console.log(`[TranscriptionService] Transcribing with ${provider}/${model}`);

    switch (provider) {
      case 'groq':
        return this.groqProvider.transcribe(audioBuffer, model, language);

      case 'openai':
        return this.openaiProvider.transcribe(audioBuffer, model, language);

      case 'whisper-local':
        return this.whisperProvider.transcribe(audioBuffer, model, language);

      default:
        throw new Error(`Unknown transcription provider: ${provider}`);
    }
  }

  updateApiKeys(apiKeys: ApiKeys): void {
    this.apiKeys = apiKeys;
    this.groqProvider.updateApiKey(apiKeys.groq);
    this.openaiProvider.updateApiKey(apiKeys.openai);
  }

  async validateGroqKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    return this.groqProvider.validateKey(apiKey);
  }

  async validateOpenAIKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    return this.openaiProvider.validateKey(apiKey);
  }

  // Check if whisper model is downloaded
  async isWhisperModelAvailable(model: string): Promise<boolean> {
    return this.whisperProvider.isModelAvailable(model);
  }

  // Download whisper model
  async downloadWhisperModel(
    model: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return this.whisperProvider.downloadModel(model, onProgress);
  }
}
