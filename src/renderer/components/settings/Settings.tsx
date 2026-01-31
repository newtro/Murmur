import React, { useState, useEffect } from 'react';
import type { AppSettings } from '../../../shared/types';

// Simple inline styles for debugging - no Tailwind dependency
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#111827',
    color: 'white',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '20px',
  },
  header: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#60a5fa',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#111827',
    color: 'white',
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  tab: {
    padding: '10px 20px',
    backgroundColor: '#374151',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
  },
  tabActive: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
  },
  section: {
    backgroundColor: '#1f2937',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '15px',
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    color: '#9ca3af',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#374151',
    border: '1px solid #4b5563',
    borderRadius: '6px',
    color: 'white',
    fontSize: '14px',
    marginBottom: '15px',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
  },
  error: {
    color: '#ef4444',
    padding: '10px',
    backgroundColor: '#7f1d1d',
    borderRadius: '6px',
    marginBottom: '15px',
  },
};

type Tab = 'api-keys' | 'hotkeys' | 'models';

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('api-keys');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    console.log('[Settings] Loading settings...');
    try {
      if (!window.murmur) {
        throw new Error('window.murmur is not defined - preload script not loaded');
      }
      const currentSettings = await window.murmur.getSettings();
      console.log('[Settings] Settings loaded:', currentSettings);
      setSettings(currentSettings);
    } catch (err) {
      console.error('[Settings] Failed to load settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateApiKey = async (provider: string, value: string) => {
    if (!settings) return;
    try {
      const updated = await window.murmur.setSettings({
        apiKeys: {
          ...settings.apiKeys,
          [provider]: value,
        },
      });
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update API key:', err);
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div>Loading settings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <h1 style={styles.header}>Murmur Settings</h1>
        <div style={styles.error}>
          <strong>Error:</strong> {error}
        </div>
        <button style={styles.button} onClick={loadSettings}>
          Retry
        </button>
      </div>
    );
  }

  if (!settings) {
    return (
      <div style={styles.container}>
        <h1 style={styles.header}>Murmur Settings</h1>
        <div style={styles.error}>No settings available</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Murmur Settings</h1>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={activeTab === 'api-keys' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('api-keys')}
        >
          API Keys
        </button>
        <button
          style={activeTab === 'hotkeys' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('hotkeys')}
        >
          Hotkeys
        </button>
        <button
          style={activeTab === 'models' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('models')}
        >
          Models
        </button>
      </div>

      {/* API Keys Tab */}
      {activeTab === 'api-keys' && (
        <div>
          <div style={styles.section}>
            <label style={styles.label}>Groq API Key</label>
            <input
              type="password"
              style={styles.input}
              value={settings.apiKeys.groq || ''}
              onChange={(e) => updateApiKey('groq', e.target.value)}
              placeholder="gsk_..."
            />
          </div>

          <div style={styles.section}>
            <label style={styles.label}>OpenAI API Key</label>
            <input
              type="password"
              style={styles.input}
              value={settings.apiKeys.openai || ''}
              onChange={(e) => updateApiKey('openai', e.target.value)}
              placeholder="sk-..."
            />
          </div>

          <div style={styles.section}>
            <label style={styles.label}>Anthropic API Key</label>
            <input
              type="password"
              style={styles.input}
              value={settings.apiKeys.anthropic || ''}
              onChange={(e) => updateApiKey('anthropic', e.target.value)}
              placeholder="sk-ant-..."
            />
          </div>

          <div style={styles.section}>
            <label style={styles.label}>Google Gemini API Key</label>
            <input
              type="password"
              style={styles.input}
              value={settings.apiKeys.gemini || ''}
              onChange={(e) => updateApiKey('gemini', e.target.value)}
              placeholder="AIza..."
            />
          </div>
        </div>
      )}

      {/* Hotkeys Tab */}
      {activeTab === 'hotkeys' && (
        <div style={styles.section}>
          <label style={styles.label}>Activation Mode</label>
          <p style={{ color: '#9ca3af', marginBottom: '10px' }}>
            Current: {settings.hotkeys.activationMode}
          </p>
          <label style={styles.label}>Hotkey</label>
          <p style={{ color: '#9ca3af' }}>
            Current: {settings.hotkeys.toggleRecording}
          </p>
        </div>
      )}

      {/* Models Tab */}
      {activeTab === 'models' && (
        <div>
          <div style={styles.section}>
            <label style={styles.label}>Transcription Provider</label>
            <p style={{ color: '#9ca3af', marginBottom: '10px' }}>
              Current: {settings.transcriptionProvider}
            </p>
            <label style={styles.label}>Transcription Model</label>
            <p style={{ color: '#9ca3af' }}>
              Current: {settings.transcriptionModel}
            </p>
          </div>

          <div style={styles.section}>
            <label style={styles.label}>LLM Provider</label>
            <p style={{ color: '#9ca3af', marginBottom: '10px' }}>
              Current: {settings.llmProvider}
            </p>
            <label style={styles.label}>Processing Mode</label>
            <p style={{ color: '#9ca3af' }}>
              Current: {settings.processingMode}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
