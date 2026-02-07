import React, { useState, useEffect, useCallback } from 'react';
import type { AppSettings, TranscriptionProvider, LLMProvider, ProcessingMode, TextCorrectionMode } from '../../../shared/types';
import {
  Zap,
  Bot,
  Monitor,
  Brain,
  Sparkles,
  FileText,
  Gem,
  Mic,
  Keyboard,
  Volume2,
  Target,
  RefreshCw,
  Eye,
  EyeOff,
  Square,
  Check,
  Settings as SettingsIcon,
  Loader2,
  Bug,
  Type,
  CheckCheck,
  PenLine,
  Briefcase,
  Coffee,
  Scissors,
  Wrench,
} from 'lucide-react';

// Modern dark theme
const theme = {
  bg: '#09090b',
  bgCard: '#18181b',
  bgHover: '#27272a',
  bgSelected: '#3f3f46',
  border: '#27272a',
  borderFocus: '#3b82f6',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  textDim: '#71717a',
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

// Provider configurations
const TRANSCRIPTION_PROVIDERS: {
  id: TranscriptionProvider;
  name: string;
  description: string;
  icon: React.ReactNode;
  requiresKey: boolean;
  keyName: string | null;
  models: { id: string; name: string; description: string }[];
}[] = [
  {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast cloud inference',
    icon: <Zap size={20} />,
    requiresKey: true,
    keyName: 'groq',
    models: [
      { id: 'whisper-large-v3-turbo', name: 'Whisper Large V3 Turbo', description: 'Best speed/accuracy' },
      { id: 'whisper-large-v3', name: 'Whisper Large V3', description: 'Highest accuracy' },
      { id: 'distil-whisper-large-v3-en', name: 'Distil Whisper V3', description: 'English optimized' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Industry standard Whisper',
    icon: <Bot size={20} />,
    requiresKey: true,
    keyName: 'openai',
    models: [
      { id: 'gpt-4o-transcribe', name: 'GPT-4o Transcribe', description: 'Best accuracy' },
      { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o Mini Transcribe', description: 'Fast & affordable' },
      { id: 'whisper-1', name: 'Whisper-1', description: 'Classic model' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    description: 'Voxtral transcription ($0.003/min)',
    icon: <Sparkles size={20} />,
    requiresKey: true,
    keyName: 'mistral',
    models: [
      { id: 'voxtral-mini-2602', name: 'Voxtral Mini Transcribe V2', description: 'Best accuracy' },
    ],
  },
  {
    id: 'whisper-local',
    name: 'Local',
    description: 'Privacy-first, runs on device',
    icon: <Monitor size={20} />,
    requiresKey: false,
    keyName: null,
    models: [
      { id: 'large-v3-turbo', name: 'Large V3 Turbo', description: '1.6GB - Best' },
      { id: 'medium', name: 'Medium', description: '1.5GB - High accuracy' },
      { id: 'small', name: 'Small', description: '466MB - Balanced' },
      { id: 'base', name: 'Base', description: '142MB - Faster' },
      { id: 'tiny', name: 'Tiny', description: '75MB - Fastest' },
    ],
  },
];

const LLM_PROVIDERS: {
  id: LLMProvider;
  name: string;
  description: string;
  icon: React.ReactNode;
  requiresKey: boolean;
  keyName: string | null;
  models: { id: string; name: string; description: string }[];
}[] = [
  {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast inference',
    icon: <Zap size={20} />,
    requiresKey: true,
    keyName: 'groq',
    models: [
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout', description: 'Latest Llama model' },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Best quality' },
      { id: 'qwen/qwen3-32b', name: 'Qwen3 32B', description: 'Strong reasoning' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-5 models',
    icon: <Bot size={20} />,
    requiresKey: true,
    keyName: 'openai',
    models: [
      { id: 'gpt-5.2', name: 'GPT-5.2 Thinking', description: 'Best quality' },
      { id: 'gpt-5.2-chat-latest', name: 'GPT-5.2 Instant', description: 'Fast daily use' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Affordable' },
      { id: 'gpt-5-nano', name: 'GPT-5 Nano', description: 'Budget' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models',
    icon: <Brain size={20} />,
    requiresKey: true,
    keyName: 'anthropic',
    models: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Best balance' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fast & efficient' },
      { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Most intelligent' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini models',
    icon: <Sparkles size={20} />,
    requiresKey: true,
    keyName: 'gemini',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast & capable' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', description: 'Budget option' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    description: 'Mistral AI models',
    icon: <Sparkles size={20} />,
    requiresKey: true,
    keyName: 'mistral',
    models: [
      { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Fast & efficient' },
      { id: 'mistral-medium-latest', name: 'Mistral Medium', description: 'Balanced' },
      { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Most capable' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local models',
    icon: <Monitor size={20} />,
    requiresKey: false,
    keyName: null,
    models: [
      { id: 'llama4', name: 'Llama 4', description: 'Latest Llama' },
      { id: 'deepseek-r1:14b', name: 'DeepSeek R1 14B', description: 'Reasoning model' },
      { id: 'qwen2.5:14b', name: 'Qwen 2.5 14B', description: 'Strong all-around' },
      { id: 'mistral', name: 'Mistral', description: 'Fast & capable' },
    ],
  },
];

const PROCESSING_MODES: { id: ProcessingMode; name: string; description: string; icon: React.ReactNode }[] = [
  { id: 'raw', name: 'Raw', description: 'No processing - just transcription', icon: <FileText size={24} /> },
  { id: 'clean', name: 'Clean', description: 'Remove filler words, add punctuation', icon: <Sparkles size={24} /> },
  { id: 'polish', name: 'Polish', description: 'Full rewrite for clarity', icon: <Gem size={24} /> },
];

const TEXT_CORRECTION_MODES: { id: TextCorrectionMode; name: string; description: string; icon: React.ReactNode }[] = [
  { id: 'proofread', name: 'Proofread', description: 'Fix grammar & spelling only', icon: <CheckCheck size={24} /> },
  { id: 'rewrite', name: 'Rewrite', description: 'Improve clarity & flow', icon: <PenLine size={24} /> },
  { id: 'formal', name: 'Formal', description: 'Professional tone', icon: <Briefcase size={24} /> },
  { id: 'casual', name: 'Casual', description: 'Conversational tone', icon: <Coffee size={24} /> },
  { id: 'concise', name: 'Concise', description: 'Shorten while keeping meaning', icon: <Scissors size={24} /> },
  { id: 'custom', name: 'Custom', description: 'Your own prompt', icon: <Wrench size={24} /> },
];

type Section = 'transcription' | 'ai' | 'textCorrection' | 'hotkeys' | 'audio' | 'general';

interface AudioDevice {
  deviceId: string;
  label: string;
}

// Step indicator component
function StepIndicator({ number, title, completed, active }: { number: number; title: string; completed: boolean; active: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '20px',
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: 600,
        backgroundColor: completed ? theme.success : active ? theme.primary : theme.bgHover,
        color: completed || active ? '#fff' : theme.textMuted,
        transition: 'all 0.2s',
      }}>
        {completed ? <Check size={16} /> : number}
      </div>
      <span style={{
        fontSize: '15px',
        fontWeight: 500,
        color: active ? theme.text : theme.textMuted,
      }}>
        {title}
      </span>
    </div>
  );
}

// Provider card component
function ProviderCard({
  provider,
  selected,
  onClick,
  hasKey,
}: {
  provider: { id: string; name: string; description: string; icon: React.ReactNode; requiresKey: boolean };
  selected: boolean;
  onClick: () => void;
  hasKey: boolean;
}) {
  const needsKey = provider.requiresKey && !hasKey;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        backgroundColor: selected ? theme.bgSelected : theme.bgCard,
        border: `2px solid ${selected ? theme.primary : theme.border}`,
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span style={{ color: theme.primary }}>{provider.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '15px',
          fontWeight: 600,
          color: theme.text,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {provider.name}
          {selected && <span style={{ color: theme.primary, fontSize: '12px' }}>Selected</span>}
        </div>
        <div style={{ fontSize: '13px', color: theme.textMuted, marginTop: '2px' }}>
          {provider.description}
        </div>
      </div>
      {needsKey && (
        <span style={{
          fontSize: '11px',
          padding: '4px 8px',
          backgroundColor: theme.warning + '20',
          color: theme.warning,
          borderRadius: '4px',
          fontWeight: 500,
        }}>
          Needs API Key
        </span>
      )}
    </button>
  );
}

// Model card component
function ModelCard({
  model,
  selected,
  onClick
}: {
  model: { id: string; name: string; description: string };
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        backgroundColor: selected ? theme.bgSelected : theme.bgCard,
        border: `2px solid ${selected ? theme.primary : theme.border}`,
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        width: '100%',
      }}
    >
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: theme.text }}>
          {model.name}
        </div>
        <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>
          {model.description}
        </div>
      </div>
      {selected && (
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: theme.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}>
          <Check size={12} />
        </div>
      )}
    </button>
  );
}

// Mode card component
function ModeCard({
  mode,
  selected,
  onClick
}: {
  mode: { id: string; name: string; description: string; icon: React.ReactNode };
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 16px',
        backgroundColor: selected ? theme.bgSelected : theme.bgCard,
        border: `2px solid ${selected ? theme.primary : theme.border}`,
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ color: theme.primary, marginBottom: '8px' }}>{mode.icon}</span>
      <div style={{ fontSize: '15px', fontWeight: 600, color: theme.text }}>
        {mode.name}
      </div>
      <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px', textAlign: 'center' }}>
        {mode.description}
      </div>
    </button>
  );
}

// API Key input component
function ApiKeyInput({
  value,
  onChange,
  placeholder,
  providerName,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  providerName: string;
}) {
  const [show, setShow] = useState(false);
  const hasValue = value && value.length > 0;

  return (
    <div style={{ marginTop: '16px' }}>
      <label style={{
        display: 'block',
        fontSize: '13px',
        fontWeight: 500,
        color: theme.textMuted,
        marginBottom: '8px',
      }}>
        {providerName} API Key
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '12px 48px 12px 14px',
            backgroundColor: theme.bgHover,
            border: `1px solid ${hasValue ? theme.success : theme.border}`,
            borderRadius: '8px',
            color: theme.text,
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: theme.textMuted,
            cursor: 'pointer',
            fontSize: '14px',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hasValue && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '8px',
          fontSize: '12px',
          color: theme.success,
        }}>
          <Check size={14} /> API key saved
        </div>
      )}
    </div>
  );
}

// Section card wrapper
function SectionCard({ title, children, step }: { title?: string; children: React.ReactNode; step?: number }) {
  return (
    <div style={{
      backgroundColor: theme.bgCard,
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '20px',
      border: `1px solid ${theme.border}`,
    }}>
      {(title || step) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
        }}>
          {step && (
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: theme.primary,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 600,
            }}>
              {step}
            </div>
          )}
          {title && (
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: theme.text,
              margin: 0,
            }}>
              {title}
            </h3>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// Nav item component
function NavItem({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px 16px',
        backgroundColor: active ? theme.bgSelected : 'transparent',
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
    >
      <span style={{ color: active ? theme.primary : theme.textMuted }}>{icon}</span>
      <span style={{
        flex: 1,
        fontSize: '14px',
        fontWeight: 500,
        color: active ? theme.text : theme.textMuted,
      }}>
        {label}
      </span>
      {badge && (
        <span style={{
          fontSize: '11px',
          padding: '2px 8px',
          backgroundColor: theme.primary,
          color: '#fff',
          borderRadius: '10px',
          fontWeight: 500,
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

export function Settings() {
  const [activeSection, setActiveSection] = useState<Section>('transcription');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [recordingHotkey, setRecordingHotkey] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('default');
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = React.useRef<MediaStream | null>(null);
  const micAnalyserRef = React.useRef<AnalyserNode | null>(null);
  const micAnimationRef = React.useRef<number | null>(null);

  useEffect(() => {
    loadSettings();
    loadAudioDevices();
    return () => {
      // Cleanup mic test on unmount
      stopMicTest();
    };
  }, []);

  const loadAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
        }));
      setAudioDevices(audioInputs);
    } catch (err) {
      console.error('Failed to load audio devices:', err);
    }
  };

  const startMicTest = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDevice === 'default'
          ? true
          : { deviceId: { exact: selectedDevice } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      micAnalyserRef.current = analyser;

      setMicTesting(true);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!micAnalyserRef.current) return;

        micAnalyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = Math.min(100, (average / 128) * 100);
        setMicLevel(normalized);

        micAnimationRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.error('Failed to access microphone:', err);
    }
  };

  const stopMicTest = () => {
    if (micAnimationRef.current) {
      cancelAnimationFrame(micAnimationRef.current);
      micAnimationRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    micAnalyserRef.current = null;
    setMicTesting(false);
    setMicLevel(0);
  };

  const toggleMicTest = () => {
    if (micTesting) {
      stopMicTest();
    } else {
      startMicTest();
    }
  };

  const loadSettings = async () => {
    try {
      const s = await window.murmur.getSettings();
      setSettings(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const save = useCallback(async (updates: Partial<AppSettings>) => {
    if (!settings) {
      console.error('[Settings] Cannot save - settings is null');
      return;
    }
    try {
      console.log('[Settings] Saving updates:', JSON.stringify(updates));
      console.log('[Settings] Current settings provider:', settings.transcriptionProvider);
      const updated = await window.murmur.setSettings(updates);
      console.log('[Settings] Received updated settings:', JSON.stringify(updated));
      console.log('[Settings] Updated provider:', updated?.transcriptionProvider);
      if (!updated) {
        console.error('[Settings] Received null/undefined from setSettings');
        return;
      }
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      console.error('[Settings] Save failed:', err);
    }
  }, [settings]);

  const updateApiKey = useCallback((provider: string, value: string) => {
    if (!settings) return;
    save({ apiKeys: { ...settings.apiKeys, [provider]: value } });
  }, [settings, save]);

  // Hotkey capture handler
  const handleHotkeyCapture = useCallback((e: KeyboardEvent) => {
    if (!recordingHotkey || !settings) return;
    e.preventDefault();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key === '`') key = 'Backquote';
    else if (key.length === 1) key = key.toUpperCase();
    else if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return;

    parts.push(key);
    const hotkey = parts.join('+');

    if (recordingHotkey === 'pushToTalk') {
      save({ hotkeys: { ...settings.hotkeys, pushToTalkKey: hotkey } });
    } else if (recordingHotkey === 'toggle') {
      save({ hotkeys: { ...settings.hotkeys, toggleKey: hotkey } });
    } else if (recordingHotkey === 'correctSelection') {
      save({ hotkeys: { ...settings.hotkeys, correctSelectionKey: hotkey } });
    }
    setRecordingHotkey(null);
  }, [recordingHotkey, settings, save]);

  useEffect(() => {
    if (recordingHotkey) {
      window.addEventListener('keydown', handleHotkeyCapture);
      return () => window.removeEventListener('keydown', handleHotkeyCapture);
    }
  }, [recordingHotkey, handleHotkeyCapture]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: theme.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '16px', color: theme.primary }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          <div style={{ fontSize: '16px', color: theme.textMuted }}>Loading Murmur...</div>
        </div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: theme.bg,
        padding: '40px',
        color: theme.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <h1 style={{ marginBottom: '16px' }}>Unable to Load Settings</h1>
        <p style={{ color: theme.error, marginBottom: '24px' }}>{error || 'An unknown error occurred'}</p>
        <button
          onClick={loadSettings}
          style={{
            padding: '12px 24px',
            backgroundColor: theme.primary,
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  const currentTranscriptionProvider = TRANSCRIPTION_PROVIDERS.find(p => p.id === settings.transcriptionProvider);
  const currentLLMProvider = LLM_PROVIDERS.find(p => p.id === settings.llmProvider);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.bg,
      color: theme.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
    }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px',
        borderRight: `1px solid ${theme.border}`,
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 16px',
          marginBottom: '32px',
        }}>
          <span style={{ color: theme.primary }}><Mic size={28} /></span>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: theme.text }}>Murmur</div>
            <div style={{ fontSize: '12px', color: theme.textDim }}>Settings</div>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          <NavItem
            icon={<Mic size={18} />}
            label="Transcription"
            active={activeSection === 'transcription'}
            onClick={() => setActiveSection('transcription')}
          />
          <NavItem
            icon={<Bot size={18} />}
            label="AI Processing"
            active={activeSection === 'ai'}
            onClick={() => setActiveSection('ai')}
          />
          <NavItem
            icon={<Type size={18} />}
            label="Text Correction"
            active={activeSection === 'textCorrection'}
            onClick={() => setActiveSection('textCorrection')}
            badge="New"
          />
          <NavItem
            icon={<Keyboard size={18} />}
            label="Hotkeys"
            active={activeSection === 'hotkeys'}
            onClick={() => setActiveSection('hotkeys')}
          />
          <NavItem
            icon={<Volume2 size={18} />}
            label="Audio"
            active={activeSection === 'audio'}
            onClick={() => setActiveSection('audio')}
          />
          <NavItem
            icon={<SettingsIcon size={18} />}
            label="General"
            active={activeSection === 'general'}
            onClick={() => setActiveSection('general')}
          />
        </nav>

        <div style={{
          padding: '16px',
          backgroundColor: theme.bgCard,
          borderRadius: '12px',
          marginTop: 'auto',
        }}>
          <div style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '8px' }}>
            Quick Start
          </div>
          <div style={{ fontSize: '12px', color: theme.textDim, lineHeight: 1.5 }}>
            Press <code style={{
              backgroundColor: theme.bgHover,
              padding: '2px 6px',
              borderRadius: '4px',
              fontFamily: 'monospace',
            }}>{settings.hotkeys.pushToTalkKey}</code> to start recording
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1,
        padding: '32px',
        overflowY: 'auto',
        maxHeight: '100vh',
      }}>
        <div style={{ maxWidth: '720px' }}>
          {/* Transcription Section */}
          {activeSection === 'transcription' && (
            <>
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Transcription</h1>
                <p style={{ fontSize: '14px', color: theme.textMuted, marginTop: '8px' }}>
                  Configure how your voice is converted to text
                </p>
              </div>

              <SectionCard title="Select Provider" step={1}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {TRANSCRIPTION_PROVIDERS.map(provider => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      selected={settings.transcriptionProvider === provider.id}
                      hasKey={!provider.requiresKey || !!(settings.apiKeys as any)[provider.keyName!]}
                      onClick={() => {
                        const defaultModel = provider.models[0]?.id || '';
                        save({ transcriptionProvider: provider.id, transcriptionModel: defaultModel });
                      }}
                    />
                  ))}
                </div>
              </SectionCard>

              {currentTranscriptionProvider?.requiresKey && (
                <SectionCard title="Enter API Key" step={2}>
                  <p style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '12px' }}>
                    Get your API key from{' '}
                    <span style={{ color: theme.primary }}>
                      {currentTranscriptionProvider.id === 'groq' ? 'console.groq.com' : currentTranscriptionProvider.id === 'mistral' ? 'console.mistral.ai' : 'platform.openai.com'}
                    </span>
                  </p>
                  <ApiKeyInput
                    value={(settings.apiKeys as any)[currentTranscriptionProvider.keyName!] || ''}
                    onChange={(value) => updateApiKey(currentTranscriptionProvider.keyName!, value)}
                    placeholder={currentTranscriptionProvider.id === 'groq' ? 'gsk_...' : currentTranscriptionProvider.id === 'mistral' ? 'Enter Mistral API key' : 'sk-...'}
                    providerName={currentTranscriptionProvider.name}
                  />
                </SectionCard>
              )}

              <SectionCard title="Select Model" step={currentTranscriptionProvider?.requiresKey ? 3 : 2}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {currentTranscriptionProvider?.models.map(model => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      selected={settings.transcriptionModel === model.id}
                      onClick={() => save({ transcriptionModel: model.id })}
                    />
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Language" step={currentTranscriptionProvider?.requiresKey ? 4 : 3}>
                <select
                  value={settings.language}
                  onChange={e => save({ language: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: theme.bgHover,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '8px',
                    color: theme.text,
                    fontSize: '14px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="auto">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                </select>
              </SectionCard>
            </>
          )}

          {/* AI Processing Section */}
          {activeSection === 'ai' && (
            <>
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>AI Processing</h1>
                <p style={{ fontSize: '14px', color: theme.textMuted, marginTop: '8px' }}>
                  Enhance your transcriptions with AI
                </p>
              </div>

              <SectionCard title="Select Mode" step={1}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {PROCESSING_MODES.map(mode => (
                    <ModeCard
                      key={mode.id}
                      mode={mode}
                      selected={settings.processingMode === mode.id}
                      onClick={() => save({ processingMode: mode.id })}
                    />
                  ))}
                </div>
              </SectionCard>

              {settings.processingMode !== 'raw' && (
                <>
                  <SectionCard title="Select Provider" step={2}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {LLM_PROVIDERS.map(provider => (
                        <ProviderCard
                          key={provider.id}
                          provider={provider}
                          selected={settings.llmProvider === provider.id}
                          hasKey={!provider.requiresKey || !!(settings.apiKeys as any)[provider.keyName!]}
                          onClick={() => {
                            const defaultModel = provider.models[0]?.id || '';
                            save({ llmProvider: provider.id, llmModel: defaultModel });
                          }}
                        />
                      ))}
                    </div>
                  </SectionCard>

                  {currentLLMProvider?.requiresKey && (
                    <SectionCard title="Enter API Key" step={3}>
                      <p style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '12px' }}>
                        Get your API key from the provider's console
                      </p>
                      <ApiKeyInput
                        value={(settings.apiKeys as any)[currentLLMProvider.keyName!] || ''}
                        onChange={(value) => updateApiKey(currentLLMProvider.keyName!, value)}
                        placeholder={
                          currentLLMProvider.id === 'groq' ? 'gsk_...' :
                          currentLLMProvider.id === 'openai' ? 'sk-...' :
                          currentLLMProvider.id === 'anthropic' ? 'sk-ant-...' :
                          'API key...'
                        }
                        providerName={currentLLMProvider.name}
                      />
                    </SectionCard>
                  )}

                  <SectionCard title="Select Model" step={currentLLMProvider?.requiresKey ? 4 : 3}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentLLMProvider?.models.map(model => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          selected={settings.llmModel === model.id}
                          onClick={() => save({ llmModel: model.id })}
                        />
                      ))}
                    </div>
                  </SectionCard>
                </>
              )}
            </>
          )}

          {/* Text Correction Section */}
          {activeSection === 'textCorrection' && (
            <>
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Text Correction</h1>
                <p style={{ fontSize: '14px', color: theme.textMuted, marginTop: '8px' }}>
                  Select text in any app and press{' '}
                  <code style={{
                    backgroundColor: theme.bgHover,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                  }}>{settings.hotkeys.correctSelectionKey}</code>
                  {' '}to correct it with AI
                </p>
              </div>

              <SectionCard title="Correction Mode" step={1}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  {TEXT_CORRECTION_MODES.map(mode => (
                    <ModeCard
                      key={mode.id}
                      mode={mode}
                      selected={settings.textCorrectionMode === mode.id}
                      onClick={() => save({ textCorrectionMode: mode.id })}
                    />
                  ))}
                </div>
              </SectionCard>

              {settings.textCorrectionMode === 'custom' && (
                <SectionCard title="Custom Prompt" step={2}>
                  <p style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '12px' }}>
                    Write your own system prompt. The selected text will be appended automatically.
                  </p>
                  <textarea
                    value={settings.textCorrectionCustomPrompt}
                    onChange={(e) => save({ textCorrectionCustomPrompt: e.target.value })}
                    placeholder='e.g., You are a medical writing assistant. Fix terminology and formatting while preserving clinical accuracy...'
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      backgroundColor: theme.bgHover,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px',
                      color: theme.text,
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ fontSize: '12px', color: theme.textDim, marginTop: '8px' }}>
                    Tip: End with &quot;Return ONLY the corrected text, nothing else.&quot; for clean output.
                  </div>
                </SectionCard>
              )}

              <SectionCard title="Hotkey" step={settings.textCorrectionMode === 'custom' ? 3 : 2}>
                <p style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '16px' }}>
                  Configure the hotkey in the{' '}
                  <button
                    onClick={() => setActiveSection('hotkeys')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: theme.primary,
                      cursor: 'pointer',
                      fontSize: '13px',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    Hotkeys
                  </button>
                  {' '}section
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: theme.bgHover,
                  borderRadius: '10px',
                }}>
                  <code style={{
                    padding: '8px 14px',
                    backgroundColor: theme.bgCard,
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    border: `1px solid ${theme.border}`,
                  }}>
                    {settings.hotkeys.correctSelectionKey}
                  </code>
                  <span style={{ fontSize: '13px', color: theme.textMuted }}>
                    Select text, then press this to correct it
                  </span>
                </div>
              </SectionCard>

              <SectionCard title="How It Works">
                <div style={{ fontSize: '13px', color: theme.textMuted, lineHeight: 1.7 }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{ color: theme.primary, fontWeight: 600, minWidth: '20px' }}>1.</span>
                    <span>Select text in any application</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{ color: theme.primary, fontWeight: 600, minWidth: '20px' }}>2.</span>
                    <span>Press <code style={{ backgroundColor: theme.bgHover, padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace' }}>{settings.hotkeys.correctSelectionKey}</code></span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{ color: theme.primary, fontWeight: 600, minWidth: '20px' }}>3.</span>
                    <span>AI corrects the text using your chosen mode</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ color: theme.primary, fontWeight: 600, minWidth: '20px' }}>4.</span>
                    <span>Corrected text replaces your selection</span>
                  </div>
                </div>
              </SectionCard>

              {settings.processingMode === 'raw' && (
                <div style={{
                  padding: '16px 20px',
                  backgroundColor: theme.warning + '15',
                  border: `1px solid ${theme.warning}40`,
                  borderRadius: '10px',
                  fontSize: '13px',
                  color: theme.warning,
                  lineHeight: 1.5,
                }}>
                  Text correction requires an LLM provider with an API key.
                  Configure one in the{' '}
                  <button
                    onClick={() => setActiveSection('ai')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: theme.warning,
                      cursor: 'pointer',
                      fontSize: '13px',
                      padding: 0,
                      textDecoration: 'underline',
                      fontWeight: 600,
                    }}
                  >
                    AI Processing
                  </button>
                  {' '}section.
                </div>
              )}
            </>
          )}

          {/* Hotkeys Section */}
          {activeSection === 'hotkeys' && (
            <>
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Hotkeys</h1>
                <p style={{ fontSize: '14px', color: theme.textMuted, marginTop: '8px' }}>
                  Configure keyboard shortcuts for recording
                </p>
              </div>

              <SectionCard title="Activation Mode" step={1}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => save({ hotkeys: { ...settings.hotkeys, activationMode: 'push-to-talk' } })}
                    style={{
                      flex: 1,
                      padding: '20px',
                      backgroundColor: settings.hotkeys.activationMode === 'push-to-talk' ? theme.bgSelected : theme.bgCard,
                      border: `2px solid ${settings.hotkeys.activationMode === 'push-to-talk' ? theme.primary : theme.border}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ marginBottom: '8px', color: theme.primary }}><Target size={24} /></div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: theme.text }}>Push to Talk</div>
                    <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
                      Hold key to record, release to stop
                    </div>
                  </button>
                  <button
                    onClick={() => save({ hotkeys: { ...settings.hotkeys, activationMode: 'toggle' } })}
                    style={{
                      flex: 1,
                      padding: '20px',
                      backgroundColor: settings.hotkeys.activationMode === 'toggle' ? theme.bgSelected : theme.bgCard,
                      border: `2px solid ${settings.hotkeys.activationMode === 'toggle' ? theme.primary : theme.border}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ marginBottom: '8px', color: theme.primary }}><RefreshCw size={24} /></div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: theme.text }}>Toggle</div>
                    <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
                      Press to start, press again to stop
                    </div>
                  </button>
                </div>
              </SectionCard>

              <SectionCard title="Recording Hotkey" step={2}>
                <p style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '16px' }}>
                  Click the box and press your desired key combination
                </p>
                <div
                  onClick={() => setRecordingHotkey(settings.hotkeys.activationMode === 'push-to-talk' ? 'pushToTalk' : 'toggle')}
                  style={{
                    padding: '16px 20px',
                    backgroundColor: theme.bgHover,
                    border: `2px solid ${recordingHotkey ? theme.primary : theme.border}`,
                    borderRadius: '10px',
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    color: recordingHotkey ? theme.primary : theme.text,
                  }}
                >
                  {recordingHotkey
                    ? 'Press any key...'
                    : settings.hotkeys.activationMode === 'push-to-talk'
                      ? settings.hotkeys.pushToTalkKey
                      : settings.hotkeys.toggleKey
                  }
                </div>
                {recordingHotkey && (
                  <button
                    onClick={() => setRecordingHotkey(null)}
                    style={{
                      marginTop: '12px',
                      padding: '8px 16px',
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      color: theme.textMuted,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </SectionCard>

              <SectionCard title="Cancel Recording" step={3}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: theme.bgHover,
                  borderRadius: '10px',
                }}>
                  <code style={{
                    padding: '8px 14px',
                    backgroundColor: theme.bgCard,
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    border: `1px solid ${theme.border}`,
                  }}>
                    Escape
                  </code>
                  <span style={{ fontSize: '13px', color: theme.textMuted }}>
                    Press to cancel the current recording
                  </span>
                </div>
              </SectionCard>

              <SectionCard title="Text Correction Hotkey" step={4}>
                <p style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '16px' }}>
                  Select text in any app and press this to correct it with AI
                </p>
                <div
                  onClick={() => setRecordingHotkey('correctSelection')}
                  style={{
                    padding: '16px 20px',
                    backgroundColor: theme.bgHover,
                    border: `2px solid ${recordingHotkey === 'correctSelection' ? theme.primary : theme.border}`,
                    borderRadius: '10px',
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    color: recordingHotkey === 'correctSelection' ? theme.primary : theme.text,
                  }}
                >
                  {recordingHotkey === 'correctSelection'
                    ? 'Press any key...'
                    : settings.hotkeys.correctSelectionKey
                  }
                </div>
                {recordingHotkey === 'correctSelection' && (
                  <button
                    onClick={() => setRecordingHotkey(null)}
                    style={{
                      marginTop: '12px',
                      padding: '8px 16px',
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      color: theme.textMuted,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </SectionCard>
            </>
          )}

          {/* Audio Section */}
          {activeSection === 'audio' && (
            <>
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Audio</h1>
                <p style={{ fontSize: '14px', color: theme.textMuted, marginTop: '8px' }}>
                  Configure your microphone settings
                </p>
              </div>

              <SectionCard title="Select Microphone" step={1}>
                <select
                  value={selectedDevice}
                  onChange={(e) => {
                    setSelectedDevice(e.target.value);
                    if (micTesting) {
                      stopMicTest();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: theme.bgHover,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '8px',
                    color: theme.text,
                    fontSize: '14px',
                    cursor: 'pointer',
                    outline: 'none',
                    marginBottom: '12px',
                  }}
                >
                  <option value="default">System Default</option>
                  {audioDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={loadAudioDevices}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '6px',
                    color: theme.textMuted,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={14} /> Refresh Devices
                </button>
              </SectionCard>

              <SectionCard title="Test Microphone" step={2}>
                <p style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '16px' }}>
                  {micTesting ? 'Speak now to see your microphone level' : 'Click the button to test your microphone'}
                </p>

                {/* Audio Level Meter */}
                {micTesting && (
                  <div style={{
                    marginBottom: '16px',
                    padding: '16px',
                    backgroundColor: theme.bgHover,
                    borderRadius: '10px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px',
                    }}>
                      <span style={{ color: theme.primary }}><Mic size={20} /></span>
                      <div style={{
                        flex: 1,
                        height: '24px',
                        backgroundColor: theme.bgCard,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: `1px solid ${theme.border}`,
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${micLevel}%`,
                          backgroundColor: micLevel > 80 ? theme.error : micLevel > 50 ? theme.warning : theme.success,
                          borderRadius: '12px',
                          transition: 'width 0.05s ease-out',
                        }} />
                      </div>
                      <span style={{
                        fontSize: '13px',
                        color: theme.textMuted,
                        minWidth: '40px',
                        textAlign: 'right',
                      }}>
                        {Math.round(micLevel)}%
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: micLevel > 10 ? theme.success : theme.textMuted,
                    }}>
                      {micLevel > 50 ? <><Volume2 size={14} /> Great signal!</> : micLevel > 10 ? <><Check size={14} /> Microphone working</> : 'Waiting for audio...'}
                    </div>
                  </div>
                )}

                <button
                  onClick={toggleMicTest}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 24px',
                    backgroundColor: micTesting ? theme.error : theme.primary,
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {micTesting ? <Square size={16} /> : <Mic size={16} />}
                  {micTesting ? 'Stop Test' : 'Test Microphone'}
                </button>
              </SectionCard>
            </>
          )}

          {/* General Section */}
          {activeSection === 'general' && (
            <>
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>General</h1>
                <p style={{ fontSize: '14px', color: theme.textMuted, marginTop: '8px' }}>
                  Application preferences
                </p>
              </div>

              <SectionCard title="Startup">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  backgroundColor: theme.bgHover,
                  borderRadius: '10px',
                }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 500, color: theme.text }}>
                      Launch at startup
                    </div>
                    <div style={{ fontSize: '13px', color: theme.textMuted, marginTop: '4px' }}>
                      Automatically start Murmur when you log in
                    </div>
                  </div>
                  <button
                    onClick={() => save({ launchAtStartup: !settings.launchAtStartup })}
                    style={{
                      width: '52px',
                      height: '28px',
                      borderRadius: '14px',
                      border: 'none',
                      backgroundColor: settings.launchAtStartup ? theme.primary : theme.bgCard,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      position: 'absolute',
                      top: '3px',
                      left: settings.launchAtStartup ? '27px' : '3px',
                      transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
              </SectionCard>

              <SectionCard title="Developer">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  backgroundColor: theme.bgHover,
                  borderRadius: '10px',
                }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 500, color: theme.text }}>
                      Open DevTools
                    </div>
                    <div style={{ fontSize: '13px', color: theme.textMuted, marginTop: '4px' }}>
                      Open Chrome Developer Tools for debugging
                    </div>
                  </div>
                  <button
                    onClick={() => window.murmur.openDevTools()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      backgroundColor: theme.bgCard,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px',
                      color: theme.text,
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Bug size={16} /> DevTools
                  </button>
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </main>

      {/* Save indicator */}
      {saved && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 20px',
          backgroundColor: theme.success,
          borderRadius: '10px',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <Check size={16} /> Saved
        </div>
      )}
    </div>
  );
}
