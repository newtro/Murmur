// ============================================================================
// Global Hotkey Service using uiohook-napi
// ============================================================================

import { uIOhook, UiohookKeyboardEvent } from 'uiohook-napi';
import { EventEmitter } from 'events';
import { HotkeyConfig, ActivationMode } from '../../shared/types';
import { KEY_CODES } from '../../shared/constants';

interface HotkeyEvents {
  keyDown: () => void;
  keyUp: () => void;
}

interface ParsedHotkey {
  keyCode: number;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export class HotkeyService extends EventEmitter {
  private config: HotkeyConfig;
  private isKeyDown = false;
  private parsedHotkey: ParsedHotkey;

  constructor(config: HotkeyConfig) {
    super();
    this.config = config;
    this.parsedHotkey = this.parseHotkey(this.getActiveHotkey());
  }

  private getActiveHotkey(): string {
    // Use the appropriate hotkey based on activation mode
    return this.config.activationMode === 'push-to-talk'
      ? this.config.pushToTalkKey
      : this.config.toggleKey;
  }

  private parseHotkey(hotkeyString: string): ParsedHotkey {
    const parts = hotkeyString.split('+').map(p => p.trim());

    let ctrl = false;
    let shift = false;
    let alt = false;
    let meta = false;
    let mainKey = 'Backquote';

    for (const part of parts) {
      const lowerPart = part.toLowerCase();
      if (lowerPart === 'ctrl' || lowerPart === 'control') {
        ctrl = true;
      } else if (lowerPart === 'shift') {
        shift = true;
      } else if (lowerPart === 'alt') {
        alt = true;
      } else if (lowerPart === 'meta' || lowerPart === 'cmd' || lowerPart === 'win') {
        meta = true;
      } else {
        // This is the main key
        mainKey = part;
      }
    }

    const keyCode = KEY_CODES[mainKey as keyof typeof KEY_CODES] || KEY_CODES.Backquote;

    console.log('[HotkeyService] Parsed hotkey:', {
      original: hotkeyString,
      mainKey,
      keyCode,
      ctrl,
      shift,
      alt,
      meta,
    });

    return { keyCode, ctrl, shift, alt, meta };
  }

  private matchesHotkey(event: UiohookKeyboardEvent): boolean {
    // Check if the main key matches
    if (event.keycode !== this.parsedHotkey.keyCode) {
      return false;
    }

    // Check modifiers
    if (this.parsedHotkey.ctrl !== event.ctrlKey) return false;
    if (this.parsedHotkey.shift !== event.shiftKey) return false;
    if (this.parsedHotkey.alt !== event.altKey) return false;
    if (this.parsedHotkey.meta !== event.metaKey) return false;

    return true;
  }

  public start(): void {
    console.log('[HotkeyService] Starting hotkey listener...');
    console.log('[HotkeyService] Active hotkey:', this.getActiveHotkey());
    console.log('[HotkeyService] Activation mode:', this.config.activationMode);

    uIOhook.on('keydown', (event: UiohookKeyboardEvent) => {
      if (this.matchesHotkey(event) && !this.isKeyDown) {
        this.isKeyDown = true;
        console.log('[HotkeyService] Hotkey pressed:', this.getActiveHotkey());
        this.emit('keyDown');
      }
    });

    uIOhook.on('keyup', (event: UiohookKeyboardEvent) => {
      // For key up, we only check the main key code since modifiers might be released first
      if (event.keycode === this.parsedHotkey.keyCode && this.isKeyDown) {
        this.isKeyDown = false;
        console.log('[HotkeyService] Hotkey released:', this.getActiveHotkey());
        this.emit('keyUp');
      }
    });

    uIOhook.start();
    console.log('[HotkeyService] Hotkey listener started');
  }

  public stop(): void {
    console.log('[HotkeyService] Stopping hotkey listener...');
    uIOhook.stop();
  }

  public updateHotkeys(config: HotkeyConfig): void {
    this.config = config;
    this.parsedHotkey = this.parseHotkey(this.getActiveHotkey());
    console.log('[HotkeyService] Updated hotkey:', this.getActiveHotkey());
  }

  public getActivationMode(): ActivationMode {
    return this.config.activationMode;
  }

  // Typed event emitter methods
  public override on<K extends keyof HotkeyEvents>(
    event: K,
    listener: HotkeyEvents[K]
  ): this {
    return super.on(event, listener);
  }

  public override emit<K extends keyof HotkeyEvents>(event: K): boolean {
    return super.emit(event);
  }
}
