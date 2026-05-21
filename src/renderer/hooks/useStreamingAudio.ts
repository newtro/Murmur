// ============================================================================
// Streaming Audio Capture Hook (live dictation)
//
// Captures microphone audio, downsamples to 16kHz PCM16, and sends chunks to
// the main process every ScriptProcessor tick (~42ms at 48kHz native).
//
// NOTE: Plan asked to extend useAudioRecording with mode:'batch'|'live'. We
// chose to ship a separate hook because the API shape is incompatible (no
// onAudioData callback, no Blob accumulation, continuous chunk emission).
// Both hooks can be active independently if needed; the batch hook is
// untouched.
// ============================================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import type { AudioLevel } from '../../shared/types';

interface UseStreamingAudioOptions {
  onError?: (error: Error) => void;
  onTranscript?: (event: { transcript: string; endOfTurn: boolean }) => void;
  onSessionOpened?: (event: { sessionId: string; expiresAt: number }) => void;
  onSessionClosed?: (event: { code: number; reason: string }) => void;
}

const TARGET_SAMPLE_RATE = 16000;
// AssemblyAI v3 streaming rejects chunks shorter than 50ms or longer than
// 1000ms ("Input Duration Violation"). 4096 samples gives ~85ms at 48kHz
// native (the common case), ~93ms at 44.1kHz, ~256ms at 16kHz — all safely
// within [50, 1000]. Earlier 2048 dropped us to ~42ms at 48kHz and was
// rejected with error code 3007.
const SCRIPT_PROCESSOR_BUFFER_SIZE = 4096;

export function useStreamingAudio(options: UseStreamingAudioOptions = {}) {
  const { onError, onTranscript, onSessionOpened, onSessionClosed } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [audioLevel, setAudioLevel] = useState<AudioLevel | null>(null);
  const [duration, setDuration] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const isStreamingRef = useRef(false);

  const cleanupResources = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      if (ctx.state !== 'closed') {
        // Both wrap in try/catch AND attach .catch — close() can reject
        // synchronously-via-promise OR throw outright depending on the state
        // transition, and we don't care which.
        try {
          const p = ctx.close();
          if (p && typeof p.catch === 'function') p.catch(() => undefined);
        } catch {
          // already closed or transitioning — ignore
        }
      }
    }
  }, []);

  const stopStreaming = useCallback(async () => {
    if (!isStreamingRef.current) return;
    isStreamingRef.current = false;
    setIsStreaming(false);
    setAudioLevel(null);
    cleanupResources();
    try {
      await window.murmur.stopStreamingSession();
    } catch (error) {
      console.warn('[useStreamingAudio] stopStreamingSession failed:', error);
    }
  }, [cleanupResources]);

  // Subscribe to main-process streaming events so the renderer can react to
  // session lifecycle (and tear down on remote error/close).
  useEffect(() => {
    const offTranscript = window.murmur.onStreamingTranscript((event) => {
      onTranscript?.({ transcript: event.transcript, endOfTurn: event.endOfTurn });
    });
    const offOpened = window.murmur.onStreamingSessionOpened((event) => {
      onSessionOpened?.(event);
    });
    const offClosed = window.murmur.onStreamingSessionClosed((event) => {
      onSessionClosed?.(event);
      // If the session was closed from the server side, stop capturing.
      if (isStreamingRef.current) {
        void stopStreaming();
      }
    });
    const offError = window.murmur.onStreamingError((event) => {
      onError?.(new Error(event.message));
      if (isStreamingRef.current) {
        void stopStreaming();
      }
    });
    return () => {
      offTranscript();
      offOpened();
      offClosed();
      offError();
    };
  }, [onTranscript, onSessionOpened, onSessionClosed, onError, stopStreaming]);

  // Unmount cleanup.
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  const updateLevel = useCallback(() => {
    if (!analyserRef.current || !isStreamingRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      if (data[i] > peak) peak = data[i];
    }
    const bands = 16;
    const bandSize = Math.floor(data.length / bands);
    const frequencies: number[] = [];
    for (let i = 0; i < bands; i++) {
      let bandSum = 0;
      for (let j = 0; j < bandSize; j++) {
        bandSum += data[i * bandSize + j];
      }
      frequencies.push(bandSum / bandSize / 255);
    }
    setAudioLevel({ average: sum / data.length / 255, peak: peak / 255, frequencies });
    animationFrameRef.current = requestAnimationFrame(updateLevel);
  }, []);

  const startStreaming = useCallback(async () => {
    if (isStreamingRef.current) return;

    try {
      // Open the streaming session in main first; if the API key is missing
      // or the WebSocket fails to connect, we don't want to capture audio
      // that has nowhere to go.
      const result = await window.murmur.startStreamingSession(TARGET_SAMPLE_RATE);
      if (!result.ok) {
        throw new Error(result.error);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: TARGET_SAMPLE_RATE,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const sourceRate = audioContext.sampleRate;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const processor = audioContext.createScriptProcessor(
        SCRIPT_PROCESSOR_BUFFER_SIZE,
        1,
        1
      );
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!isStreamingRef.current) return;
        const inputData = event.inputBuffer.getChannelData(0);
        const pcm16 = downsampleAndConvertToPCM16(inputData, sourceRate, TARGET_SAMPLE_RATE);
        // Copy into a fresh ArrayBuffer so we transfer a clean owned buffer
        // (Int16Array.buffer is ArrayBufferLike, which IPC doesn't accept).
        const ab = new ArrayBuffer(pcm16.byteLength);
        new Int16Array(ab).set(pcm16);
        window.murmur.sendStreamingAudioChunk(ab);
      };

      source.connect(processor);
      // ScriptProcessor only fires when connected to destination; mute via
      // zero-gain so we don't hear the live mic.
      const muted = audioContext.createGain();
      muted.gain.value = 0;
      processor.connect(muted);
      muted.connect(audioContext.destination);

      isStreamingRef.current = true;
      setIsStreaming(true);
      startTimeRef.current = Date.now();
      setDuration(0);

      animationFrameRef.current = requestAnimationFrame(updateLevel);
      durationIntervalRef.current = setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);
    } catch (error) {
      cleanupResources();
      isStreamingRef.current = false;
      setIsStreaming(false);
      // Best effort: tell main to tear down its session if we opened it
      try {
        await window.murmur.stopStreamingSession();
      } catch {
        // ignore
      }
      const err = error instanceof Error ? error : new Error('Failed to start streaming');
      onError?.(err);
    }
  }, [cleanupResources, updateLevel, onError]);

  const cancelStreaming = useCallback(async () => {
    await stopStreaming();
    setDuration(0);
  }, [stopStreaming]);

  return {
    isStreaming,
    audioLevel,
    duration,
    startStreaming,
    stopStreaming,
    cancelStreaming,
  };
}

/**
 * Downsamples Float32 audio from sourceRate to targetRate and converts to
 * signed 16-bit little-endian PCM. Uses linear interpolation. Note: no
 * anti-aliasing filter — acceptable for v1 (matches the plan's non-goal of
 * avoiding browser-side audio enhancement), but watch for sibilant artifacts.
 */
function downsampleAndConvertToPCM16(
  input: Float32Array,
  sourceRate: number,
  targetRate: number
): Int16Array {
  if (sourceRate === targetRate) {
    return floatToInt16(input);
  }
  const ratio = sourceRate / targetRate;
  const outLength = Math.floor(input.length / ratio);
  const output = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const idx = Math.floor(srcIndex);
    const frac = srcIndex - idx;
    const a = input[idx];
    const b = idx + 1 < input.length ? input[idx + 1] : a;
    const sample = a + (b - a) * frac;
    const clamped = Math.max(-1, Math.min(1, sample));
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
}

function floatToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
}
