import React, { useState } from 'react';
import { Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { AppSettings } from '../../../shared/types';

interface ApiKeysProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
  saving: boolean;
}

interface ProviderConfig {
  id: keyof AppSettings['apiKeys'];
  name: string;
  description: string;
  placeholder: string;
  docsUrl: string;
}

const providers: ProviderConfig[] = [
  {
    id: 'groq',
    name: 'Groq',
    description: 'Fast inference for Whisper and LLMs',
    placeholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models and Whisper transcription',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models for text processing',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini models for text processing',
    placeholder: 'AIza...',
    docsUrl: 'https://makersuite.google.com/app/apikey',
  },
];

export function ApiKeys({ settings, onUpdate, saving }: ApiKeysProps) {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState<Record<string, boolean>>({});
  const [validationResults, setValidationResults] = useState<Record<string, { valid: boolean; error?: string }>>({});

  const toggleShowKey = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleKeyChange = async (id: keyof AppSettings['apiKeys'], value: string) => {
    await onUpdate({
      apiKeys: {
        ...settings.apiKeys,
        [id]: value,
      },
    });
  };

  const validateKey = async (id: keyof AppSettings['apiKeys']) => {
    const key = settings.apiKeys[id];
    if (!key) return;

    setValidating((prev) => ({ ...prev, [id]: true }));
    setValidationResults((prev) => ({ ...prev, [id]: undefined as unknown as { valid: boolean } }));

    try {
      const result = await window.murmur.validateApiKey(id, key);
      setValidationResults((prev) => ({ ...prev, [id]: result }));
    } catch (error) {
      setValidationResults((prev) => ({
        ...prev,
        [id]: { valid: false, error: 'Validation failed' },
      }));
    } finally {
      setValidating((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">API Keys</h2>
        <p className="text-gray-400 text-sm">
          Configure your API keys for transcription and text processing services.
          Your keys are stored locally and never sent to our servers.
        </p>
      </div>

      <div className="space-y-4">
        {providers.map((provider) => {
          const key = settings.apiKeys[provider.id] || '';
          const isValidating = validating[provider.id];
          const result = validationResults[provider.id];

          return (
            <div
              key={provider.id}
              className="bg-gray-800 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{provider.name}</h3>
                  <p className="text-sm text-gray-400">{provider.description}</p>
                </div>
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Get API Key
                </a>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKeys[provider.id] ? 'text' : 'password'}
                    value={key}
                    onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                    placeholder={provider.placeholder}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 pr-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey(provider.id)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showKeys[provider.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <button
                  onClick={() => validateKey(provider.id)}
                  disabled={!key || isValidating}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {isValidating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test'
                  )}
                </button>
              </div>

              {result && (
                <div
                  className={`flex items-center gap-2 text-sm ${
                    result.valid ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {result.valid ? (
                    <>
                      <Check size={16} />
                      API key is valid
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} />
                      {result.error || 'Invalid API key'}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ollama Section */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        <div>
          <h3 className="font-medium">Ollama (Local)</h3>
          <p className="text-sm text-gray-400">
            Run models locally with Ollama. No API key required.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span>Make sure Ollama is running on your machine</span>
        </div>
        <a
          href="https://ollama.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-blue-400 hover:text-blue-300"
        >
          Download Ollama
        </a>
      </div>
    </div>
  );
}
