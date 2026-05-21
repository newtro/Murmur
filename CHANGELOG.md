# Changelog

All notable changes to Murmur are documented here.

Format inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [SemVer](https://semver.org/) at the patch level (the release workflow auto-increments patch).

## v1.0.6 — 2026-05-21

### Added

- **AssemblyAI batch transcription provider.** New cloud STT option alongside Groq / OpenAI / Mistral. Two model tiers: `universal-3-pro` (~$0.0035/min, flagship accuracy) and `universal-2` (~$0.0025/min, budget). Uses `speech_models` with automatic fallback to `universal-2` if the primary model is unavailable. API key configured in Settings → Transcription.
- **Live dictation mode.** Text streams into the focused application as you speak, via AssemblyAI's streaming WebSocket (`u3-rt-pro` model). Toggle in Settings → Transcription → Live Dictation. Two typing modes:
  - **Finals-only (default, recommended):** Text appears in chunks at sentence boundaries. No backspacing into adjacent content. Safer.
  - **Stability-gated partials:** Text streams word-by-word with backspacing on revisions. Closer to Wispr Flow's feel. Configurable stability threshold (50–500 ms, default 150 ms) in Advanced settings. Don't switch focus to other apps mid-utterance.
- **Cross-platform keyboard injection.** New `TypingService` uses `@nut-tree-fork/libnut-{win32,darwin,linux}` directly (skipping the heavier `@nut-tree-fork/nut-js` wrapper) for `keyTap('backspace')` + clipboard-paste hybrid text insertion. Prebuilt native binaries for all three platforms.
- **TypingEngine with two modes + 29 vitest unit tests.** Pure-logic engine that converts streaming turns into TypingService calls. Word-aware longest-common-prefix snap avoids mid-word flicker on partial revisions. First test runner in this repo (vitest with `npm test`, `npm run test:watch`, `npm run test:coverage`).
- **Microphone capability in MSIX manifest** (`<DeviceCapability Name="microphone" />`). Without this, MSIX-installed Murmur was blocked by Windows from `getUserMedia` and threw permission errors on every hotkey press. Existing MSIX installs need to be **uninstalled and reinstalled** to pick up the new capability, then microphone access approved in Settings → Privacy → Microphone.
- **ESLint v9 flat config.** Project had been silently lint-broken since the ESLint 9 upgrade; `npm run lint` now runs cleanly.

### Changed

- **Live-dictation streaming pipeline.** Audio captured at native rate (typically 48 kHz) is downsampled to 16 kHz PCM16 in the renderer via `ScriptProcessorNode`, sent to main as ~85 ms chunks. AssemblyAI requires 50–1000 ms per chunk — earlier 42 ms attempts produced `Input Duration Violation` errors and have been fixed.
- **Settings store invariant.** A hand-edited `murmur-store.json` that has `liveDictationEnabled: true` with a non-streaming provider (or an out-of-range `liveDictationStabilityMs`) is now normalized on load + save instead of crashing or hanging.
- **Forge / Vite native-module bundling.** `forge.config.ts` and `vite.main.config.ts` updated for the new libnut packages + `bindings` + `file-uri-to-path` transitive deps, all now declared as direct dependencies for installer reliability.

### Fixed

- **MSIX microphone permission error on auto-start.** See "Added → Microphone capability" above.
- **Final transcript dropped on hotkey-stop in live mode.** AssemblyAI emits the final formatted turn during the WebSocket close-ack window; the previous gating logic flipped `isLiveDictating=false` too early and discarded the final. Now uses a separate `isLiveStopping` flag plus an explicit `forceEndpoint()` to make the final turn arrive promptly while the engine is still routing.
- **Stale orphan files removed.** `src/renderer/components/settings/{Models,ApiKeys}.tsx` were dead code (zero imports) and had outdated provider lists. Deleted.

### Known limitations

- **Linux Wayland sessions** can't use live dictation. libnut is X11-only; `TypingService.isAvailable()` detects `XDG_SESSION_TYPE === 'wayland'` and reports unavailable. XWayland sessions work normally.
- **macOS Accessibility permission** is required for live dictation to inject keystrokes. The app probes for it before the recording overlay shows and prompts the user if missing.
- **Stream-error fallback to batch** is not yet implemented. If the AssemblyAI WebSocket drops mid-utterance, the session ends with an error overlay rather than transparently re-transcribing via the configured batch fallback provider. Deferred to a future release.

### Migration notes for existing users

- **If you have Murmur installed via MSIX:** uninstall the existing version from Apps & Features, install the new `.msix` from this release, then grant microphone access when Windows prompts (or via Settings → Privacy → Microphone if it doesn't prompt).
- **If you have Murmur installed via NSIS (.exe installer):** just install the new build on top.
- **First live-dictation session** with AssemblyAI requires entering an API key in Settings → Transcription. Sign up at [assemblyai.com/dashboard](https://www.assemblyai.com/dashboard) — the free tier covers light personal use.

---

## Prior releases

GitHub-generated release notes are available on each tag at [github.com/newtro/Murmur/releases](https://github.com/newtro/Murmur/releases).
