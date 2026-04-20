// ============================================================================
// Transcription Service - Unified interface for all transcription providers
// ============================================================================

import { TranscriptionProvider, TranscriptionResult, ApiKeys } from '../../../shared/types';
import { GroqTranscriptionProvider } from './groq';
import { OpenAITranscriptionProvider } from './openai';
import { WhisperLocalProvider } from './whisper-local';
import { MistralTranscriptionProvider } from './mistral';
import { classifyTranscriptionError, ClassifiedTranscriptionError } from './errors';

interface TranscriptionOptions {
  provider: TranscriptionProvider;
  model: string;
  language?: string;
  fallback?: {
    provider: TranscriptionProvider;
    model: string;
  };
}

export interface TranscribeOutcome {
  result: TranscriptionResult;
  providerUsed: TranscriptionProvider;
  fallbackUsed: boolean;
  primaryError?: ClassifiedTranscriptionError;
}

export class TranscriptionService {
  private apiKeys: ApiKeys;
  private groqProvider: GroqTranscriptionProvider;
  private openaiProvider: OpenAITranscriptionProvider;
  private whisperProvider: WhisperLocalProvider;
  private mistralProvider: MistralTranscriptionProvider;

  constructor(apiKeys: ApiKeys) {
    this.apiKeys = apiKeys;
    this.groqProvider = new GroqTranscriptionProvider(apiKeys.groq);
    this.openaiProvider = new OpenAITranscriptionProvider(apiKeys.openai);
    this.whisperProvider = new WhisperLocalProvider();
    this.mistralProvider = new MistralTranscriptionProvider(apiKeys.mistral);
  }

  async transcribe(
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<TranscribeOutcome> {
    const { provider, model, language, fallback } = options;

    console.log(`[TranscriptionService] Transcribing with ${provider}/${model}`);

    try {
      const result = await this.runProvider(audioBuffer, provider, model, language);
      return { result, providerUsed: provider, fallbackUsed: false };
    } catch (error) {
      const classified = classifyTranscriptionError(error, provider);
      console.error(`[TranscriptionService] Primary provider ${provider} failed:`, classified);

      if (fallback && classified.retryable && this.hasKeyFor(fallback.provider)) {
        console.log(`[TranscriptionService] Retrying with fallback ${fallback.provider}/${fallback.model}`);
        try {
          const result = await this.runProvider(audioBuffer, fallback.provider, fallback.model, language);
          return {
            result,
            providerUsed: fallback.provider,
            fallbackUsed: true,
            primaryError: classified,
          };
        } catch (fallbackError) {
          const fallbackClassified = classifyTranscriptionError(fallbackError, fallback.provider);
          console.error(`[TranscriptionService] Fallback ${fallback.provider} also failed:`, fallbackClassified);
          const combined = new Error(fallbackClassified.userMessage) as Error & {
            classified: ClassifiedTranscriptionError;
            primary: ClassifiedTranscriptionError;
          };
          combined.classified = fallbackClassified;
          combined.primary = classified;
          throw combined;
        }
      }

      const err = new Error(classified.userMessage) as Error & { classified: ClassifiedTranscriptionError };
      err.classified = classified;
      throw err;
    }
  }

  private runProvider(
    audioBuffer: Buffer,
    provider: TranscriptionProvider,
    model: string,
    language?: string
  ): Promise<TranscriptionResult> {
    switch (provider) {
      case 'groq':
        return this.groqProvider.transcribe(audioBuffer, model, language);
      case 'openai':
        return this.openaiProvider.transcribe(audioBuffer, model, language);
      case 'whisper-local':
        return this.whisperProvider.transcribe(audioBuffer, model, language);
      case 'mistral':
        return this.mistralProvider.transcribe(audioBuffer, model, language);
      default:
        throw new Error(`Unknown transcription provider: ${provider}`);
    }
  }

  private hasKeyFor(provider: TranscriptionProvider): boolean {
    if (provider === 'whisper-local') return true;
    return Boolean(this.apiKeys[provider]);
  }

  updateApiKeys(apiKeys: ApiKeys): void {
    this.apiKeys = apiKeys;
    this.groqProvider.updateApiKey(apiKeys.groq);
    this.openaiProvider.updateApiKey(apiKeys.openai);
    this.mistralProvider.updateApiKey(apiKeys.mistral);
  }

  async validateGroqKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    return this.groqProvider.validateKey(apiKey);
  }

  async validateOpenAIKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    return this.openaiProvider.validateKey(apiKey);
  }

  async validateMistralKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    return this.mistralProvider.validateKey(apiKey);
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
