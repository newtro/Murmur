// ============================================================================
// Local Whisper Transcription Provider using whisper.cpp CLI
// ============================================================================

import { app } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import AdmZip from 'adm-zip';
import { TranscriptionResult, WHISPER_MODELS } from '../../../shared/types';

export class WhisperLocalProvider {
  private whisperDir: string;
  private modelsDir: string;
  private binaryPath: string;

  constructor() {
    this.whisperDir = path.join(app.getPath('userData'), 'whisper');
    this.modelsDir = path.join(this.whisperDir, 'models');
    this.binaryPath = path.join(this.whisperDir, 'bin', process.platform === 'win32' ? 'main.exe' : 'main');

    // Ensure directories exist
    fs.mkdirSync(this.modelsDir, { recursive: true });
    fs.mkdirSync(path.join(this.whisperDir, 'bin'), { recursive: true });
  }

  async transcribe(
    audioBuffer: Buffer,
    model: string,
    language?: string
  ): Promise<TranscriptionResult> {
    // Ensure binary is available
    if (!fs.existsSync(this.binaryPath)) {
      await this.downloadBinary();
    }

    // Ensure model is available
    const modelPath = this.getModelPath(model);
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model ${model} not downloaded. Please download it first.`);
    }

    const startTime = Date.now();

    // Write audio to temp file
    const tempAudioPath = path.join(this.whisperDir, `temp-${Date.now()}.wav`);
    fs.writeFileSync(tempAudioPath, audioBuffer);

    try {
      const text = await this.runWhisper(modelPath, tempAudioPath, language);
      const duration = (Date.now() - startTime) / 1000;

      return {
        text: text.trim(),
        duration,
        language,
      };
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
      }
    }
  }

  private runWhisper(modelPath: string, audioPath: string, language?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', modelPath,
        '-f', audioPath,
        '-nt',           // No timestamps
        '-np',           // No progress
        '--no-fallback', // Don't fall back to other models
      ];

      if (language && language !== 'auto') {
        args.push('-l', language);
      }

      console.log('[WhisperLocal] Running:', this.binaryPath, args.join(' '));

      const proc = spawn(this.binaryPath, args, {
        cwd: this.whisperDir,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          console.error('[WhisperLocal] Error:', stderr);
          reject(new Error(`Whisper exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  private getModelPath(model: string): string {
    return path.join(this.modelsDir, `ggml-${model}.bin`);
  }

  isModelAvailable(model: string): boolean {
    return fs.existsSync(this.getModelPath(model));
  }

  async downloadModel(model: string, onProgress?: (progress: number) => void): Promise<void> {
    const modelInfo = WHISPER_MODELS[model];
    if (!modelInfo) {
      throw new Error(`Unknown model: ${model}`);
    }

    const modelPath = this.getModelPath(model);
    console.log(`[WhisperLocal] Downloading model ${model} from ${modelInfo.url}`);

    await this.downloadFile(modelInfo.url, modelPath, modelInfo.sizeBytes, onProgress);
    console.log(`[WhisperLocal] Model ${model} downloaded`);
  }

  private async downloadBinary(): Promise<void> {
    const platform = process.platform;
    const arch = process.arch;

    // whisper.cpp release binaries
    let binaryUrl: string;

    if (platform === 'win32') {
      binaryUrl = 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.2/whisper-bin-Win32.zip';
    } else if (platform === 'darwin') {
      binaryUrl = arch === 'arm64'
        ? 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.2/whisper-bin-macos-arm64.zip'
        : 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.2/whisper-bin-macos-x64.zip';
    } else {
      binaryUrl = 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.2/whisper-bin-linux-x64.zip';
    }

    const zipPath = path.join(this.whisperDir, 'whisper-bin.zip');
    const binDir = path.join(this.whisperDir, 'bin');

    console.log(`[WhisperLocal] Downloading binary from ${binaryUrl}`);
    await this.downloadFile(binaryUrl, zipPath, 0);

    console.log('[WhisperLocal] Extracting binary...');
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(binDir, true);

    // Clean up zip
    fs.unlinkSync(zipPath);

    // Make binary executable on Unix
    if (platform !== 'win32' && fs.existsSync(this.binaryPath)) {
      fs.chmodSync(this.binaryPath, 0o755);
    }

    console.log('[WhisperLocal] Binary ready at:', this.binaryPath);
  }

  private downloadFile(
    url: string,
    destPath: string,
    expectedSize: number,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      const request = protocol.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.downloadFile(redirectUrl, destPath, expectedSize, onProgress)
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10) || expectedSize;
        let downloadedSize = 0;

        const file = fs.createWriteStream(destPath);

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (onProgress && totalSize > 0) {
            onProgress(downloadedSize / totalSize);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (err) => {
          fs.unlinkSync(destPath);
          reject(err);
        });
      });

      request.on('error', reject);
    });
  }
}
