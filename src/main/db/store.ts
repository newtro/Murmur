// ============================================================================
// SQLite Database Store for Settings and History
// Uses sql.js (SQLite compiled to WebAssembly) for cross-platform compatibility
// ============================================================================

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AppSettings, DEFAULT_SETTINGS, TranscriptionHistoryItem } from '../../shared/types';

let db: SqlJsDatabase | null = null;
let dbPath: string = '';
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// ============================================================================
// Database Initialization
// ============================================================================

export async function initializeDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'murmur.db');

  console.log('[Murmur] Initializing database at:', dbPath);

  // Initialize sql.js with locateFile to find WASM in packaged app
  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      // In packaged app, WASM is in the same directory as the main bundle
      if (app.isPackaged) {
        return path.join(__dirname, file);
      }
      // In development, use node_modules path
      return path.join(__dirname, '../../node_modules/sql.js/dist', file);
    },
  });

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('[Murmur] Loaded existing database');
    } catch (error) {
      console.error('[Murmur] Failed to load database, creating new:', error);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    console.log('[Murmur] Created new database');
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      original_text TEXT NOT NULL,
      processed_text TEXT NOT NULL,
      duration REAL NOT NULL,
      transcription_provider TEXT NOT NULL,
      llm_provider TEXT,
      processing_mode TEXT NOT NULL,
      app_name TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dictionary (
      word TEXT PRIMARY KEY,
      added_at INTEGER NOT NULL
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp DESC)`);

  // Initialize settings if empty
  const result = db.exec('SELECT COUNT(*) as count FROM settings');
  const count = result.length > 0 ? result[0].values[0][0] as number : 0;
  if (count === 0) {
    setSettings(DEFAULT_SETTINGS);
  }

  // Save database to disk
  saveDatabase();

  console.log('[Murmur] Database initialized successfully');
}

function saveDatabase(): void {
  if (!db) return;

  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (error) {
    console.error('[Murmur] Failed to save database:', error);
  }
}

// Debounced save to avoid excessive disk writes
function scheduleSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveDatabase();
    saveTimer = null;
  }, 1000);
}

export function closeDatabase(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

// ============================================================================
// Settings
// ============================================================================

export function getSettings(): AppSettings {
  if (!db) throw new Error('Database not initialized');

  const result = db.exec("SELECT value FROM settings WHERE key = 'app_settings'");

  if (result.length > 0 && result[0].values.length > 0) {
    try {
      return JSON.parse(result[0].values[0][0] as string) as AppSettings;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  return DEFAULT_SETTINGS;
}

export function setSettings(settings: AppSettings): void {
  if (!db) throw new Error('Database not initialized');

  db.run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)",
    [JSON.stringify(settings)]
  );

  scheduleSave();
}

// ============================================================================
// History
// ============================================================================

export function addHistoryItem(item: TranscriptionHistoryItem): void {
  if (!db) throw new Error('Database not initialized');

  db.run(
    `INSERT INTO history (
      id, timestamp, original_text, processed_text, duration,
      transcription_provider, llm_provider, processing_mode, app_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.timestamp,
      item.originalText,
      item.processedText,
      item.duration,
      item.transcriptionProvider,
      item.llmProvider || null,
      item.processingMode,
      item.appName || null
    ]
  );

  scheduleSave();
}

export function getHistory(limit = 100, offset = 0): TranscriptionHistoryItem[] {
  if (!db) throw new Error('Database not initialized');

  const result = db.exec(
    `SELECT * FROM history ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`
  );

  if (result.length === 0) return [];

  const columns = result[0].columns;
  const rows = result[0].values;

  return rows.map((row: (number | string | Uint8Array | null)[]) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col: string, idx: number) => {
      obj[col] = row[idx];
    });

    return {
      id: obj.id as string,
      timestamp: obj.timestamp as number,
      originalText: obj.original_text as string,
      processedText: obj.processed_text as string,
      duration: obj.duration as number,
      transcriptionProvider: obj.transcription_provider as TranscriptionHistoryItem['transcriptionProvider'],
      llmProvider: obj.llm_provider as TranscriptionHistoryItem['llmProvider'],
      processingMode: obj.processing_mode as TranscriptionHistoryItem['processingMode'],
      appName: (obj.app_name as string) || undefined,
    };
  });
}

export function deleteHistoryItem(id: string): void {
  if (!db) throw new Error('Database not initialized');

  db.run('DELETE FROM history WHERE id = ?', [id]);
  scheduleSave();
}

export function clearHistory(): void {
  if (!db) throw new Error('Database not initialized');

  db.run('DELETE FROM history');
  scheduleSave();
}

// ============================================================================
// Dictionary
// ============================================================================

export function getDictionary(): string[] {
  if (!db) throw new Error('Database not initialized');

  const result = db.exec('SELECT word FROM dictionary ORDER BY word');

  if (result.length === 0) return [];

  return result[0].values.map((row: (number | string | Uint8Array | null)[]) => row[0] as string);
}

export function addToDictionary(word: string): void {
  if (!db) throw new Error('Database not initialized');

  db.run(
    'INSERT OR IGNORE INTO dictionary (word, added_at) VALUES (?, ?)',
    [word.trim(), Date.now()]
  );

  scheduleSave();
}

export function removeFromDictionary(word: string): void {
  if (!db) throw new Error('Database not initialized');

  db.run('DELETE FROM dictionary WHERE word = ?', [word.trim()]);
  scheduleSave();
}
