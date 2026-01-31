// ============================================================================
// Google Gemini LLM Provider
// ============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiLLMProvider {
  private client: GoogleGenerativeAI | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  updateApiKey(apiKey?: string): void {
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    } else {
      this.client = null;
    }
  }

  async complete(prompt: string, model: string): Promise<string> {
    if (!this.client) {
      throw new Error('Gemini API key not configured');
    }

    const genModel = this.client.getGenerativeModel({ model: model || 'gemini-2.5-flash' });
    const result = await genModel.generateContent(prompt);
    const response = await result.response;

    return response.text();
  }

  async validateKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const testClient = new GoogleGenerativeAI(apiKey);
      const model = testClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
      await model.generateContent('Hi');
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid API key',
      };
    }
  }
}
