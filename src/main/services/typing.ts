// ============================================================================
// Typing Service — keyboard injection for live dictation
//
// Hybrid approach (per the live-dictation plan):
//   • insertText: clipboard + Cmd/Ctrl+V — unicode-safe, layout-independent
//   • backspace : direct keystroke via libnut
//
// Library: @nut-tree-fork/libnut-{win32,darwin,linux} (Apache-2.0). These
// are the thin native wrappers underneath the nut.js fork — robotjs-style
// API (keyTap, keyToggle, typeString) with only `bindings` as a transitive
// dep. We deliberately AVOID @nut-tree-fork/nut-js because its higher-level
// wrapper pulls in jimp + clipboardy + node-abort-controller at module-load
// time, none of which we need, and all of which complicate the packaged
// app's bundle.
//
// History: Phase 3 Step 0 attempted robotjs first (per plan's primary pick).
// robotjs v0.7.1 ships no prebuilt binaries on its GitHub release and its
// binding.gyp requires ClangCL on Windows — local source build failed. We
// fell back to nut-tree-fork's libnut packages, which ship prebuilt .node
// files for all three platforms.
//
// macOS: requires Accessibility permission (System Settings → Privacy &
// Security → Accessibility → Murmur). Without it, keystrokes silently no-op.
// We probe via Electron's systemPreferences.isTrustedAccessibilityClient.
//
// Linux Wayland: libnut uses X11 only. Wayland sessions silently fail. We
// detect XDG_SESSION_TYPE === 'wayland' and report unavailable so the caller
// can surface a clear message instead of letting users wonder why nothing
// types.
// ============================================================================

import { clipboard, systemPreferences } from 'electron';

// libnut platform packages all expose the same surface (per their .d.ts files):
//   keyTap(key, modifier?)        — press+release in one call (preferred for V)
//   keyToggle(key, down, mod?)    — hold/release for chord building
//   typeString(string)            — direct keystroke typing
//   setKeyboardDelay(ms)          — global inter-keystroke delay
interface LibNut {
  keyTap(key: string, modifier?: string | string[]): void;
  keyToggle(key: string, down: string, modifier?: string | string[]): void;
  setKeyboardDelay(ms: number): void;
  typeString(s: string): void;
}

function loadLibNut(): LibNut {
  // require() (not import) so the platform-specific package is only loaded
  // when its branch is taken — avoids the renderer-side import graph touching
  // packages that only ship a .node binary for the OTHER platforms.
  switch (process.platform) {
    case 'win32':
      return require('@nut-tree-fork/libnut-win32') as LibNut;
    case 'darwin':
      return require('@nut-tree-fork/libnut-darwin') as LibNut;
    case 'linux':
      return require('@nut-tree-fork/libnut-linux') as LibNut;
    default:
      throw new Error(`Unsupported platform for typing injection: ${process.platform}`);
  }
}

// Wait before triggering paste so the OS clipboard write propagates to the
// focused app. Matches the existing PasteService cadence (paste.ts:57).
const CLIPBOARD_PROPAGATE_DELAY_MS = 50;
// Throttle between Backspace keystrokes. macOS drops rapid-fire events above
// ~10/s. 25ms gives ~40Hz which is well under that ceiling.
const BACKSPACE_INTERVAL_MS = 25;
// Native libnut keyboard delay. Default is 300ms which is far too slow for
// dictation. Setting it once at boot is sufficient; it's a global on the
// native module.
const NATIVE_KEYBOARD_DELAY_MS = 5;

let libNutInitialized = false;

export class TypingService {
  private libnut: LibNut;

  constructor() {
    this.libnut = loadLibNut();
    if (!libNutInitialized) {
      this.libnut.setKeyboardDelay(NATIVE_KEYBOARD_DELAY_MS);
      libNutInitialized = true;
    }
  }

  /**
   * Insert `text` at the focused application's caret using the OS clipboard.
   *
   * We deliberately do NOT restore the user's previous clipboard contents.
   * Rationale: `clipboard.readText()` returns `''` for non-text clipboard
   * types (images, files, custom formats), and a "restore" would then wipe
   * the user's clipboard with the empty string. The existing PasteService
   * makes the same trade-off (see paste.ts:66). Users who copy text and
   * then dictate will see their clipboard replaced — flagged as a known
   * Phase 6 polish item.
   */
  async insertText(text: string): Promise<void> {
    if (!text) return;

    console.log(`[Typing] insertText len=${text.length} text="${text.slice(0, 80)}"`);
    clipboard.writeText(text);
    // Some apps read the clipboard immediately on paste; ensure propagation.
    await sleep(CLIPBOARD_PROPAGATE_DELAY_MS);
    const modifier = process.platform === 'darwin' ? 'command' : 'control';
    // keyTap atomically holds modifier, sends V down+up, releases modifier —
    // the idiomatic libnut chord pattern. Avoids the down/down/up/up race
    // that pressKey/releaseKey would invite.
    this.libnut.keyTap('v', modifier);
  }

  /**
   * Send `count` Backspace keystrokes to the focused application.
   * Used by the diff/typing engine (Phase 4) to retract revised partials.
   */
  async backspace(count: number): Promise<void> {
    if (count <= 0) return;
    for (let i = 0; i < count; i++) {
      this.libnut.keyTap('backspace');
      if (i < count - 1) {
        await sleep(BACKSPACE_INTERVAL_MS);
      }
    }
  }

  /**
   * Returns true when the OS will allow us to inject keystrokes.
   *
   * - macOS: Accessibility permission must be granted.
   * - Linux: must be an X11 session (Wayland sessions silently no-op).
   * - Windows: always true.
   */
  isAvailable(): boolean {
    if (process.platform === 'darwin') {
      return systemPreferences.isTrustedAccessibilityClient(false);
    }
    if (process.platform === 'linux') {
      // Wayland sessions identify themselves via XDG_SESSION_TYPE.
      // XWayland-bridged X11 sessions report 'x11' so they pass through.
      return process.env.XDG_SESSION_TYPE !== 'wayland';
    }
    return true;
  }

  /**
   * macOS only: trigger the OS-driven Accessibility permission prompt.
   *
   * Note: `isTrustedAccessibilityClient(true)` returns the CURRENT trust
   * state (not the post-prompt state). On a fresh launch this returns
   * false even while the System Settings pane opens. Callers should poll
   * `isAvailable()` after the prompt rather than treating the return value
   * as authoritative.
   */
  promptForAccessibility(): boolean {
    if (process.platform !== 'darwin') {
      return true;
    }
    return systemPreferences.isTrustedAccessibilityClient(true);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
