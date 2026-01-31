// ============================================================================
// Ollama (Local) LLM Provider
// ============================================================================

import { Ollama } from 'ollama';

export class OllamaLLMProvider {
  private client: Ollama;

  constructor(host: string = 'http://localhost:11434') {
    this.client = new Ollama({ host });
  }

  async complete(prompt: string, model: string): Promise<string> {
    const response = await this.client.generate({
      model: model || 'llama3.2',
      prompt,
      stream: false,
    });

    return response.response;
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.list();
      return response.models.map(m => m.name);
    } catch {
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }
}
