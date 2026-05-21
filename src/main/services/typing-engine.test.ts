// ============================================================================
// TypingEngine unit tests
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TypingEngine, TypingPort, computeWordAwareDiff } from './typing-engine';

class FakePort implements TypingPort {
  /** Each op recorded as [kind, payload]. */
  ops: Array<['insert', string] | ['backspace', number]> = [];

  async insertText(text: string): Promise<void> {
    this.ops.push(['insert', text]);
  }

  async backspace(count: number): Promise<void> {
    this.ops.push(['backspace', count]);
  }

  /**
   * Reconstruct what's "in the focused input" based on the recorded ops.
   * Starts with the seed string (default empty).
   */
  rendered(seed = ''): string {
    let text = seed;
    for (const [kind, payload] of this.ops) {
      if (kind === 'insert') text += payload;
      else text = text.slice(0, Math.max(0, text.length - payload));
    }
    return text;
  }
}

describe('computeWordAwareDiff', () => {
  it('appends when target extends previous', () => {
    expect(computeWordAwareDiff('hello', 'hello world')).toEqual({
      backspaceCount: 0,
      insertText: ' world',
    });
  });

  it('returns no-op when target equals previous', () => {
    expect(computeWordAwareDiff('hello', 'hello')).toEqual({
      backspaceCount: 0,
      insertText: '',
    });
  });

  it('snaps to word boundary instead of backspacing mid-word', () => {
    // Naive char-diff would backspace 1 ("brwon" -> "brown"). Word-aware
    // backspaces the whole revised word.
    const { backspaceCount, insertText } = computeWordAwareDiff(
      'the quick brwon',
      'the quick brown'
    );
    expect(backspaceCount).toBe(5); // "brwon"
    expect(insertText).toBe('brown');
  });

  it('handles full replacement (no common prefix)', () => {
    expect(computeWordAwareDiff('hello', 'goodbye')).toEqual({
      backspaceCount: 5,
      insertText: 'goodbye',
    });
  });

  it('handles empty previous', () => {
    expect(computeWordAwareDiff('', 'first words')).toEqual({
      backspaceCount: 0,
      insertText: 'first words',
    });
  });

  it('handles empty target', () => {
    expect(computeWordAwareDiff('committed text', '')).toEqual({
      backspaceCount: 14,
      insertText: '',
    });
  });

  it('snap preserves whitespace boundary', () => {
    // Previous ends after a complete word + space. Target adds another word.
    // No backspace needed.
    expect(computeWordAwareDiff('hello ', 'hello world')).toEqual({
      backspaceCount: 0,
      insertText: 'world',
    });
  });

  it('snaps to word boundary when target TRUNCATES the final word', () => {
    // Regression test: previous bug character-diffed this case (bs=1, ins="").
    // Correct word-aware behavior is to backspace the whole "too" and retype "to".
    expect(computeWordAwareDiff('I want too', 'I want to')).toEqual({
      backspaceCount: 3,
      insertText: 'to',
    });
  });

  it('snaps to word boundary when target trims a single-letter overshoot', () => {
    expect(computeWordAwareDiff('hello worldd', 'hello world')).toEqual({
      backspaceCount: 6,
      insertText: 'world',
    });
  });

  it('appends a punctuation token to the previous word without backspacing', () => {
    // "hello" -> "hello." should just insert "."; common case where AssemblyAI
    // adds a sentence-ending period to the final word of a partial.
    expect(computeWordAwareDiff('hello', 'hello.')).toEqual({
      backspaceCount: 0,
      insertText: '.',
    });
  });
});

describe('TypingEngine — finals mode', () => {
  let port: FakePort;
  let engine: TypingEngine;

  beforeEach(() => {
    port = new FakePort();
    engine = new TypingEngine(port, { mode: 'finals' });
  });

  it('ignores partials and inserts final on end_of_turn', async () => {
    await engine.onTurn({ transcript: 'hello', endOfTurn: false });
    await engine.onTurn({ transcript: 'hello world', endOfTurn: false });
    await engine.onTurn({ transcript: 'hello world.', endOfTurn: true });

    expect(port.ops).toEqual([['insert', 'hello world. ']]);
  });

  it('appends a trailing space to each final', async () => {
    await engine.onTurn({ transcript: 'first', endOfTurn: true });
    await engine.onTurn({ transcript: 'second', endOfTurn: true });

    expect(port.rendered()).toBe('first second ');
  });

  it('tick is a no-op in finals mode', async () => {
    await engine.onTurn({ transcript: 'pending', endOfTurn: false });
    await engine.tick();
    await engine.tick();
    expect(port.ops).toHaveLength(0);
  });

  it('flush is a no-op in finals mode', async () => {
    await engine.onTurn({ transcript: 'pending', endOfTurn: false });
    await engine.flush();
    expect(port.ops).toHaveLength(0);
  });

  it('ignores empty/whitespace-only finals', async () => {
    await engine.onTurn({ transcript: '   ', endOfTurn: true });
    expect(port.ops).toHaveLength(0);
  });
});

describe('TypingEngine — partials mode', () => {
  let port: FakePort;
  let engine: TypingEngine;
  let now: number;

  beforeEach(() => {
    port = new FakePort();
    now = 0;
    engine = new TypingEngine(port, {
      mode: 'partials',
      stabilityMs: 100,
      now: () => now,
    });
  });

  it('does not commit a partial before stability', async () => {
    await engine.onTurn({ transcript: 'hello', endOfTurn: false });
    now += 50;
    await engine.tick();
    expect(port.ops).toHaveLength(0);
  });

  it('commits a partial once stable', async () => {
    await engine.onTurn({ transcript: 'hello', endOfTurn: false });
    now += 150;
    await engine.tick();
    expect(port.ops).toEqual([['insert', 'hello']]);
  });

  it('extends committed text with a longer partial', async () => {
    await engine.onTurn({ transcript: 'hello', endOfTurn: false });
    now += 150;
    await engine.tick();

    await engine.onTurn({ transcript: 'hello world', endOfTurn: false });
    now += 150;
    await engine.tick();

    expect(port.rendered()).toBe('hello world');
    // Should not backspace anything — the new partial extends cleanly
    expect(port.ops.filter(o => o[0] === 'backspace')).toEqual([]);
  });

  it('backspaces a revised word when partials diverge', async () => {
    await engine.onTurn({ transcript: 'the quick brwon', endOfTurn: false });
    now += 150;
    await engine.tick();

    await engine.onTurn({ transcript: 'the quick brown', endOfTurn: false });
    now += 150;
    await engine.tick();

    expect(port.rendered()).toBe('the quick brown');
    expect(port.ops).toEqual([
      ['insert', 'the quick brwon'],
      ['backspace', 5],
      ['insert', 'brown'],
    ]);
  });

  it('resets stability timer when partial changes', async () => {
    await engine.onTurn({ transcript: 'first', endOfTurn: false });
    now += 80;
    await engine.tick();
    expect(port.ops).toHaveLength(0);

    // New partial arrives — timer should restart
    await engine.onTurn({ transcript: 'first second', endOfTurn: false });
    now += 80; // 80ms since the change, still under 100ms stability
    await engine.tick();
    expect(port.ops).toHaveLength(0);

    now += 30; // total 110ms since the change
    await engine.tick();
    expect(port.ops).toEqual([['insert', 'first second']]);
  });

  it('flush emits the pending partial without waiting for stability', async () => {
    await engine.onTurn({ transcript: 'unflushed', endOfTurn: false });
    await engine.flush();
    expect(port.ops).toEqual([['insert', 'unflushed']]);
  });

  it('end_of_turn appends trailing space and resets committed prefix', async () => {
    await engine.onTurn({ transcript: 'hello', endOfTurn: false });
    now += 150;
    await engine.tick();

    await engine.onTurn({ transcript: 'hello world.', endOfTurn: true });
    // After the final, the engine's internal committed resets to '', so the
    // next utterance won't try to compute a diff against "hello world. ".
    await engine.onTurn({ transcript: 'next', endOfTurn: false });
    now += 150;
    await engine.tick();

    // Visual order: "hello" → revised to "hello world." → " " → "next"
    expect(port.rendered()).toBe('hello world. next');
  });

  it('abort() makes subsequent turns no-ops', async () => {
    await engine.onTurn({ transcript: 'a', endOfTurn: false });
    engine.abort();
    now += 200;
    await engine.tick();
    await engine.onTurn({ transcript: 'b', endOfTurn: true });
    expect(port.ops).toHaveLength(0);
  });

  it('reset() clears state for next session', async () => {
    await engine.onTurn({ transcript: 'first', endOfTurn: true });
    engine.reset();
    expect(port.ops).toEqual([['insert', 'first ']]);

    // New session: "second" should commit cleanly without trying to backspace.
    await engine.onTurn({ transcript: 'second', endOfTurn: true });
    expect(port.ops).toEqual([
      ['insert', 'first '],
      ['insert', 'second '],
    ]);
  });

  it('reset() drops queued ops from previous session', async () => {
    // First insertText hangs; subsequent calls resolve immediately. This lets
    // us hold session 1's op mid-flight, reset, then drive session 2.
    const deferred: { resolve?: () => void } = {};
    const insertCalled = vi.fn();
    insertCalled
      .mockImplementationOnce(() => new Promise<void>((res) => { deferred.resolve = res; }))
      .mockResolvedValue(undefined);
    const slowPort: TypingPort = {
      insertText: insertCalled,
      backspace: vi.fn(),
    };
    const slowEngine = new TypingEngine(slowPort, { mode: 'finals' });

    // Queue a final that will hang on its insertText.
    const queued = slowEngine.onTurn({ transcript: 'session1', endOfTurn: true });
    // Drain microtasks so the queued op actually starts and hits the port.
    await new Promise((r) => setImmediate(r));
    expect(insertCalled).toHaveBeenCalledTimes(1);

    // Reset before the queued op resolves — should clear opChain.
    slowEngine.reset();

    // Resolve the wedged op. Without the fix, session 2's op would chain
    // behind this; with the fix, opChain is fresh and session 2 runs on its own.
    deferred.resolve?.();
    await queued;

    // Start session 2.
    await slowEngine.onTurn({ transcript: 'session2', endOfTurn: true });

    // Session 2 should not see ghost backspaces from the cleared session-1 state.
    expect(slowPort.backspace).not.toHaveBeenCalled();
    expect(insertCalled).toHaveBeenCalledTimes(2);
  });

  it('partials mode: skips empty partials so committed text is not erased', async () => {
    await engine.onTurn({ transcript: 'first', endOfTurn: false });
    now += 150;
    await engine.tick();
    expect(port.rendered()).toBe('first');

    // Empty partial arrives — must NOT erase "first"
    await engine.onTurn({ transcript: '', endOfTurn: false });
    now += 150;
    await engine.tick();
    expect(port.rendered()).toBe('first');
    expect(port.ops.filter(o => o[0] === 'backspace')).toEqual([]);
  });

  it('setMode flips between modes mid-session', async () => {
    await engine.onTurn({ transcript: 'partial', endOfTurn: false });
    engine.setMode('finals');
    now += 200;
    await engine.tick();
    // Should NOT emit — we switched to finals after the partial arrived.
    expect(port.ops).toHaveLength(0);

    await engine.onTurn({ transcript: 'final.', endOfTurn: true });
    expect(port.ops).toEqual([['insert', 'final. ']]);
  });
});

describe('TypingEngine — error tolerance', () => {
  it('continues after a failed insert in finals mode (logs but does not throw)', async () => {
    const port: TypingPort = {
      insertText: vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined),
      backspace: vi.fn(),
    };
    const engine = new TypingEngine(port, { mode: 'finals' });

    // Suppress the console.error so test output is clean.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await engine.onTurn({ transcript: 'first', endOfTurn: true });
    await engine.onTurn({ transcript: 'second', endOfTurn: true });

    expect(port.insertText).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('continues after a failed insert in partials mode (committed staged ahead of reality)', async () => {
    const port: TypingPort = {
      insertText: vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined),
      backspace: vi.fn(),
    };
    let now = 0;
    const engine = new TypingEngine(port, {
      mode: 'partials',
      stabilityMs: 100,
      now: () => now,
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // First partial commit will fail.
    await engine.onTurn({ transcript: 'hello', endOfTurn: false });
    now += 150;
    await engine.tick();

    // Second partial — engine's view of committed is "hello" even though
    // nothing was actually typed. Acceptable per plan; Phase 6 aborts the
    // session on stream error rather than trying to recover here.
    await engine.onTurn({ transcript: 'hello world', endOfTurn: false });
    now += 150;
    await engine.tick();

    expect(port.insertText).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
