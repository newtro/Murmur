// ============================================================================
// OpenAI LLM Provider
// ============================================================================

import OpenAI from 'openai';

export class OpenAILLMProvider {
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

  async complete(prompt: string, model: string): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await this.client.chat.completions.create({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || '';
  }
}
