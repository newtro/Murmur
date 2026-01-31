import React, { useState, useEffect, useCallback } from 'react';
import type { AppSettings, TranscriptionProvider, LLMProvider, ProcessingMode, ActivationMode } from '../../../shared/types';

// Professional dark theme styles
const theme = {
  bg: '#0f172a',
  bgSecondary: '#1e293b',
  bgTertiary: '#334155',
  border: '#475569',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  success: '#22c55e',
  error: '#ef4444',
};

const baseStyles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    backgroundColor: theme.bg,
    color: theme.text,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    padding: '20px 24px',
    borderBottom: `1px solid ${theme.border}`,
    backgroundColor: theme.bgSecondary,
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: 600,
    margin: 0,
  },
  nav: {
    display: 'flex',
    gap: '4px',
    padding: '0 24px',
    backgroundColor: theme.bgSecondary,
    borderBottom: `1px solid ${theme.border}`,
  },
  navButton: {
    padding: '12px 20px',
    background: 'transparent',
    border: 'none',
    color: theme.textSecondary,
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
  },
  navButtonActive: {
    color: theme.primary,
    borderBottomColor: theme.primary,
  },
  content: {
    padding: '24px',
    maxWidth: '800px',
  },
  section: {
    backgroundColor: theme.bgSecondary,
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '16px',
    color: theme.text,
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: theme.textSecondary,
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: theme.bgTertiary,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    color: theme.text,
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: theme.bgTertiary,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    color: theme.text,
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
  },
  button: {
    padding: '10px 20px',
    backgroundColor: theme.primary,
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonSecondary: {
    padding: '10px 20px',
    backgroundColor: theme.bgTertiary,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    color: theme.text,
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  row: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  hotkeyDisplay: {
    padding: '12px 16px',
    backgroundColor: theme.bgTertiary,
    border: `2px solid ${theme.border}`,
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '14px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  modeButton: {
    flex: 1,
    padding: '16px',
    backgroundColor: theme.bgTertiary,
    border: `2px solid ${theme.border}`,
    borderRadius: '8px',
    color: theme.text,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left' as const,
  },
  modeButtonActive: {
    borderColor: theme.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  description: {
    fontSize: '12px',
    color: theme.textSecondary,
    marginTop: '4px',
  },
  saveIndicator: {
    position: 'fixed' as const,
    bottom: '20px',
    right: '20px',
    padding: '12px 20px',
    backgroundColor: theme.success,
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: 500,
  },
};

const TRANSCRIPTION_PROVIDERS: { id: TranscriptionProvider; name: string; models: { id: string; name: string }[] }[] = [
  {
    id: 'groq',
    name: 'Groq (Cloud)',
    models: [
      { id: 'whisper-large-v3', name: 'Whisper Large V3' },
      { id: 'whisper-large-v3-turbo', name: 'Whisper Large V3 Turbo' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI (Cloud)',
    models: [
      { id: 'whisper-1', name: 'Whisper-1' },
      { id: 'gpt-4o-transcribe', name: 'GPT-4o Transcribe' },
      { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o Mini Transcribe' },
    ],
  },
  {
    id: 'local',
    name: 'Local (whisper.cpp)',
    models: [
      { id: 'tiny', name: 'Tiny (75MB)' },
      { id: 'base', name: 'Base (142MB)' },
      { id: 'small', name: 'Small (466MB)' },
      { id: 'medium', name: 'Medium (1.5GB)' },
      { id: 'large-v3-turbo', name: 'Large V3 Turbo (1.6GB)' },
    ],
  },
];

const LLM_PROVIDERS: { id: LLMProvider; name: string; models: { id: string; name: string }[] }[] = [
  {
    id: 'groq',
    name: 'Groq',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2' },
      { id: 'mistral', name: 'Mistral' },
      { id: 'phi3', name: 'Phi-3' },
    ],
  },
];

const PROCESSING_MODES: { id: ProcessingMode; name: string; description: string }[] = [
  { id: 'raw', name: 'Raw', description: 'No AI processing, just transcription' },
  { id: 'clean', name: 'Clean', description: 'Remove filler words, add punctuation' },
  { id: 'polish', name: 'Polish', description: 'Full rewrite for clarity and grammar' },
];

type Tab = 'api-keys' | 'transcription' | 'processing' | 'hotkeys' | 'audio';

interface AudioDevice {
  deviceId: string;
  label: string;
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('api-keys');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [recordingHotkey, setRecordingHotkey] = useState(false);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('default');

  useEffect(() => {
    loadSettings();
    loadAudioDevices();
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
    if (!settings) return;
    try {
      const updated = await window.murmur.setSettings(updates);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [settings]);

  const updateApiKey = (provider: string, value: string) => {
    if (!settings) return;
    save({ apiKeys: { ...settings.apiKeys, [provider]: value } });
  };

  const handleHotkeyCapture = useCallback((e: KeyboardEvent) => {
    if (!recordingHotkey) return;
    e.preventDefault();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    else if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return;

    parts.push(key);
    const hotkey = parts.join('+');

    save({ hotkeys: { ...settings!.hotkeys, toggleRecording: hotkey } });
    setRecordingHotkey(false);
  }, [recordingHotkey, settings, save]);

  useEffect(() => {
    if (recordingHotkey) {
      window.addEventListener('keydown', handleHotkeyCapture);
      return () => window.removeEventListener('keydown', handleHotkeyCapture);
    }
  }, [recordingHotkey, handleHotkeyCapture]);

  if (loading) {
    return (
      <div style={{ ...baseStyles.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div style={{ ...baseStyles.app, padding: '40px' }}>
        <h1>Error</h1>
        <p style={{ color: theme.error }}>{error || 'Failed to load settings'}</p>
        <button style={baseStyles.button} onClick={loadSettings}>Retry</button>
      </div>
    );
  }

  const currentTranscriptionProvider = TRANSCRIPTION_PROVIDERS.find(p => p.id === settings.transcriptionProvider);
  const currentLLMProvider = LLM_PROVIDERS.find(p => p.id === settings.llmProvider);

  return (
    <div style={baseStyles.app}>
      <header style={baseStyles.header}>
        <h1 style={baseStyles.headerTitle}>Murmur Settings</h1>
      </header>

      <nav style={baseStyles.nav}>
        {(['api-keys', 'transcription', 'processing', 'hotkeys', 'audio'] as Tab[]).map(tab => (
          <button
            key={tab}
            style={{
              ...baseStyles.navButton,
              ...(activeTab === tab ? baseStyles.navButtonActive : {}),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'api-keys' ? 'API Keys' :
             tab === 'transcription' ? 'Transcription' :
             tab === 'processing' ? 'AI Processing' :
             tab === 'hotkeys' ? 'Hotkeys' : 'Audio'}
          </button>
        ))}
      </nav>

      <main style={baseStyles.content}>
        {/* API Keys Tab */}
        {activeTab === 'api-keys' && (
          <>
            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>Groq</h3>
              <p style={{ ...baseStyles.description, marginBottom: '12px' }}>Fast inference for Whisper and LLMs</p>
              <div style={baseStyles.field}>
                <label style={baseStyles.label}>API Key</label>
                <input
                  type="password"
                  style={baseStyles.input}
                  value={settings.apiKeys.groq || ''}
                  onChange={e => updateApiKey('groq', e.target.value)}
                  placeholder="gsk_..."
                />
              </div>
            </div>

            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>OpenAI</h3>
              <p style={{ ...baseStyles.description, marginBottom: '12px' }}>GPT models and Whisper transcription</p>
              <div style={baseStyles.field}>
                <label style={baseStyles.label}>API Key</label>
                <input
                  type="password"
                  style={baseStyles.input}
                  value={settings.apiKeys.openai || ''}
                  onChange={e => updateApiKey('openai', e.target.value)}
                  placeholder="sk-..."
                />
              </div>
            </div>

            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>Anthropic</h3>
              <p style={{ ...baseStyles.description, marginBottom: '12px' }}>Claude models for text processing</p>
              <div style={baseStyles.field}>
                <label style={baseStyles.label}>API Key</label>
                <input
                  type="password"
                  style={baseStyles.input}
                  value={settings.apiKeys.anthropic || ''}
                  onChange={e => updateApiKey('anthropic', e.target.value)}
                  placeholder="sk-ant-..."
                />
              </div>
            </div>

            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>Google Gemini</h3>
              <p style={{ ...baseStyles.description, marginBottom: '12px' }}>Gemini models for text processing</p>
              <div style={baseStyles.field}>
                <label style={baseStyles.label}>API Key</label>
                <input
                  type="password"
                  style={baseStyles.input}
                  value={settings.apiKeys.gemini || ''}
                  onChange={e => updateApiKey('gemini', e.target.value)}
                  placeholder="AIza..."
                />
              </div>
            </div>
          </>
        )}

        {/* Transcription Tab */}
        {activeTab === 'transcription' && (
          <>
            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>Transcription Provider</h3>
              <div style={baseStyles.grid}>
                {TRANSCRIPTION_PROVIDERS.map(provider => (
                  <button
                    key={provider.id}
                    style={{
                      ...baseStyles.modeButton,
                      ...(settings.transcriptionProvider === provider.id ? baseStyles.modeButtonActive : {}),
                    }}
                    onClick={() => {
                      const defaultModel = provider.models[0]?.id || '';
                      save({ transcriptionProvider: provider.id, transcriptionModel: defaultModel });
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{provider.name}</div>
                    <div style={baseStyles.description}>{provider.models.length} models available</div>
                  </button>
                ))}
              </div>
            </div>

            {currentTranscriptionProvider && (
              <div style={baseStyles.section}>
                <h3 style={baseStyles.sectionTitle}>Transcription Model</h3>
                <div style={baseStyles.field}>
                  <select
                    style={baseStyles.select}
                    value={settings.transcriptionModel}
                    onChange={e => save({ transcriptionModel: e.target.value })}
                  >
                    {currentTranscriptionProvider.models.map(model => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>Language</h3>
              <div style={baseStyles.field}>
                <select
                  style={baseStyles.select}
                  value={settings.language}
                  onChange={e => save({ language: e.target.value })}
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
              </div>
            </div>
          </>
        )}

        {/* AI Processing Tab */}
        {activeTab === 'processing' && (
          <>
            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>Processing Mode</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                {PROCESSING_MODES.map(mode => (
                  <button
                    key={mode.id}
                    style={{
                      ...baseStyles.modeButton,
                      ...(settings.processingMode === mode.id ? baseStyles.modeButtonActive : {}),
                    }}
                    onClick={() => save({ processingMode: mode.id })}
                  >
                    <div style={{ fontWeight: 600 }}>{mode.name}</div>
                    <div style={baseStyles.description}>{mode.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {settings.processingMode !== 'raw' && (
              <>
                <div style={baseStyles.section}>
                  <h3 style={baseStyles.sectionTitle}>LLM Provider</h3>
                  <div style={baseStyles.grid}>
                    {LLM_PROVIDERS.map(provider => (
                      <button
                        key={provider.id}
                        style={{
                          ...baseStyles.modeButton,
                          ...(settings.llmProvider === provider.id ? baseStyles.modeButtonActive : {}),
                        }}
                        onClick={() => {
                          const defaultModel = provider.models[0]?.id || '';
                          save({ llmProvider: provider.id, llmModel: defaultModel });
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{provider.name}</div>
                        <div style={baseStyles.description}>{provider.models.length} models</div>
                      </button>
                    ))}
                  </div>
                </div>

                {currentLLMProvider && (
                  <div style={baseStyles.section}>
                    <h3 style={baseStyles.sectionTitle}>LLM Model</h3>
                    <div style={baseStyles.field}>
                      <select
                        style={baseStyles.select}
                        value={settings.llmModel}
                        onChange={e => save({ llmModel: e.target.value })}
                      >
                        {currentLLMProvider.models.map(model => (
                          <option key={model.id} value={model.id}>{model.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Hotkeys Tab */}
        {activeTab === 'hotkeys' && (
          <>
            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>Activation Mode</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  style={{
                    ...baseStyles.modeButton,
                    ...(settings.hotkeys.activationMode === 'push-to-talk' ? baseStyles.modeButtonActive : {}),
                  }}
                  onClick={() => save({ hotkeys: { ...settings.hotkeys, activationMode: 'push-to-talk' } })}
                >
                  <div style={{ fontWeight: 600 }}>Push to Talk</div>
                  <div style={baseStyles.description}>Hold hotkey to record, release to stop</div>
                </button>
                <button
                  style={{
                    ...baseStyles.modeButton,
                    ...(settings.hotkeys.activationMode === 'toggle' ? baseStyles.modeButtonActive : {}),
                  }}
                  onClick={() => save({ hotkeys: { ...settings.hotkeys, activationMode: 'toggle' } })}
                >
                  <div style={{ fontWeight: 600 }}>Toggle</div>
                  <div style={baseStyles.description}>Press once to start, press again to stop</div>
                </button>
              </div>
            </div>

            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>Recording Hotkey</h3>
              <p style={{ ...baseStyles.description, marginBottom: '12px' }}>
                Click the box below and press your desired key combination
              </p>
              <div
                style={{
                  ...baseStyles.hotkeyDisplay,
                  borderColor: recordingHotkey ? theme.primary : theme.border,
                }}
                onClick={() => setRecordingHotkey(true)}
              >
                {recordingHotkey ? 'Press any key combination...' : settings.hotkeys.toggleRecording}
              </div>
              {recordingHotkey && (
                <button
                  style={{ ...baseStyles.buttonSecondary, marginTop: '12px' }}
                  onClick={() => setRecordingHotkey(false)}
                >
                  Cancel
                </button>
              )}
            </div>

            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>Cancel Recording</h3>
              <p style={baseStyles.description}>
                Press <code style={{ backgroundColor: theme.bgTertiary, padding: '2px 6px', borderRadius: '4px' }}>Escape</code> at any time to cancel the current recording
              </p>
            </div>
          </>
        )}

        {/* Audio Tab */}
        {activeTab === 'audio' && (
          <>
            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>Microphone</h3>
              <p style={{ ...baseStyles.description, marginBottom: '12px' }}>
                Select the microphone to use for voice recording
              </p>
              <div style={baseStyles.field}>
                <select
                  style={baseStyles.select}
                  value={selectedDevice}
                  onChange={e => setSelectedDevice(e.target.value)}
                >
                  <option value="default">System Default</option>
                  {audioDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                style={{ ...baseStyles.buttonSecondary, marginTop: '8px' }}
                onClick={loadAudioDevices}
              >
                Refresh Devices
              </button>
            </div>

            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>Audio Settings</h3>
              <div style={baseStyles.field}>
                <label style={baseStyles.label}>Sample Rate</label>
                <select style={baseStyles.select} defaultValue="16000">
                  <option value="16000">16 kHz (Recommended for Whisper)</option>
                  <option value="44100">44.1 kHz</option>
                  <option value="48000">48 kHz</option>
                </select>
              </div>
              <div style={baseStyles.field}>
                <label style={baseStyles.label}>Noise Suppression</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    style={{
                      ...baseStyles.modeButton,
                      flex: 'none',
                      padding: '10px 20px',
                    }}
                  >
                    Off
                  </button>
                  <button
                    style={{
                      ...baseStyles.modeButton,
                      ...baseStyles.modeButtonActive,
                      flex: 'none',
                      padding: '10px 20px',
                    }}
                  >
                    On
                  </button>
                </div>
              </div>
            </div>

            <div style={baseStyles.section}>
              <h3 style={baseStyles.sectionTitle}>Test Microphone</h3>
              <p style={{ ...baseStyles.description, marginBottom: '12px' }}>
                Click the button below to test your microphone
              </p>
              <button style={baseStyles.button}>
                🎙️ Test Microphone
              </button>
            </div>
          </>
        )}
      </main>

      {saved && (
        <div style={baseStyles.saveIndicator}>
          ✓ Saved
        </div>
      )}
    </div>
  );
}
