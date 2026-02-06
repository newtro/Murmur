import React from 'react';
import { Mic, Brain, Zap, HardDrive } from 'lucide-react';
import type { AppSettings, TranscriptionProvider, LLMProvider, ProcessingMode } from '../../../shared/types';

interface ModelsProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
  saving: boolean;
}

interface TranscriptionOption {
  id: TranscriptionProvider;
  name: string;
  description: string;
  models: { id: string; name: string; description: string }[];
  requiresKey: boolean;
}

interface LLMOption {
  id: LLMProvider;
  name: string;
  description: string;
  models: { id: string; name: string; description: string }[];
  requiresKey: boolean;
}

const transcriptionProviders: TranscriptionOption[] = [
  {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast cloud transcription',
    requiresKey: true,
    models: [
      { id: 'whisper-large-v3', name: 'Whisper Large V3', description: 'Best accuracy' },
      { id: 'whisper-large-v3-turbo', name: 'Whisper Large V3 Turbo', description: 'Faster, slightly less accurate' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'High-quality transcription',
    requiresKey: true,
    models: [
      { id: 'gpt-4o-transcribe', name: 'GPT-4o Transcribe', description: 'Best accuracy' },
      { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o Mini Transcribe', description: 'Cost-effective' },
      { id: 'whisper-1', name: 'Whisper-1', description: 'Classic Whisper' },
    ],
  },
  {
    id: 'whisper-local',
    name: 'Local (whisper.cpp)',
    description: 'Offline transcription',
    requiresKey: false,
    models: [
      { id: 'tiny', name: 'Tiny', description: '75MB, fastest' },
      { id: 'base', name: 'Base', description: '142MB, good balance' },
      { id: 'small', name: 'Small', description: '466MB, better accuracy' },
      { id: 'medium', name: 'Medium', description: '1.5GB, high accuracy' },
      { id: 'large-v3-turbo', name: 'Large V3 Turbo', description: '1.6GB, best quality' },
    ],
  },
];

const llmProviders: LLMOption[] = [
  {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast inference',
    requiresKey: true,
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Best quality' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Fastest' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models',
    requiresKey: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Best quality' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and cost-effective' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models',
    requiresKey: true,
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Best balance' },
      { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', description: 'Fastest' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini models',
    requiresKey: true,
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast and capable' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Best quality' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Run models locally',
    requiresKey: false,
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', description: 'Good general purpose' },
      { id: 'mistral', name: 'Mistral', description: 'Fast and efficient' },
      { id: 'phi3', name: 'Phi-3', description: 'Lightweight' },
    ],
  },
];

const processingModes: { id: ProcessingMode; name: string; description: string }[] = [
  { id: 'raw', name: 'Raw', description: 'No AI processing, just transcription' },
  { id: 'clean', name: 'Clean', description: 'Remove filler words, add punctuation' },
  { id: 'polish', name: 'Polish', description: 'Full rewrite for clarity and grammar' },
];

export function Models({ settings, onUpdate }: ModelsProps) {
  const handleTranscriptionProviderChange = async (provider: TranscriptionProvider) => {
    const providerConfig = transcriptionProviders.find((p) => p.id === provider);
    const defaultModel = providerConfig?.models[0]?.id || '';

    await onUpdate({
      transcriptionProvider: provider,
      transcriptionModel: defaultModel,
    });
  };

  const handleTranscriptionModelChange = async (model: string) => {
    await onUpdate({ transcriptionModel: model });
  };

  const handleLLMProviderChange = async (provider: LLMProvider) => {
    const providerConfig = llmProviders.find((p) => p.id === provider);
    const defaultModel = providerConfig?.models[0]?.id || '';

    await onUpdate({
      llmProvider: provider,
      llmModel: defaultModel,
    });
  };

  const handleLLMModelChange = async (model: string) => {
    await onUpdate({ llmModel: model });
  };

  const handleProcessingModeChange = async (mode: ProcessingMode) => {
    await onUpdate({ processingMode: mode });
  };

  const handleLanguageChange = async (language: string) => {
    await onUpdate({ language });
  };

  const currentTranscriptionProvider = transcriptionProviders.find(
    (p) => p.id === settings.transcriptionProvider
  );

  const currentLLMProvider = llmProviders.find(
    (p) => p.id === settings.llmProvider
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Model Configuration</h2>
        <p className="text-gray-400 text-sm">
          Choose your transcription and text processing providers.
        </p>
      </div>

      {/* Transcription Provider */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Mic size={20} className="text-blue-400" />
          <h3 className="font-medium">Transcription</h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {transcriptionProviders.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleTranscriptionProviderChange(provider.id)}
              className={`
                p-3 rounded-lg border text-left transition-colors
                ${settings.transcriptionProvider === provider.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600'
                }
              `}
            >
              <div className="font-medium text-sm">{provider.name}</div>
              <div className="text-xs text-gray-400">{provider.description}</div>
            </button>
          ))}
        </div>

        {currentTranscriptionProvider && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">Model</label>
            <select
              value={settings.transcriptionModel}
              onChange={(e) => handleTranscriptionModelChange(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none"
            >
              {currentTranscriptionProvider.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} - {model.description}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Processing Mode */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-yellow-400" />
          <h3 className="font-medium">Processing Mode</h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {processingModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleProcessingModeChange(mode.id)}
              className={`
                p-3 rounded-lg border text-left transition-colors
                ${settings.processingMode === mode.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600'
                }
              `}
            >
              <div className="font-medium text-sm">{mode.name}</div>
              <div className="text-xs text-gray-400">{mode.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* LLM Provider (only shown if processing mode is not raw) */}
      {settings.processingMode !== 'raw' && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-purple-400" />
            <h3 className="font-medium">Text Processing (LLM)</h3>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {llmProviders.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleLLMProviderChange(provider.id)}
                className={`
                  p-3 rounded-lg border text-left transition-colors
                  ${settings.llmProvider === provider.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                  }
                `}
              >
                <div className="font-medium text-sm">{provider.name}</div>
                <div className="text-xs text-gray-400">{provider.description}</div>
              </button>
            ))}
          </div>

          {currentLLMProvider && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Model</label>
              <select
                value={settings.llmModel}
                onChange={(e) => handleLLMModelChange(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none"
              >
                {currentLLMProvider.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Language */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <HardDrive size={20} className="text-green-400" />
          <h3 className="font-medium">Language</h3>
        </div>

        <select
          value={settings.language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none"
        >
          <option value="auto">Auto-detect</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
          <option value="nl">Dutch</option>
          <option value="pl">Polish</option>
          <option value="ru">Russian</option>
          <option value="zh">Chinese</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
        </select>
      </div>
    </div>
  );
}
