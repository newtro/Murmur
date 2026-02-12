// ============================================================================
// Mistral LLM Provider
// ============================================================================

import { Mistral } from '@mistralai/mistralai';

export class MistralLLMProvider {
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

  async complete(prompt: string, model: string): Promise<string> {
    if (!this.client) {
      throw new Error('Mistral API key not configured');
    }

    const response = await this.client.chat.complete({
      model: model || 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
      temperature: 0.3,
    });

    return response.choices?.[0]?.message?.content as string || '';
  }

  async completeJson(prompt: string, model: string): Promise<string> {
    if (!this.client) {
      throw new Error('Mistral API key not configured');
    }

    const response = await this.client.chat.complete({
      model: model || 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
      temperature: 0.3,
      responseFormat: { type: 'json_object' },
    });

    return response.choices?.[0]?.message?.content as string || '';
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
