// ============================================================================
// Text Pasting Service - Inserts text at cursor using PowerShell SendKeys
// ============================================================================

import { clipboard } from 'electron';
import { spawn } from 'child_process';

export class PasteService {
  /**
   * Copy the currently selected text by simulating Ctrl+C
   * Returns the selected text and the previous clipboard contents for later restore
   */
  async copySelection(): Promise<{ selectedText: string; previousClipboard: string }> {
    const previousClipboard = clipboard.readText();

    // Clear clipboard so we can detect if copy worked
    clipboard.writeText('');

    // Simulate Ctrl+C
    await this.sendCtrlC();

    // Wait for clipboard to populate
    await new Promise(resolve => setTimeout(resolve, 150));

    const selectedText = clipboard.readText();

    return { selectedText, previousClipboard };
  }

  /**
   * Restore previous clipboard contents
   */
  restoreClipboard(text: string): void {
    clipboard.writeText(text);
  }

  /**
   * Paste text at the current cursor position
   * Uses clipboard + SendKeys approach for Windows
   */
  async paste(text: string): Promise<void> {
    if (!text || text.trim().length === 0) {
      console.log('[PasteService] No text to paste');
      return;
    }

    console.log('[PasteService] Pasting text:', text.substring(0, 50) + '...');

    // Store current clipboard content
    const previousClipboard = clipboard.readText();

    try {
      // Write new text to clipboard
      clipboard.writeText(text);

      // Small delay to ensure clipboard is updated
      await new Promise(resolve => setTimeout(resolve, 50));

      // Send Ctrl+V using PowerShell
      await this.sendCtrlV();

      // Small delay before restoring clipboard
      await new Promise(resolve => setTimeout(resolve, 100));

    } finally {
      // Restore previous clipboard content (optional, can be disabled)
      // clipboard.writeText(previousClipboard);
    }

    console.log('[PasteService] Paste complete');
  }

  /**
   * Send Ctrl+C keystroke using PowerShell SendKeys
   */
  private sendCtrlC(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ps = spawn('powershell', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^c")'
      ], {
        windowsHide: true
      });

      let stderr = '';

      ps.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ps.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error('[PasteService] PowerShell Ctrl+C error:', stderr);
          reject(new Error('Failed to simulate Ctrl+C'));
        }
      });

      ps.on('error', (err) => {
        console.error('[PasteService] PowerShell spawn error:', err);
        reject(err);
      });
    });
  }

  /**
   * Send Ctrl+V keystroke using PowerShell SendKeys
   */
  private sendCtrlV(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ps = spawn('powershell', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")'
      ], {
        windowsHide: true
      });

      let stderr = '';

      ps.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ps.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error('[PasteService] PowerShell error:', stderr);
          // Try VBScript fallback
          this.sendCtrlVVbscript().then(resolve).catch(reject);
        }
      });

      ps.on('error', (err) => {
        console.error('[PasteService] PowerShell spawn error:', err);
        // Try VBScript fallback
        this.sendCtrlVVbscript().then(resolve).catch(reject);
      });
    });
  }

  /**
   * Fallback: Send Ctrl+V using VBScript
   */
  private sendCtrlVVbscript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const vbs = spawn('cscript', [
        '//NoLogo',
        '//E:VBScript',
        '//'
      ], {
        windowsHide: true
      });

      // Write VBScript to stdin
      vbs.stdin.write('Set WshShell = WScript.CreateObject("WScript.Shell")\n');
      vbs.stdin.write('WshShell.SendKeys "^v"\n');
      vbs.stdin.end();

      vbs.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('VBScript SendKeys failed'));
        }
      });

      vbs.on('error', (err) => {
        reject(err);
      });
    });
  }
}
