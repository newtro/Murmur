// ============================================================================
// JSON File Store for Settings and History
// ============================================================================

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AppSettings, DEFAULT_SETTINGS, TranscriptionHistoryItem } from '../../shared/types';

interface StoreData {
  settings: AppSettings;
  history: TranscriptionHistoryItem[];
  dictionary: string[];
}

let storePath: string = '';
let data: StoreData | null = null;

function defaultData(): StoreData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    history: [],
    dictionary: [],
  };
}

function loadFromDisk(): StoreData {
  try {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      return {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        history: Array.isArray(parsed.history) ? parsed.history : [],
        dictionary: Array.isArray(parsed.dictionary) ? parsed.dictionary : [],
      };
    }
  } catch (error) {
    console.error('[Murmur] Failed to read store file, using defaults:', error);
  }
  return defaultData();
}

function saveToDisk(): void {
  if (!data) return;
  try {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Murmur] Failed to write store file:', error);
  }
}

// ============================================================================
// Database Initialization
// ============================================================================

export async function initializeDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData');

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  storePath = path.join(userDataPath, 'murmur-store.json');
  console.log('[Murmur] Initializing store at:', storePath);

  data = loadFromDisk();
  saveToDisk(); // ensure file exists on first run

  console.log('[Murmur] Store initialized successfully');
}

export function closeDatabase(): void {
  if (data) {
    saveToDisk();
    data = null;
    console.log('[Murmur] Store closed');
  }
}

// ============================================================================
// Settings
// ============================================================================

export function getSettings(): AppSettings {
  if (!data) throw new Error('Store not initialized');
  return { ...data.settings };
}

export function setSettings(settings: AppSettings): void {
  if (!data) throw new Error('Store not initialized');
  data.settings = { ...settings };
  saveToDisk();
}

// ============================================================================
// History
// ============================================================================

export function addHistoryItem(item: TranscriptionHistoryItem): void {
  if (!data) throw new Error('Store not initialized');
  data.history.unshift(item);
  saveToDisk();
}

export function getHistory(limit = 100, offset = 0): TranscriptionHistoryItem[] {
  if (!data) throw new Error('Store not initialized');
  return data.history.slice(offset, offset + limit);
}

export function deleteHistoryItem(id: string): void {
  if (!data) throw new Error('Store not initialized');
  data.history = data.history.filter(item => item.id !== id);
  saveToDisk();
}

export function clearHistory(): void {
  if (!data) throw new Error('Store not initialized');
  data.history = [];
  saveToDisk();
}

// ============================================================================
// Dictionary
// ============================================================================

export function getDictionary(): string[] {
  if (!data) throw new Error('Store not initialized');
  return [...data.dictionary].sort();
}

export function addToDictionary(word: string): void {
  if (!data) throw new Error('Store not initialized');
  const trimmed = word.trim();
  if (!data.dictionary.includes(trimmed)) {
    data.dictionary.push(trimmed);
    saveToDisk();
  }
}

export function removeFromDictionary(word: string): void {
  if (!data) throw new Error('Store not initialized');
  data.dictionary = data.dictionary.filter(w => w !== word.trim());
  saveToDisk();
}
