// ============================================================================
// Application Constants
// ============================================================================

// Overlay Window Dimensions
export const OVERLAY = {
  width: 280,
  height: 56,
  margin: 100, // Distance from bottom of screen
};

// Key Codes for uiohook-napi
export const KEY_CODES: Record<string, number> = {
  Backquote: 41,     // ` key
  Escape: 1,
  F1: 59,
  F2: 60,
  F3: 61,
  F4: 62,
  F5: 63,
  F6: 64,
  F7: 65,
  F8: 66,
  F9: 67,
  F10: 68,
  F11: 87,
  F12: 88,
  Space: 57,
  Enter: 28,
  Tab: 15,
  CapsLock: 58,
  ShiftLeft: 42,
  ShiftRight: 54,
  ControlLeft: 29,
  ControlRight: 3613,
  AltLeft: 56,
  AltRight: 3640,
};

// Audio Settings
export const AUDIO = {
  sampleRate: 16000,      // 16kHz for Whisper
  channels: 1,            // Mono
  bitDepth: 16,           // 16-bit
  maxDuration: 300000,    // 5 minutes max
  silenceThreshold: 0.01,
  silenceTimeout: 2000,   // Stop after 2s of silence
};

// Processing Prompts
export const PROCESSING_PROMPTS = {
  clean: `You are a transcription cleanup assistant. Your task is to:
1. Remove filler words (um, uh, like, you know, etc.)
2. Add proper punctuation and capitalization
3. Fix obvious grammatical errors
4. Keep the original meaning and tone intact
5. Do NOT add or remove substantive content

Return ONLY the cleaned text, nothing else.`,

  polish: `You are a professional writing assistant. Your task is to:
1. Remove all filler words and verbal tics
2. Add proper punctuation and capitalization
3. Fix grammar and improve clarity
4. Restructure sentences for better flow if needed
5. Maintain the speaker's voice and intent
6. Make it sound natural and professional

Return ONLY the polished text, nothing else.`,
};

// Supported Languages
export const LANGUAGES = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
];

// Transcription Models
export const TRANSCRIPTION_MODELS = {
  groq: [
    { id: 'whisper-large-v3', name: 'Whisper Large V3', description: 'Best accuracy' },
    { id: 'whisper-large-v3-turbo', name: 'Whisper Large V3 Turbo', description: 'Faster, slightly less accurate' },
  ],
  openai: [
    { id: 'gpt-4o-transcribe', name: 'GPT-4o Transcribe', description: 'Best accuracy ($0.006/min)' },
    { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o Mini Transcribe', description: 'Good accuracy ($0.003/min)' },
    { id: 'whisper-1', name: 'Whisper-1', description: 'Classic Whisper API' },
  ],
  'whisper-local': [
    { id: 'tiny', name: 'Tiny', description: '75MB - Fastest' },
    { id: 'base', name: 'Base', description: '142MB - Balanced' },
    { id: 'small', name: 'Small', description: '466MB - Better accuracy' },
    { id: 'medium', name: 'Medium', description: '1.5GB - High accuracy' },
    { id: 'large-v3-turbo', name: 'Large V3 Turbo', description: '1.6GB - Best' },
  ],
};

// LLM Models
export const LLM_MODELS = {
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Balanced performance' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High capability' },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', description: 'Fast and efficient' },
    { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', description: 'Best balance' },
    { id: 'claude-3-opus-latest', name: 'Claude 3 Opus', description: 'Most capable' },
  ],
  gemini: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and free tier' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Advanced reasoning' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Fast inference' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Good for coding' },
  ],
  ollama: [
    { id: 'llama3.2', name: 'Llama 3.2', description: 'Local, free' },
    { id: 'mistral', name: 'Mistral', description: 'Local, efficient' },
    { id: 'phi3', name: 'Phi-3', description: 'Local, small' },
  ],
};
