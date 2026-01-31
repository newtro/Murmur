import React, { useState, useEffect, useCallback } from 'react';
import { Keyboard, Info } from 'lucide-react';
import type { AppSettings, ActivationMode } from '../../../shared/types';

interface HotkeysProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
  saving: boolean;
}

export function Hotkeys({ settings, onUpdate }: HotkeysProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKey, setRecordedKey] = useState<string | null>(null);

  const handleModeChange = async (mode: ActivationMode) => {
    await onUpdate({
      hotkeys: {
        ...settings.hotkeys,
        activationMode: mode,
      },
    });
  };

  const handleHotkeyChange = async (key: string) => {
    await onUpdate({
      hotkeys: {
        ...settings.hotkeys,
        toggleRecording: key,
      },
    });
    setRecordedKey(null);
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordedKey(null);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isRecording) return;

    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');

    // Get the key name
    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    else if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
      // Don't add modifier keys as the main key
      return;
    }

    parts.push(key);
    const hotkey = parts.join('+');
    setRecordedKey(hotkey);
    setIsRecording(false);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isRecording, handleKeyDown]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Hotkey Configuration</h2>
        <p className="text-gray-400 text-sm">
          Configure how you activate voice recording.
        </p>
      </div>

      {/* Activation Mode */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <h3 className="font-medium">Activation Mode</h3>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleModeChange('push-to-talk')}
            className={`
              p-4 rounded-lg border-2 text-left transition-colors
              ${settings.hotkeys.activationMode === 'push-to-talk'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-700 hover:border-gray-600'
              }
            `}
          >
            <div className="font-medium mb-1">Push to Talk</div>
            <div className="text-sm text-gray-400">
              Hold the hotkey to record, release to stop
            </div>
          </button>

          <button
            onClick={() => handleModeChange('toggle')}
            className={`
              p-4 rounded-lg border-2 text-left transition-colors
              ${settings.hotkeys.activationMode === 'toggle'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-700 hover:border-gray-600'
              }
            `}
          >
            <div className="font-medium mb-1">Toggle</div>
            <div className="text-sm text-gray-400">
              Press once to start, press again to stop
            </div>
          </button>
        </div>
      </div>

      {/* Hotkey Assignment */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <h3 className="font-medium">Recording Hotkey</h3>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div
              onClick={startRecording}
              className={`
                flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-colors
                ${isRecording
                  ? 'border-blue-500 bg-blue-500/10 animate-pulse'
                  : 'border-gray-700 hover:border-gray-600'
                }
              `}
            >
              <Keyboard size={20} className="text-gray-400" />
              <span className="font-mono">
                {isRecording
                  ? 'Press any key combination...'
                  : recordedKey || settings.hotkeys.toggleRecording
                }
              </span>
            </div>
          </div>

          {recordedKey && recordedKey !== settings.hotkeys.toggleRecording && (
            <button
              onClick={() => handleHotkeyChange(recordedKey)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
            >
              Apply
            </button>
          )}
        </div>

        <div className="flex items-start gap-2 text-sm text-gray-400">
          <Info size={16} className="mt-0.5 flex-shrink-0" />
          <p>
            Click the box above and press your desired key combination.
            Recommended: Use a key that doesn't conflict with other applications,
            like <code className="bg-gray-700 px-1 rounded">Ctrl+Shift+Space</code> or
            a single key like <code className="bg-gray-700 px-1 rounded">`</code> (backtick).
          </p>
        </div>
      </div>

      {/* Cancel Hotkey */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        <h3 className="font-medium">Cancel Recording</h3>
        <p className="text-sm text-gray-400">
          Press <code className="bg-gray-700 px-2 py-0.5 rounded">Escape</code> at any time
          to cancel the current recording without transcribing.
        </p>
      </div>
    </div>
  );
}
