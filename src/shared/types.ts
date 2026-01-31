// ============================================================================
// Shared Types for Murmur
// ============================================================================

// Provider Types
export type TranscriptionProvider = 'whisper-local' | 'groq' | 'openai';
export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama';
export type ProcessingMode = 'raw' | 'clean' | 'polish';
export type ActivationMode = 'push-to-talk' | 'toggle';

// Overlay States
export type OverlayState = 'idle' | 'listening' | 'processing' | 'complete' | 'error';

// Audio Level for visualization
export interface AudioLevel {
  average: number;
  peak: number;
  frequencies: number[];
}

// API Keys
export interface ApiKeys {
  groq?: string;
  openai?: string;
  anthropic?: string;
  gemini?: string;
}

// Hotkey Configuration
export interface HotkeyConfig {
  pushToTalkKey: string;
  toggleKey: string;
  cancelKey: string;
  activationMode: ActivationMode;
}

// App Settings
export interface AppSettings {
  // Transcription
  transcriptionProvider: TranscriptionProvider;
  transcriptionModel: string;
  language: string;

  // LLM Processing
  llmProvider: LLMProvider;
  llmModel: string;
  processingMode: ProcessingMode;

  // API Keys
  apiKeys: ApiKeys;

  // Hotkeys
  hotkeys: HotkeyConfig;

  // Whisper Local
  whisperModelPath?: string;
  whisperModel: string;

  // UI
  overlayPosition: { x: number; y: number } | null;
  theme: 'light' | 'dark' | 'system';
}

// Default Settings
export const DEFAULT_SETTINGS: AppSettings = {
  transcriptionProvider: 'groq',
  transcriptionModel: 'whisper-large-v3',
  language: 'auto',

  llmProvider: 'groq',
  llmModel: 'llama-3.3-70b-versatile',
  processingMode: 'clean',

  apiKeys: {},

  hotkeys: {
    pushToTalkKey: 'Backquote',
    toggleKey: 'F2',
    cancelKey: 'Escape',
    activationMode: 'push-to-talk',
  },

  whisperModel: 'base',

  overlayPosition: null,
  theme: 'dark',
};

// Transcription Result
export interface TranscriptionResult {
  text: string;
  duration: number;
  language?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

// LLM Processing Result
export interface LLMResult {
  originalText: string;
  processedText: string;
  provider: LLMProvider;
  model: string;
}

// Transcription History Item
export interface TranscriptionHistoryItem {
  id: string;
  timestamp: number;
  originalText: string;
  processedText: string;
  duration: number;
  transcriptionProvider: TranscriptionProvider;
  llmProvider?: LLMProvider;
  processingMode: ProcessingMode;
  appName?: string;
}

// Whisper Model Info
export interface WhisperModelInfo {
  name: string;
  size: string;
  sizeBytes: number;
  description: string;
  url: string;
}

// Available Whisper Models
export const WHISPER_MODELS: Record<string, WhisperModelInfo> = {
  tiny: {
    name: 'tiny',
    size: '75 MB',
    sizeBytes: 75_000_000,
    description: 'Fastest, least accurate',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  },
  base: {
    name: 'base',
    size: '142 MB',
    sizeBytes: 142_000_000,
    description: 'Good balance of speed and accuracy',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  },
  small: {
    name: 'small',
    size: '466 MB',
    sizeBytes: 466_000_000,
    description: 'Better accuracy, slower',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  },
  medium: {
    name: 'medium',
    size: '1.5 GB',
    sizeBytes: 1_500_000_000,
    description: 'High accuracy, requires more resources',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
  },
  'large-v3-turbo': {
    name: 'large-v3-turbo',
    size: '1.6 GB',
    sizeBytes: 1_600_000_000,
    description: 'Best accuracy, optimized for speed',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
  },
};
