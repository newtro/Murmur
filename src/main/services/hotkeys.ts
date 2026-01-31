// ============================================================================
// Global Hotkey Service using uiohook-napi
// ============================================================================

import { uIOhook } from 'uiohook-napi';
import { EventEmitter } from 'events';
import { HotkeyConfig, ActivationMode } from '../../shared/types';
import { KEY_CODES } from '../../shared/constants';

interface HotkeyEvents {
  keyDown: () => void;
  keyUp: () => void;
}

export class HotkeyService extends EventEmitter {
  private config: HotkeyConfig;
  private isKeyDown = false;
  private targetKeyCode: number;

  constructor(config: HotkeyConfig) {
    super();
    this.config = config;
    this.targetKeyCode = this.getKeyCode(config.pushToTalkKey);
  }

  private getKeyCode(keyName: string): number {
    return KEY_CODES[keyName as keyof typeof KEY_CODES] || KEY_CODES.Backquote;
  }

  public start(): void {
    console.log('[HotkeyService] Starting hotkey listener...');

    uIOhook.on('keydown', (event) => {
      if (event.keycode === this.targetKeyCode && !this.isKeyDown) {
        this.isKeyDown = true;
        console.log('[HotkeyService] Key down:', this.config.pushToTalkKey);
        this.emit('keyDown');
      }
    });

    uIOhook.on('keyup', (event) => {
      if (event.keycode === this.targetKeyCode && this.isKeyDown) {
        this.isKeyDown = false;
        console.log('[HotkeyService] Key up:', this.config.pushToTalkKey);
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
    this.targetKeyCode = this.getKeyCode(config.pushToTalkKey);
    console.log('[HotkeyService] Updated hotkey:', config.pushToTalkKey);
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
