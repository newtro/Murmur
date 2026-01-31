# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Murmur is an open-source AI voice dictation desktop app (Wispr Flow alternative) built with Electron, React, TypeScript, and Vite. It captures voice input, transcribes it using various AI providers, optionally processes the text with an LLM, and pastes the result into the active application.

## Build Commands

```bash
npm start              # Start in development mode with hot-reload
npm run package        # Package the app for distribution
npm run make           # Create platform installers
npm run lint           # Run ESLint
npm run typecheck      # Run TypeScript type checking
```

## Architecture

### Process Model (Electron)

The app follows Electron's multi-process architecture:

- **Main Process** (`src/main/`) - Node.js backend handling system interactions, services, and window management
- **Preload Script** (`src/preload/`) - Bridge exposing safe APIs to renderer via `window.murmur`
- **Renderer Process** (`src/renderer/`) - React UI for settings window and overlay

### Entry Points

- `src/main/index.ts` - Main process entry, initializes app, tray, windows, and services
- `src/renderer/main.tsx` - Settings window React app
- `src/renderer/overlay.tsx` - Recording overlay React app (separate entry point)

### IPC Communication

All IPC channels are defined in `src/shared/ipc-channels.ts`. The preload script (`src/preload/index.ts`) exposes a typed `window.murmur` API that renderer components use. Never use `ipcRenderer` directly in renderer code.

### Service Layer (`src/main/services/`)

- **TranscriptionService** - Unified interface for transcription providers (Groq, OpenAI, local Whisper)
- **LLMService** - Unified interface for LLM providers (OpenAI, Anthropic, Gemini, Groq, Ollama)
- **HotkeyService** - Global hotkey detection using `uiohook-napi`
- **PasteService** - Cross-platform clipboard and paste automation

### Windows

- **Overlay Window** (`src/main/windows/overlay.ts`) - Transparent, always-on-top pill showing recording state
- **Settings Window** (`src/main/windows/settings.ts`) - Configuration UI

### State & Storage

- **Database** (`src/main/db/store.ts`) - SQLite via `sql.js` (WebAssembly) for settings and history
- **Zustand** - Used for renderer-side state management

### Recording Flow

1. User presses hotkey → HotkeyService emits event
2. Main process sends `RECORDING_START` to overlay window
3. Overlay captures audio via Web Audio API (`useAudioRecording` hook)
4. On stop, audio buffer sent to main via IPC
5. TranscriptionService converts audio to text
6. LLMService optionally processes text (clean/polish modes)
7. PasteService types result into active application

### Shared Code (`src/shared/`)

- `types.ts` - TypeScript types, interfaces, and default settings
- `ipc-channels.ts` - IPC channel name constants
- `constants.ts` - App configuration (audio settings, processing prompts, model lists)

## Key Patterns

### Adding a New Provider

1. Create provider class in `src/main/services/transcription/` or `src/main/services/llm/`
2. Add to the unified service's constructor and switch statement
3. Update `TranscriptionProvider` or `LLMProvider` type in `src/shared/types.ts`
4. Add models to `TRANSCRIPTION_MODELS` or `LLM_MODELS` in `src/shared/constants.ts`

### Vite Configuration

Multiple Vite configs exist for different build targets:
- `vite.main.config.ts` - Main process (externals: electron, uiohook-napi, sql.js)
- `vite.preload.config.ts` - Preload script
- `vite.renderer.config.ts` - Renderer with React, builds both `index.html` and `overlay.html`

### Native Dependencies

- `uiohook-napi` - Global hotkey capture (requires rebuild for Electron)
- `sql.js` - SQLite compiled to WASM
