// ============================================================================
// Audio Recording Hook using Web Audio API
// ============================================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import type { AudioLevel } from '../../shared/types';

interface UseAudioRecordingOptions {
  onAudioData?: (data: { base64: string; duration: number }) => void;
  onError?: (error: Error) => void;
}

export function useAudioRecording(options: UseAudioRecordingOptions = {}) {
  const { onAudioData, onError } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState<AudioLevel | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isRecordingRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average and peak
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
      if (dataArray[i] > peak) peak = dataArray[i];
    }
    const average = sum / dataArray.length / 255;
    const peakNorm = peak / 255;

    // Get frequency bands for visualization (16 bars)
    const bands = 16;
    const bandSize = Math.floor(dataArray.length / bands);
    const frequencies: number[] = [];
    for (let i = 0; i < bands; i++) {
      let bandSum = 0;
      for (let j = 0; j < bandSize; j++) {
        bandSum += dataArray[i * bandSize + j];
      }
      frequencies.push(bandSum / bandSize / 255);
    }

    setAudioLevel({ average, peak: peakNorm, frequencies });
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;

      // Set up audio context for visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const recordingDuration = (Date.now() - startTimeRef.current) / 1000;

        // Convert to WAV format for Whisper
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const wavBuffer = await convertToWav(blob);
        const base64 = arrayBufferToBase64(wavBuffer);

        onAudioData?.({ base64, duration: recordingDuration });

        // Cleanup
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      startTimeRef.current = Date.now();

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      isRecordingRef.current = true;
      setIsRecording(true);
      setDuration(0);

      // Start audio level updates
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);

    } catch (error) {
      console.error('Failed to start recording:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to start recording'));
    }
  }, [onAudioData, onError, updateAudioLevel]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    isRecordingRef.current = false;
    setIsRecording(false);
    setAudioLevel(null);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Clear chunks so no data is sent
    chunksRef.current = [];

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    isRecordingRef.current = false;
    setIsRecording(false);
    setAudioLevel(null);
    setDuration(0);
  }, []);

  return {
    isRecording,
    audioLevel,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}

// Convert WebM blob to WAV format for Whisper
async function convertToWav(blob: Blob): Promise<ArrayBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new OfflineAudioContext(1, 1, 16000);

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const wavBuffer = createWavFile(audioBuffer);
    return wavBuffer;
  } catch (error) {
    console.error('Failed to decode audio:', error);
    // Return original if conversion fails
    return arrayBuffer;
  }
}

// Create WAV file from AudioBuffer
function createWavFile(audioBuffer: AudioBuffer): ArrayBuffer {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;

  // Resample to 16kHz mono
  const offlineContext = new OfflineAudioContext(numChannels, audioBuffer.duration * sampleRate, sampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start();

  // For now, just use the first channel
  const samples = audioBuffer.getChannelData(0);
  const numSamples = samples.length;
  const dataSize = numSamples * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // byte rate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true); // block align
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
