// ============================================================================
// Groq LLM Provider
// ============================================================================

import Groq from 'groq-sdk';

export class GroqLLMProvider {
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

  async complete(prompt: string, model: string): Promise<string> {
    if (!this.client) {
      throw new Error('Groq API key not configured');
    }

    const response = await this.client.chat.completions.create({
      model: model || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || '';
  }

  async completeJson(prompt: string, model: string): Promise<string> {
    if (!this.client) {
      throw new Error('Groq API key not configured');
    }

    const response = await this.client.chat.completions.create({
      model: model || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    return response.choices[0]?.message?.content || '';
  }
}
