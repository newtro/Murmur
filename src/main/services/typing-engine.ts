// ============================================================================
// Typing Engine — converts AssemblyAI streaming turns into TypingService calls.
//
// Two modes:
//   • finals  — wait for end_of_turn==true, then insert the final transcript.
//               No backspacing, no flicker, safe in all focus contexts.
//   • partials — commit partials after they've been stable for stabilityMs.
//               Backspace + retype the trailing diff when a later partial
//               revises committed text. The Wispr-style feel; sharper edge.
//
// The engine is pure logic — it doesn't import Electron, doesn't talk to IPC.
// All side effects go through the injected `TypingPort` interface so the
// engine is fully unit-testable.
// ============================================================================

export interface TypingPort {
  insertText(text: string): Promise<void>;
  backspace(count: number): Promise<void>;
}

export type TypingMode = 'finals' | 'partials';

export interface TypingEngineOptions {
  mode: TypingMode;
  /** Stability threshold for partials mode (ms). Ignored in finals mode. */
  stabilityMs?: number;
  /** Clock injection for tests. Defaults to Date.now. */
  now?: () => number;
}

export interface StreamingTurn {
  transcript: string;
  endOfTurn: boolean;
}

const DEFAULT_STABILITY_MS = 150;

/**
 * The TypingEngine is driven by two inputs:
 *   1. onTurn(turn) — called for every AssemblyAI streaming turn.
 *   2. tick()       — called from an external 50ms timer in partials mode.
 *
 * It serializes typing operations: only one insertText/backspace promise
 * is in flight at a time. Late partials that arrive while an earlier
 * operation is still running get queued (latest wins — intermediate
 * partials drop, the engine never falls behind the speaker).
 */
export class TypingEngine {
  private mode: TypingMode;
  private stabilityMs: number;
  private now: () => number;
  private port: TypingPort;

  /** Text we've already committed to the focused input. */
  private committed = '';
  /** Latest partial we haven't committed yet (partials mode only). */
  private pendingPartial: string | null = null;
  /** Timestamp the current pendingPartial was first observed. */
  private pendingSince = 0;

  /** Promise chain so type operations don't interleave. */
  private opChain: Promise<void> = Promise.resolve();
  /** Flag set during reset/flush so in-flight operations are no-ops. */
  private aborted = false;

  constructor(port: TypingPort, options: TypingEngineOptions) {
    this.port = port;
    this.mode = options.mode;
    this.stabilityMs = options.stabilityMs ?? DEFAULT_STABILITY_MS;
    this.now = options.now ?? Date.now;
  }

  setMode(mode: TypingMode): void {
    this.mode = mode;
  }

  setStabilityMs(ms: number): void {
    this.stabilityMs = ms;
  }

  /**
   * Reset internal state for a new dictation session. Does NOT undo any
   * already-typed text — that's the user's content now.
   *
   * Clears the op queue so stale keystrokes from the prior session can't
   * land mid-new-session. Callers expecting a clean handoff should `abort()`
   * first, await any in-flight op, then `reset()`.
   */
  reset(): void {
    this.committed = '';
    this.pendingPartial = null;
    this.pendingSince = 0;
    this.aborted = false;
    this.opChain = Promise.resolve();
  }

  /**
   * Abort the engine: subsequent onTurn/tick/flush calls become no-ops.
   * Used when the session errors or is cancelled mid-utterance — we don't
   * want to keep emitting typing after the user has moved on.
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Handle one streaming turn from AssemblyAI.
   * Returns the operation promise so callers can await ordering if needed.
   */
  onTurn(turn: StreamingTurn): Promise<void> {
    if (this.aborted) return Promise.resolve();

    if (turn.endOfTurn) {
      // Final turn: commit the full transcript, append a trailing space so
      // subsequent utterances don't run into the previous one.
      const finalText = turn.transcript.trim();
      if (!finalText) return Promise.resolve();
      const target = finalText + ' ';
      this.pendingPartial = null;
      this.pendingSince = 0;
      return this.commitTo(target, /* resetAfter */ true);
    }

    if (this.mode === 'finals') {
      // In finals-only mode, partials are observed but never typed.
      return Promise.resolve();
    }

    // partials mode: remember this partial; tick() will commit it once stable.
    // Skip empty partials — they would otherwise erase already-committed text.
    const partial = turn.transcript;
    if (!partial) {
      return Promise.resolve();
    }
    if (partial !== this.pendingPartial) {
      this.pendingPartial = partial;
      this.pendingSince = this.now();
    }
    return Promise.resolve();
  }

  /**
   * Called from an external timer (~every 50ms) in partials mode. Commits
   * the pending partial once it has been stable for `stabilityMs`.
   */
  tick(): Promise<void> {
    if (this.aborted) return Promise.resolve();
    if (this.mode !== 'partials') return Promise.resolve();
    if (this.pendingPartial === null) return Promise.resolve();
    if (this.now() - this.pendingSince < this.stabilityMs) return Promise.resolve();

    const target = this.pendingPartial;
    this.pendingPartial = null;
    this.pendingSince = 0;
    return this.commitTo(target, /* resetAfter */ false);
  }

  /**
   * Wait for the operation chain to drain — every queued insert/backspace
   * has resolved (or its rejection has been swallowed by the chain's catch).
   * Used by the stop path so the overlay doesn't flip to "complete" before
   * the final turn's keystrokes have landed.
   */
  drain(): Promise<void> {
    return this.opChain;
  }

  /**
   * Force-commit any pending partial. Called when the session ends without
   * an explicit final turn (e.g. user releases hotkey before the endpointer
   * fires). In partials mode it emits whatever's pending; in finals mode
   * it does nothing.
   */
  flush(): Promise<void> {
    if (this.aborted) return Promise.resolve();
    if (this.mode !== 'partials' || this.pendingPartial === null) {
      return Promise.resolve();
    }
    const target = this.pendingPartial;
    this.pendingPartial = null;
    this.pendingSince = 0;
    return this.commitTo(target, /* resetAfter */ false);
  }

  /**
   * Compute the diff between `committed` and `target`, queue the
   * appropriate backspace+insert operation. Returns a promise that
   * resolves when the queued op completes.
   *
   * `resetAfter` is true for final turns: after the final commits, we
   * reset `committed` to empty so the next utterance starts fresh (this
   * is what produces clean "sentence sentence sentence" output).
   */
  private commitTo(target: string, resetAfter: boolean): Promise<void> {
    const previous = this.committed;
    const { backspaceCount, insertText } = computeWordAwareDiff(previous, target);

    // Stage the new committed state immediately so a later onTurn computes
    // its diff against the most-recent commit (even before the keystrokes
    // have physically landed).
    this.committed = resetAfter ? '' : target;

    const op = async () => {
      if (this.aborted) return;
      if (backspaceCount > 0) {
        await this.port.backspace(backspaceCount);
      }
      if (insertText.length > 0) {
        await this.port.insertText(insertText);
      }
    };

    this.opChain = this.opChain.then(op).catch((err) => {
      // Log but don't break the chain — a single failed insert shouldn't
      // wedge the whole session. Caller has already updated `committed`,
      // so a failed insert will leave the engine's view of the world
      // ahead of reality. Phase 6's error handler covers this case by
      // aborting the session.
      console.error('[TypingEngine] op failed:', err);
    });
    return this.opChain;
  }
}

/**
 * Compute the (backspaceCount, insertText) delta from `previous` to `target`.
 *
 * Word-aware: when partials differ mid-word, we backspace the whole word
 * rather than partial characters. This avoids flicker like
 * "the quick brwon" → backspace 4 → "wn fox" producing "the quick brown".
 * Snapping to whitespace gives the user a cleaner visual.
 *
 * Pure function — exported for testing.
 */
export function computeWordAwareDiff(
  previous: string,
  target: string
): { backspaceCount: number; insertText: string } {
  // Find the longest common character prefix.
  let charCommon = 0;
  const maxLen = Math.min(previous.length, target.length);
  while (charCommon < maxLen && previous[charCommon] === target[charCommon]) {
    charCommon++;
  }

  // Snap back to the last word boundary so we don't backspace mid-word.
  // We snap whenever the divergence point lies inside a word in `previous`
  // (i.e., the character just before snapAt is a non-boundary). This covers
  // both the "revised word in the middle" case AND the "trimmed final word"
  // case (e.g. "I want too" → "I want to" should backspace the whole "too"
  // and retype "to", not chop off the trailing 'o' character-wise).
  let snapAt = charCommon;
  if (snapAt > 0 && snapAt < previous.length && !isWordBoundary(previous[snapAt - 1])) {
    while (snapAt > 0 && !isWordBoundary(previous[snapAt - 1])) {
      snapAt--;
    }
  }

  const backspaceCount = previous.length - snapAt;
  const insertText = target.slice(snapAt);

  return { backspaceCount, insertText };
}

function isWordBoundary(ch: string): boolean {
  return /\s/.test(ch);
}
