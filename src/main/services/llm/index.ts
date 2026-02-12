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
import { MistralLLMProvider } from './mistral';

/** Regex to strip common LLM preamble patterns */
const PREAMBLE_REGEX = /^(?:Here(?:'s| is) (?:the |your )?(?:corrected|rewritten|revised|formal|casual|shortened|concise|proofread|updated|improved|polished|edited|cleaned|clean|processed)[\w ]*?(?:text|version|output)?[:\-\s]*\n+)/i;

/**
 * Try to extract text from a JSON response like {"text": "..."}.
 * Returns the extracted text, or null if parsing fails.
 */
function extractJsonText(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.text === 'string') {
      return parsed.text;
    }
  } catch {
    // Not valid JSON — fall through
  }
  return null;
}

/**
 * Strip preamble and wrapping quotes from raw LLM output.
 * Used as a fallback when JSON parsing fails.
 */
function stripPreamble(text: string): string {
  let result = text.replace(PREAMBLE_REGEX, '');

  // Strip wrapping quotes if the LLM wrapped the entire output in them
  if (/^[""].*[""]$/s.test(result.trim())) {
    result = result.trim().slice(1, -1);
  }

  return result;
}

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
  private mistralProvider: MistralLLMProvider;

  constructor(apiKeys: ApiKeys) {
    this.apiKeys = apiKeys;
    this.openaiProvider = new OpenAILLMProvider(apiKeys.openai);
    this.anthropicProvider = new AnthropicLLMProvider(apiKeys.anthropic);
    this.geminiProvider = new GeminiLLMProvider(apiKeys.gemini);
    this.groqProvider = new GroqLLMProvider(apiKeys.groq);
    this.ollamaProvider = new OllamaLLMProvider();
    this.mistralProvider = new MistralLLMProvider(apiKeys.mistral);
  }

  /**
   * Complete a prompt using JSON mode for the given provider.
   * Falls back to regular completion if JSON mode fails.
   */
  private async completeWithJsonMode(prompt: string, provider: LLMProvider, model: string): Promise<string> {
    let rawJson: string;

    try {
      switch (provider) {
        case 'openai':
          rawJson = await this.openaiProvider.completeJson(prompt, model);
          break;
        case 'anthropic':
          rawJson = await this.anthropicProvider.completeJson(prompt, model);
          break;
        case 'gemini':
          rawJson = await this.geminiProvider.completeJson(prompt, model);
          break;
        case 'groq':
          rawJson = await this.groqProvider.completeJson(prompt, model);
          break;
        case 'ollama':
          rawJson = await this.ollamaProvider.completeJson(prompt, model);
          break;
        case 'mistral':
          rawJson = await this.mistralProvider.completeJson(prompt, model);
          break;
        default:
          throw new Error(`Unknown LLM provider: ${provider}`);
      }

      // Try to extract text from JSON
      const extracted = extractJsonText(rawJson);
      if (extracted !== null) {
        console.log(`[LLMService] Successfully extracted text from JSON response`);
        return extracted;
      }

      // JSON mode returned something but it wasn't parseable — strip preamble as fallback
      console.warn(`[LLMService] JSON mode response was not valid JSON, falling back to preamble stripping`);
      return stripPreamble(rawJson);
    } catch (error) {
      // JSON mode itself failed (e.g. provider doesn't support it for this model) —
      // fall back to regular completion + preamble stripping
      console.warn(`[LLMService] JSON mode failed for ${provider}, falling back to regular completion:`, error);
      const raw = await this.completeRaw(prompt, provider, model);
      return stripPreamble(raw);
    }
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

    const processedText = await this.completeWithJsonMode(fullPrompt, provider, model);

    return {
      originalText: text,
      processedText,
      provider,
      model,
    };
  }

  /**
   * Send a raw prompt to the specified provider and return the completion text.
   * Used by text correction to send custom prompts directly.
   */
  async completeRaw(prompt: string, provider: LLMProvider, model: string): Promise<string> {
    console.log(`[LLMService] Raw completion with ${provider}/${model}`);

    switch (provider) {
      case 'openai':
        return this.openaiProvider.complete(prompt, model);
      case 'anthropic':
        return this.anthropicProvider.complete(prompt, model);
      case 'gemini':
        return this.geminiProvider.complete(prompt, model);
      case 'groq':
        return this.groqProvider.complete(prompt, model);
      case 'ollama':
        return this.ollamaProvider.complete(prompt, model);
      case 'mistral':
        return this.mistralProvider.complete(prompt, model);
      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }

  /**
   * Send a raw prompt using JSON mode, with extraction and fallback.
   * Used by text correction to get clean output.
   */
  async completeRawJson(prompt: string, provider: LLMProvider, model: string): Promise<string> {
    console.log(`[LLMService] Raw JSON completion with ${provider}/${model}`);
    return this.completeWithJsonMode(prompt, provider, model);
  }

  updateApiKeys(apiKeys: ApiKeys): void {
    this.apiKeys = apiKeys;
    this.openaiProvider.updateApiKey(apiKeys.openai);
    this.anthropicProvider.updateApiKey(apiKeys.anthropic);
    this.geminiProvider.updateApiKey(apiKeys.gemini);
    this.groqProvider.updateApiKey(apiKeys.groq);
    this.mistralProvider.updateApiKey(apiKeys.mistral);
  }

  async validateMistralKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    return this.mistralProvider.validateKey(apiKey);
  }

  async validateAnthropicKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    return this.anthropicProvider.validateKey(apiKey);
  }

  async validateGeminiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    return this.geminiProvider.validateKey(apiKey);
  }
}
