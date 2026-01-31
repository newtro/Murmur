// ============================================================================
// Anthropic (Claude) LLM Provider
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';

export class AnthropicLLMProvider {
  private client: Anthropic | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  updateApiKey(apiKey?: string): void {
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.client = null;
    }
  }

  async complete(prompt: string, model: string): Promise<string> {
    if (!this.client) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await this.client.messages.create({
      model: model || 'claude-3-5-haiku-latest',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }

    return '';
  }

  async validateKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const testClient = new Anthropic({ apiKey });
      // Make a minimal request to validate
      await testClient.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid API key',
      };
    }
  }
}
