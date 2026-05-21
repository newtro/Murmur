# Live Dictation + AssemblyAI Provider

**Status:** Draft — pending review
**Owner:** TBD
**Created:** 2026-05-21

## Goal

Add AssemblyAI as a transcription provider, and ship a "live dictation" mode where text streams into the focused input field as the user speaks — competitive with Wispr Flow's flagship behavior.

## Non-goals

- Replacing the existing batch transcription flow. Live dictation is opt-in; default off.
- Multi-language tuning beyond what AssemblyAI supports out of the box.
- Audio enhancements (noise suppression, gain control) beyond what the browser MediaRecorder already does.
- Cloud-side audio retention policy work. AssemblyAI's defaults apply.

## Decisions already locked in

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Platform scope | Windows + macOS + Linux from day one | User requirement. Drives input-injection choice toward a cross-platform lib. |
| 2 | Typing behavior | Both stability-gated partials AND finals-only, user-toggleable | User choice. Default to finals-only (safer). Stability-gated is the "magic" mode. |
| 3 | Feature exposure | Separate "Live dictation" toggle in settings, filters provider list to streaming-capable | Cleanest separation. Future-proof for Deepgram/Soniox/OpenAI Realtime. |
| 4 | Default typing mode | **Finals-only** | Research-backed (2026-05-21). Wispr Flow doesn't actually do in-place partials — their "magic" is fast batch + LLM polish on release. Superwhisper defaults to finals-only. Dragon shows partials in a separate floating box, never in the target doc. Google research treats visible revisions as a metric to minimize. Without our v1 focus-change rail, finals-only is the defensive default. |
| 5 | Stream failure handling | Auto-fallback to batch, quiet toast | Local PCM ring buffer; on stream drop, batch-transcribe what we have via the user's configured fallback provider. |
| 6 | Focus-change safety rail | Ship v1 without it, document the caveat | User decision. "Don't click away while dictating" is a documented sharp edge for v1. Revisit post-launch. |
| 7 | Input injection library | **@nut-tree-fork/libnut-{win32,darwin,linux} v2.7.5 (Apache-2.0)**, hybrid clipboard-paste for text + `keyTap('backspace')` | Research initially picked robotjs v0.7.1 → Step 0 failed (no prebuilds, source build needs ClangCL). First fallback was `@nut-tree-fork/nut-js`, but Phase 3 review flagged its transitive deps (jimp, clipboardy, node-abort-controller) would crash packaged builds. Final pick: skip the nut-js wrapper and bind directly to the platform-specific `libnut-*` packages — robotjs-style API (`keyTap`/`keyToggle`/`typeString`), only `bindings`+`file-uri-to-path` as transitive deps, no image/clipboard provider chain. Hybrid clipboard-for-text approach preserved. |

## Architecture

```
                       ┌─────────────────────────────────────────────┐
                       │                Main Process                 │
                       │                                             │
   Hotkey ────► HotkeyService ──► Recording Lifecycle Coordinator    │
                       │                  │                          │
                       │                  ├─► (batch path, unchanged)│
                       │                  │      TranscriptionService│
                       │                  │      └─► PasteService    │
                       │                  │                          │
                       │                  └─► (live path, new)       │
                       │                       StreamingTranscription│
                       │                          Service            │
                       │                          │                  │
                       │                          ├─► AssemblyAI WS  │
                       │                          │   (u3-rt-pro)    │
                       │                          │                  │
                       │                          └─► TypingEngine   │
                       │                              │              │
                       │                              └─► TypingSvc  │
                       │                                  (libnut)   │
                       └────────▲─────────────────────────┬──────────┘
                                │ IPC: audio chunks       │ IPC: stream state
                                │ + start/stop            │ + partial preview
                       ┌────────┴─────────────────────────▼──────────┐
                       │              Renderer (overlay)             │
                       │                                             │
                       │   useAudioRecording                         │
                       │   ├─ (batch) buffer → one blob on stop      │
                       │   └─ (live)  ScriptProcessor → PCM16 frames │
                       │              every ~50ms via IPC            │
                       └─────────────────────────────────────────────┘
```

**Key separations:**
- `TranscriptionService` (existing, batch) is untouched. New `StreamingTranscriptionService` is a sibling.
- `PasteService` (existing, clipboard+Ctrl+V) is untouched. New `TypingService` is a sibling.
- `useAudioRecording` gains a "live" branch that emits PCM frames during recording; existing batch branch is preserved.

## Phases

### Phase 1 — AssemblyAI batch provider

**Deliverable:** AssemblyAI selectable in provider list, transcribes audio via async upload + poll, on par with existing providers.

**Files:**
- `src/main/services/transcription/assemblyai.ts` — new provider class
- `src/main/services/transcription/index.ts` — register provider, switch case, validation method
- `src/main/services/transcription/errors.ts` — add `assemblyai: 'AssemblyAI'` to label map
- `src/main/index.ts` — `case 'assemblyai'` in `VALIDATE_API_KEY` handler
- `src/shared/types.ts` — extend `TranscriptionProvider` union; add `assemblyai?: string` to `ApiKeys`
- `src/shared/constants.ts` — add `assemblyai` entry to `TRANSCRIPTION_MODELS`
- `src/renderer/components/settings/Settings.tsx` — provider card, key URL/placeholder branches
- `package.json` — `assemblyai` dep

**Implementation notes:**
- Use the official `assemblyai` SDK in main process. Async flow: `client.transcripts.transcribe({ audio: buffer, speech_model: 'universal' })` — SDK handles the upload+poll loop internally.
- Models to expose initially: `universal` (default) and `slam-1` (English-only fast/accurate).
- Pricing copy in model descriptions: verify against assemblyai.com/pricing before merge (avoid stale numbers in user-facing UI).

**Acceptance:**
- User selects AssemblyAI, enters API key, dictates → transcript appears, pasted into focused field, identical UX to Groq/OpenAI.
- API key validation works (likely `GET /v2/transcript/upload_url` check or list-transcripts).
- Lint, typecheck pass.

**Risks:** Minimal. This is mechanical.

---

### Phase 2 — Streaming infrastructure

**Deliverable:** PCM audio frames stream renderer → main → AssemblyAI WebSocket; transcripts flow back. No typing yet — just `console.log` the partials and finals end-to-end to prove the pipe.

**Files:**
- `src/shared/ipc-channels.ts` — new channels:
  - `RECORDING_AUDIO_CHUNK` (renderer → main, PCM16 ArrayBuffer)
  - `STREAMING_SESSION_START` / `STREAMING_SESSION_STOP`
  - `STREAMING_TRANSCRIPT` (main → renderer, `{ transcript, endOfTurn, words }`)
  - `STREAMING_ERROR` (main → renderer)
- `src/renderer/hooks/useAudioRecording.ts` — add `mode: 'batch' | 'live'` option. In live mode:
  - Use `AudioContext` + `ScriptProcessorNode` (or `AudioWorklet`) to capture 16kHz mono PCM16
  - Emit chunks every 50ms via `RECORDING_AUDIO_CHUNK` IPC
  - On stop, send `STREAMING_SESSION_STOP`
- `src/main/services/transcription/assemblyai-streaming.ts` — new class wrapping `client.streaming.transcriber({ sampleRate: 16000, speechModel: 'u3-rt-pro', encoding: 'pcm_s16le', formatTurns: true })`. Exposes:
  - `start()` — connects, sets up event handlers, emits typed events
  - `sendAudio(chunk: Buffer)` — forwards to `transcriber.sendAudio(chunk)`
  - `stop()` — calls `transcriber.close()`
  - `on('turn' | 'error' | 'open' | 'close', ...)` — re-emit AssemblyAI events
- `src/main/services/streaming-transcription.ts` — new orchestrator. Holds active session, listens for IPC chunks, dispatches to AssemblyAI client, forwards turns out via IPC to renderer (for overlay preview).
- `src/main/index.ts` — wire IPC handlers for new channels, instantiate orchestrator.

**Implementation notes:**
- AssemblyAI streaming sample rate is 16kHz — matches `AUDIO.sampleRate` already in `constants.ts`. No resampling needed.
- AssemblyAI emits a single `turn` event with `end_of_turn: boolean`. False = partial (mutable), true = final (committed). Don't invent separate channels; one event type is enough.
- AssemblyAI session has an `expires_at` — sessions are time-limited. For dictation that's a non-issue (we close on stop) but log it.
- WebSocket lives in main process so the API key never reaches renderer.

**Acceptance:**
- Infrastructure exists end-to-end: capture hook, IPC channels, streaming provider, orchestrator, main-process lifecycle hooks, preload bridge.
- Typecheck passes.
- WebSocket lifecycle is bounded — `close()` cannot wedge `stop()` on a dead server; error/close from main triggers renderer teardown.
- ~~Press hotkey with live mode on, speak → console shows partial transcripts updating ~3x/sec, then a final on pause.~~ — **Deferred to Phase 6.** This smoke test requires the live-mode settings toggle (Phase 5) and the hotkey→mode routing (Phase 6) to be wired. Phase 2 cannot smoke-test in isolation; the user calling startStreamingSession through a temporary trigger would prove pipe-correctness but would be code that gets ripped out in Phase 6 anyway. The orchestrator's end-to-end behavior is verified in Phase 6's acceptance instead.

**Risks:**
- `ScriptProcessorNode` is deprecated. `AudioWorklet` is the modern replacement but adds bundler complexity. Start with `ScriptProcessorNode` (it still works), migrate to AudioWorklet if perf is an issue.
- PCM16 conversion in the browser is non-trivial — need to convert Float32 → Int16 explicitly. Have a small utility in `useAudioRecording.ts`.

---

### Phase 3 — Cross-platform input injection (highest risk)

**Deliverable:** A `TypingService` that can insert arbitrary unicode text and press Backspace, working on Windows, macOS, Linux. Hybrid design: clipboard-paste for text insertion (unicode-safe, layout-independent), libnut `keyTap` for Backspace and the Ctrl/Cmd+V trigger. Verified by manual test on each platform.

**Step 0 (BLOCKER — completed 2026-05-21):**
Verified the open risk surfaced in research:
1. ✅ Attempted `npm install robotjs@^0.7.1`. GitHub release v0.7.1 has empty `assets: []` — no prebuilds. `prebuild-install` fell back to source build via node-gyp.
2. ❌ Source build failed: `error MSB8020: The build tools for ClangCL (Platform Toolset = 'ClangCL') cannot be found`. binding.gyp explicitly requires a toolset not commonly installed alongside VS BuildTools. Even with VS 2022 BuildTools present, this fails out-of-the-box.
3. ✅ First fallback was `@nut-tree-fork/nut-js@^4.2.6`. Installed cleanly, but adversarial review caught a BLOCKER: nut-js's transitive deps (jimp, clipboardy, node-abort-controller) load eagerly at module-load time. Externalizing nut-js without bundling jimp et al would crash any packaged build with `Cannot find module 'jimp'`.
4. ✅ Final pick: skip the nut-js wrapper and bind directly to `@nut-tree-fork/libnut-{win32,darwin,linux}@^2.7.5`. These are the thin native packages underneath nut-js — robotjs-style `keyTap`/`keyToggle`/`typeString` API, prebuilt .node binaries, only `bindings`+`file-uri-to-path` as transitive deps. Loaded via `require('@nut-tree-fork/libnut-${process.platform}')`.

Outcome: API surface used is `libnut.keyTap('v', 'control'|'command')` for paste, `libnut.keyTap('backspace')` for backspace, `libnut.setKeyboardDelay(5)` once at construction. Bundle is much leaner than the nut-js path would have been; we trade nut-js's TypeScript-typed Key enum for plain string keys.

**Files:**
- `src/main/services/typing.ts` — new service. Interface:
  ```typescript
  class TypingService {
    insertText(text: string): Promise<void>;   // clipboard + Cmd/Ctrl+V via libnut.keyTap
    backspace(count: number): Promise<void>;   // libnut.keyTap('backspace') × count
    isAvailable(): boolean;                    // macOS Accessibility + Linux Wayland detection (sync)
    promptForAccessibility(): boolean;         // macOS-only: trigger OS prompt
  }
  ```
  `insertText`:
  1. Write `text` to clipboard.
  2. Wait CLIPBOARD_PROPAGATE_DELAY_MS (50) for the OS to propagate.
  3. `libnut.keyTap('v', 'command'|'control')` — atomic chord.
  We deliberately do NOT restore the previous clipboard: `clipboard.readText()` returns `''` for non-text contents, so a restore would wipe images/files. Existing PasteService makes the same trade.
  `backspace`: loop with `libnut.keyTap('backspace')` and 25ms sleep between (macOS drops rapid-fire keystrokes above ~10/sec).
- `package.json` — `@nut-tree-fork/libnut-{win32,darwin,linux}` ^2.7.5
- `forge.config.ts` — added libnut platform packages + `bindings` + `file-uri-to-path` to `NATIVE_MODULES`; added all to `asar.unpack` glob
- `vite.main.config.ts` — externalized libnut platform packages and `bindings`
- Platform setup docs (in README + onboarding):
  - **macOS**: requires Accessibility permission (`System Settings → Privacy & Security → Accessibility → Murmur`). App likely already prompts due to `uiohook-napi` — verify and reuse the prompt flow.
  - **Linux**: `libXtst.so.6` runtime (present on most desktops). **Wayland not supported** by libnut — `isAvailable()` detects `XDG_SESSION_TYPE === 'wayland'` and returns false. Users on GNOME 47+/Ubuntu 25.10/KDE 6.8 must run XWayland session. Future work: `ydotool`/`libei` backend.
  - **Windows**: no extra setup. SendInput just works.

**Implementation notes:**
- The existing `PasteService` (clipboard + PowerShell SendKeys for Ctrl+V) becomes obsolete on the live-dictation path and is a candidate for replacement on the batch path too — `TypingService.insertText()` is faster and cross-platform. Defer the batch-path migration to a follow-up; in Phase 3 we leave PasteService alone for batch and only use TypingService on live path.
- Clipboard stash/restore race: between writing our text and the user copying something else, there's a tiny window. Match the existing `PasteService` pattern (currently doesn't restore — by design per inline comment); we keep the same trade-off.
- macOS Accessibility permission: detect at startup via `systemPreferences.isTrustedAccessibilityClient(false)` (Electron API), show onboarding card if missing. Don't silently fail.

**Acceptance:**
- Step 0 prototype passes — prebuilds resolve cleanly on Win/Mac/Linux.
- On each platform: open a text app, call `insertText("hello world")` → text appears in <100ms.
- Call `backspace(5)` → last 5 chars deleted, no drops.
- Call `insertText("café — naïve “smart” quotes")` → all unicode renders correctly (clipboard path makes this free).
- Permission-missing case on macOS shows a clear in-app message instead of silent no-op.

**Risks:**
- **Prebuild availability (highest):** mitigated by Step 0 prototype.
- **nut-tree-fork maintainer continuity:** the community fork is at libnut v2.7.5 (Apr 2025) and nut.js v4.2.6 (Mar 2025) — slower cadence than the original. If it stalls, fallbacks are robotjs (when prebuilds resurface) or hand-rolled N-API per platform.
- **Wayland gap on Linux:** documented as a v1 limitation. The library landscape doesn't have a clean solution today; revisit when enigo's Node bindings mature or when GNOME forces our hand.

---

### Phase 4 — Diff/typing engine

**Deliverable:** Glue between `StreamingTranscriptionService` turn events and `TypingService` calls. Two modes: finals-only and stability-gated partials.

**Files:**
- `src/main/services/typing-engine.ts` — new pure-logic module (testable without IPC). State:
  ```typescript
  {
    committedPrefix: string;   // what we've typed
    pendingPartial: string;    // latest partial we haven't committed
    pendingSince: number;      // timestamp partial was first seen
    mode: 'finals' | 'partials';
    stabilityMs: number;       // partials mode only
  }
  ```
  Methods:
  - `onTurn({ transcript, endOfTurn })` — main entry point
  - `tick()` — called from a 50ms timer; in partials mode, checks if `pendingPartial` has been stable long enough to commit
  - `flush()` — force-commit any pending text on session end
  - `reset()` — clear state, called on session start
- `src/main/services/streaming-transcription.ts` — wires `StreamingTranscriptionService` → `TypingEngine` → `TypingService`.
- Unit tests for the engine (no Electron deps, plain Jest if we add it, or just verify by inspection — repo has no test infra today). Worth proposing test infra alongside this; the diff logic is the one place real bugs will hide.

**Algorithm — finals-only mode:**
```
onTurn({ transcript, endOfTurn }):
  if endOfTurn:
    typingService.typeText(transcript + ' ')
    reset()
```

**Algorithm — stability-gated partials mode:**
```
onTurn({ transcript, endOfTurn }):
  if endOfTurn:
    commitToPrefix(transcript + ' ')   # final flush
    reset()
  else:
    pendingPartial = transcript
    pendingSince = now()

tick():  # every 50ms
  if pendingPartial && now() - pendingSince >= stabilityMs:
    commitToPrefix(pendingPartial)

commitToPrefix(newText):
  lcp = longestCommonPrefix(committedPrefix, newText)
  toDelete = committedPrefix.length - lcp
  toInsert = newText.slice(lcp)
  if toDelete > 0: typingService.backspace(toDelete)
  if toInsert: typingService.insertText(toInsert)
  committedPrefix = newText
```

Note: this leverages AssemblyAI's `u3-rt-pro` immutable-partials property — once a token is emitted at ~300ms, it isn't rewritten. So most `commitToPrefix` calls will have `toDelete === 0` and only need to insert the new suffix. Backspacing only happens when the endpointer decides a turn boundary differs from earlier guesses, which is rare in dictation usage.

**Implementation notes:**
- LCP must be word-aware, not character-aware, or you'll backspace mid-word and the user sees flickering. Snap LCP boundary to whitespace.
- `stabilityMs` default: 150ms. Configurable in advanced settings (hidden field for now, can expose later).
- Safety: if focus changes mid-utterance, abort. Detect focus change via... TBD — need to investigate Electron's `app.on('browser-window-blur')` won't help (we're typing into external apps). Probably need a platform-specific "current foreground window changed" check. **Open question, see below.**

**Acceptance:**
- Finals-only: speak "hello world. how are you." → text appears in two chunks at sentence boundaries, no flickering.
- Partials mode: speak slowly → text appears word-by-word with ~150ms lag, revisions cause clean backspace+retype, no duplicates or drops.
- Both modes: speak then cancel → no text committed.

**Risks:**
- Race between rapid partials and slow libnut calls — partials can arrive faster than we can type. Need a queue or "drop intermediate partials, only act on latest" debouncing.
- Sentence-boundary punctuation: AssemblyAI partials don't always have trailing punctuation; finals do. Handle the space-insertion carefully so you don't end up with `"hello.world"` or `"hello  world"`.

---

### Phase 5 — Settings UI and mode plumbing

**Deliverable:** User can toggle live dictation on, pick typing mode, save settings.

**Files:**
- `src/shared/types.ts`:
  - Extend `AppSettings`:
    ```typescript
    liveDictationEnabled: boolean;          // default false
    liveDictationTypingMode: 'partials' | 'finals';  // default 'finals'
    liveDictationStabilityMs: number;       // default 150, advanced
    ```
  - Add to `DEFAULT_SETTINGS`.
- `src/renderer/components/settings/Settings.tsx`:
  - New section card "Live Dictation" with main toggle.
  - When ON: provider list shows only streaming-capable providers (filter by a new flag on the provider config). Show "Live" badge on eligible cards.
  - Sub-toggle: typing mode radio (Stability-gated partials / Finals-only). Default Finals-only with explanatory copy.
  - Sub-toggle hidden behind "Advanced": stability threshold slider (50–500ms).
- A small "streamingCapable: true" flag on the AssemblyAI entry in the provider config array.

**Acceptance:**
- Toggle on → AssemblyAI is the only provider visible.
- Toggle off → all providers visible, AssemblyAI behaves as Phase 1 batch.
- Settings persist across restart.
- If user has Live ON but switches transcription provider via direct settings edit, app gracefully reverts to batch with a warning.

**Risks:** Minimal. UI work.

---

### Phase 6 — Recording flow integration & error handling

**Deliverable:** Hotkey press in live mode actually triggers the streaming pipeline end-to-end and produces typed output. **Also covers Phase 2's deferred smoke-test acceptance** (end-to-end streaming verification — first opportunity to do this with real components).

**Files:**
- `src/main/index.ts` — recording start/stop logic checks `liveDictationEnabled`, routes to either existing batch flow or new streaming flow.
- `src/renderer/overlay.tsx` — overlay states extended:
  - "Listening (live)" with optional small partial-text preview
  - "Falling back to batch" if stream fails mid-utterance
- Local audio ring buffer in renderer: keep last N seconds of PCM in case streaming fails and we need to batch-transcribe the buffered audio as fallback.

**Implementation notes:**
- Fallback path: if AssemblyAI WebSocket errors mid-utterance, send the ring-buffer audio through the existing batch `TranscriptionService` with the user's configured fallback provider (existing `transcriptionFallbackProvider` field). Surface a one-time toast: "Streaming failed, used fallback".
- Don't auto-reconnect mid-utterance — too disruptive. Just let the current utterance fail to batch fallback, and try fresh on the next hotkey press.

**Acceptance:**
- End-to-end manual test passes on each platform: hotkey → speak → text streams into Notepad/TextEdit/gedit → release hotkey → final pending text commits.
- Force a stream error (kill network mid-utterance) → fallback path triggers, user sees toast, final transcript still appears (batch-mode).
- Cancel hotkey aborts cleanly with nothing typed.

**Risks:**
- Coordinating "stream is active" state between main and renderer is fiddly. Single source of truth in main, mirrored to overlay via IPC.

## Open questions to resolve before/during build

1. ~~**Focus-change detection.**~~ **Resolved (2026-05-21):** ship v1 without it, documented caveat. Revisit post-launch if users hit the sharp edge in practice.

2. ~~**Should we add a test runner?**~~ **Resolved (2026-05-21):** yes, add `vitest` in Phase 4 to unit-test the diff engine.

3. **macOS Accessibility permission flow.** User has a MacBook Pro M4 for testing. If `uiohook-napi` already triggers the permission prompt, we piggyback. If not, explicit "Grant Accessibility" step in onboarding. **Verify on M4 during Phase 3.**

4. **Audio encoding nit.** Renderer captures via Web Audio at the browser's preferred rate (typically 48kHz on desktop). AssemblyAI streaming wants 16kHz PCM16. We need to downsample. Browser-side `OfflineAudioContext` resample, or a small JS downsampler in the worklet. **Phase 2 implementation detail.**

5. **Rate limits.** AssemblyAI streaming has concurrency and minute-quota limits. Document where to find these and surface 429s as a clear user-facing error. **Phase 1 error mapping.**

6. **robotjs prebuilds availability.** Phase 3 Step 0 — verify v0.7.1 release has prebuilt binaries for all target platforms before committing. Fallback identified (`@nut-tree-fork/nut-js`).

7. ~~**Wayland gap on Linux.**~~ **Resolved (2026-05-21):** libnut doesn't support Wayland. `TypingService.isAvailable()` detects `XDG_SESSION_TYPE === 'wayland'` and returns false so the caller can surface a clear message. XWayland sessions report `x11` and pass through. Future work for a real Wayland backend: `ydotool` or `libei` (watch enigo's Node bindings).

## Effort estimate

| Phase | Estimate | Risk |
|-------|----------|------|
| 1. AssemblyAI batch | ½ day | Low |
| 2. Streaming infrastructure | 1 day | Medium (audio encoding) |
| 3. Cross-platform typing | 2 days | **High** (libnut + platform setup) |
| 4. Diff/typing engine | 1 day | Medium (revision logic) |
| 5. Settings UI | ½ day | Low |
| 6. Integration & fallback | ½ day | Medium |
| **Total** | **~5–6 days** | |

Each phase ends with a check-in. Phase 3 was the riskiest — final library pick (libnut platform packages) verified to install with prebuilt binaries on the dev box and pass typecheck. Per-platform manual smoke test still pending (Phase 6).

## What this plan deliberately does NOT include

- **Auto-punctuation polish.** AssemblyAI streaming includes basic punctuation; we don't pile LLM cleanup on top. The "Polish" LLM mode users already have works fine for batch; live mode trades polish for latency by design.
- **Custom vocabulary.** AssemblyAI supports `word_boost`/custom vocab. Defer to a future enhancement.
- **Speaker diarization.** Not relevant for single-user dictation.
- **Voice activity detection on our side.** AssemblyAI handles end-of-turn detection server-side; we don't need a local VAD.
