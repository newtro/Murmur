import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, Key, Keyboard, Cpu, BookOpen, X } from 'lucide-react';
import { ApiKeys } from './ApiKeys';
import { Hotkeys } from './Hotkeys';
import { Models } from './Models';
import { Dictionary } from './Dictionary';
import type { AppSettings } from '../../../shared/types';

type Tab = 'api-keys' | 'hotkeys' | 'models' | 'dictionary';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'api-keys', label: 'API Keys', icon: <Key size={18} /> },
  { id: 'hotkeys', label: 'Hotkeys', icon: <Keyboard size={18} /> },
  { id: 'models', label: 'Models', icon: <Cpu size={18} /> },
  { id: 'dictionary', label: 'Dictionary', icon: <BookOpen size={18} /> },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('api-keys');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentSettings = await window.murmur.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<AppSettings>) => {
    if (!settings) return;

    setSaving(true);
    try {
      const updated = await window.murmur.setSettings(updates);
      setSettings(updated);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    window.murmur.closeSettings();
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <SettingsIcon className="text-blue-400" size={24} />
            <h1 className="text-xl font-semibold">Murmur Settings</h1>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 px-6 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'api-keys' && (
              <ApiKeys
                settings={settings}
                onUpdate={updateSettings}
                saving={saving}
              />
            )}
            {activeTab === 'hotkeys' && (
              <Hotkeys
                settings={settings}
                onUpdate={updateSettings}
                saving={saving}
              />
            )}
            {activeTab === 'models' && (
              <Models
                settings={settings}
                onUpdate={updateSettings}
                saving={saving}
              />
            )}
            {activeTab === 'dictionary' && (
              <Dictionary />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Saving indicator */}
      <AnimatePresence>
        {saving && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
          >
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Saving...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
