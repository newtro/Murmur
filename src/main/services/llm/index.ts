// ============================================================================
// LLM Service - Unified interface for all LLM providers
// ============================================================================

import { LLMProvider, LLMResult, ProcessingMode, ApiKeys } from '../../../shared/types';
import { PROCESSING_PROMPTS } from '../../../shared/constants';
import { OpenAILLMProvider } from './openai';
import { AnthropicLLMProvider } from './anthropic';
import { GeminiLLMProvider } from './gemini';
import { GroqLLMProvider } from './groq';
import { OllamaLLMProvider } from './ollama';

interface ProcessOptions {
  provider: LLMProvider;
  model: string;
  processingMode: ProcessingMode;
}

export class LLMService {
  private apiKeys: ApiKeys;
  private openaiProvider: OpenAILLMProvider;
  private anthropicProvider: AnthropicLLMProvider;
  private geminiProvider: GeminiLLMProvider;
  private groqProvider: GroqLLMProvider;
  private ollamaProvider: OllamaLLMProvider;

  constructor(apiKeys: ApiKeys) {
    this.apiKeys = apiKeys;
    this.openaiProvider = new OpenAILLMProvider(apiKeys.openai);
    this.anthropicProvider = new AnthropicLLMProvider(apiKeys.anthropic);
    this.geminiProvider = new GeminiLLMProvider(apiKeys.gemini);
    this.groqProvider = new GroqLLMProvider(apiKeys.groq);
    this.ollamaProvider = new OllamaLLMProvider();
  }

  async process(text: string, options: ProcessOptions): Promise<LLMResult> {
    const { provider, model, processingMode } = options;

    if (processingMode === 'raw') {
      return {
        originalText: text,
        processedText: text,
        provider,
        model,
      };
    }

    const prompt = PROCESSING_PROMPTS[processingMode];
    const fullPrompt = `${prompt}\n\nText to process:\n${text}`;

    console.log(`[LLMService] Processing with ${provider}/${model} in ${processingMode} mode`);

    let processedText: string;

    switch (provider) {
      case 'openai':
        processedText = await this.openaiProvider.complete(fullPrompt, model);
        break;

      case 'anthropic':
        processedText = await this.anthropicProvider.complete(fullPrompt, model);
        break;

      case 'gemini':
        processedText = await this.geminiProvider.complete(fullPrompt, model);
        break;

      case 'groq':
        processedText = await this.groqProvider.complete(fullPrompt, model);
        break;

      case 'ollama':
        processedText = await this.ollamaProvider.complete(fullPrompt, model);
        break;

      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }

    return {
      originalText: text,
      processedText,
      provider,
      model,
    };
  }

  updateApiKeys(apiKeys: ApiKeys): void {
    this.apiKeys = apiKeys;
    this.openaiProvider.updateApiKey(apiKeys.openai);
    this.anthropicProvider.updateApiKey(apiKeys.anthropic);
    this.geminiProvider.updateApiKey(apiKeys.gemini);
    this.groqProvider.updateApiKey(apiKeys.groq);
  }

  async validateAnthropicKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    return this.anthropicProvider.validateKey(apiKey);
  }

  async validateGeminiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    return this.geminiProvider.validateKey(apiKey);
  }
}
